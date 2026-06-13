import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useMemo, useRef, useState } from "react"
import { requestJson } from "#/lib/api"
import { createWebAuthClient } from "#/lib/auth"
import { storage } from "#/lib/storage"
import { Toast, Field, PrimaryButton } from "#/components/ui"
import { ScanLine } from "lucide-react"

type ScanResult = { ScanResult: string; format: number }

export const Route = createFileRoute("/scanner")({
	component: ScannerScreen,
})

type ToastType = "info" | "success" | "error"

function ScannerScreen() {
	const navigate = useNavigate()
	const [scanning, setScanning] = useState(false)
	const [webCameraActive, setWebCameraActive] = useState(false)
	const [apiUrl, setApiUrl] = useState("")
	const [processing, setProcessing] = useState(false)
	const [toast, setToast] = useState<{ message: string; type: ToastType; visible: boolean }>({
		message: "",
		type: "info",
		visible: false,
	})
	const [webFallback, setWebFallback] = useState(false)
	const [cameraError, setCameraError] = useState("")
	const videoRef = useRef<HTMLVideoElement | null>(null)
	const streamRef = useRef<MediaStream | null>(null)
	const scanFrameRef = useRef<number | null>(null)
	const stoppedRef = useRef(false)
	const authClient = useMemo(
		() => (apiUrl ? createWebAuthClient(apiUrl) : null),
		[apiUrl],
	)

	function showToast(message: string, type: ToastType = "info") {
		setToast({ message, type, visible: true })
		setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3500)
	}

	async function handleScanResult(result: ScanResult) {
		if (processing) return
		stopWebCamera()
		setProcessing(true)

		try {
			const url = apiUrl || await storage.getApiUrl()

			if (!url) {
				navigate({ to: "/setup" })
				return
			}

			const client = authClient ?? createWebAuthClient(url)
			const session = await client.getSession()
			if (session.error || !session.data?.user) {
				navigate({ to: "/auth" })
				return
			}

			const data = await requestJson<{ assignedSlotCode: string }>(
				`${url}/api/me/check-in`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						locationCode: result.ScanResult,
					}),
				},
			)

			await storage.removeBooking()
			showToast(`Assigned to spot ${data.assignedSlotCode}`, "success")
			setTimeout(() => navigate({ to: "/dashboard" }), 1500)
		} catch (err) {
			showToast(
				err instanceof Error ? err.message : "Could not check in. Try again.",
				"error",
			)
			setProcessing(false)
		}
	}

	function stopWebCamera() {
		stoppedRef.current = true
		if (scanFrameRef.current !== null) {
			cancelAnimationFrame(scanFrameRef.current)
			scanFrameRef.current = null
		}
		streamRef.current?.getTracks().forEach((track) => track.stop())
		streamRef.current = null
		setWebCameraActive(false)
		setScanning(false)
	}

	async function startWebScan() {
		setCameraError("")
		setWebFallback(false)
		setScanning(true)
		setWebCameraActive(true)
		stoppedRef.current = false

		const BarcodeDetectorCtor = (window as unknown as {
			BarcodeDetector?: new (options?: { formats?: string[] }) => {
				detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>
			}
		}).BarcodeDetector

		if (!BarcodeDetectorCtor) {
			setCameraError("This browser does not support QR detection. Use Chrome on Android or enter the parking code manually.")
			setWebFallback(true)
			setWebCameraActive(false)
			setScanning(false)
			return
		}

		if (!navigator.mediaDevices?.getUserMedia) {
			setCameraError("Camera access is not available in this browser. Enter the parking code manually.")
			setWebFallback(true)
			setWebCameraActive(false)
			setScanning(false)
			return
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: { ideal: "environment" } },
				audio: false,
			})
			streamRef.current = stream
			await new Promise((resolve) => requestAnimationFrame(resolve))

			const video = videoRef.current
			if (!video) {
				throw new Error("Scanner video is not ready.")
			}

			video.srcObject = stream
			await video.play()

			const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] })
			const scan = async () => {
				if (stoppedRef.current || processing) return

				try {
					const codes = await detector.detect(video)
					const value = codes.find((code) => code.rawValue)?.rawValue
					if (value) {
						await handleScanResult({ ScanResult: value, format: 17 })
						return
					}
				} catch {
					// Keep scanning. Some frames fail while the camera is focusing.
				}

				scanFrameRef.current = requestAnimationFrame(scan)
			}

			scanFrameRef.current = requestAnimationFrame(scan)
		} catch (err) {
			stopWebCamera()
			const message = err instanceof Error ? err.message : "Camera permission denied."
			setCameraError(
				`${message} If you opened this over HTTP in a browser, Chrome may block camera access unless the page is HTTPS.`,
			)
			setWebFallback(true)
		}
	}

	async function startScan() {
		try {
			const core = await import("@capacitor/core")
			if (!core.Capacitor.isNativePlatform()) {
				await startWebScan()
				return
			}

			const mod = await import("@capacitor/barcode-scanner")
			const { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHintALLOption } = mod

			setScanning(true)
			const result = await CapacitorBarcodeScanner.scanBarcode({
				hint: CapacitorBarcodeScannerTypeHintALLOption.ALL,
				scanInstructions: "Point at the entrance QR code",
				scanText: "Scanning…",
				cameraDirection: 1,
			})

			if (result.ScanResult) {
				await handleScanResult(result)
			} else {
				navigate({ to: "/dashboard" })
			}
		} catch (err) {
			setCameraError(err instanceof Error ? err.message : "Camera scanner failed.")
			setWebFallback(true)
			setScanning(false)
		}
	}

	useEffect(() => {
		storage.getApiUrl().then((url) => {
			if (!url) {
				navigate({ to: "/setup" })
				return
			}
			setApiUrl(url)
			startScan()
		})

		return () => stopWebCamera()
	}, [])

	if (webCameraActive) {
		return (
			<div className="min-h-dvh bg-base-100 flex flex-col">
				<Toast {...toast} />

				<div
					className="flex items-center justify-between px-5"
					style={{ paddingTop: "calc(1.5rem + var(--safe-top))" }}
				>
					<h1 className="text-xl font-semibold text-white">Scan QR code</h1>
					<button
						type="button"
						onClick={() => {
							stopWebCamera()
							navigate({ to: "/dashboard" })
						}}
						className="text-[13px] font-medium text-base-content/40 hover:text-white transition-colors"
					>
						Close
					</button>
				</div>

				<div className="flex-1 flex flex-col items-center justify-center px-5 space-y-5">
					<div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-base-content/10 bg-black aspect-[3/4]">
						<video
							ref={videoRef}
							className="h-full w-full object-cover"
							playsInline
							muted
						/>
						<div className="absolute inset-8 rounded-2xl border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
					</div>
					<p className="max-w-sm text-center text-[13px] text-base-content/50">
						Point the camera at the Parking in dinajpur QR code.
					</p>
					<PrimaryButton onClick={() => { stopWebCamera(); setWebFallback(true) }}>
						Enter code manually
					</PrimaryButton>
				</div>
			</div>
		)
	}

	if (scanning && !webFallback) {
		return (
			<div className="min-h-dvh bg-base-100 flex flex-col items-center justify-center space-y-4">
				<Toast {...toast} />
				<ScanLine className="w-10 h-10 text-white animate-pulse" />
				<p className="text-[15px] font-medium text-base-content/50">Scanning…</p>
				<button
					type="button"
					onClick={() => navigate({ to: "/dashboard" })}
					className="text-[13px] font-medium text-base-content/30 underline underline-offset-4 hover:text-base-content/50 transition-colors mt-4"
				>
					Cancel
				</button>
			</div>
		)
	}

	return (
		<div className="min-h-dvh bg-base-100 flex flex-col">
			<Toast {...toast} />

			<div
				className="flex items-center justify-between px-5"
				style={{ paddingTop: "calc(1.5rem + var(--safe-top))" }}
			>
				<h1 className="text-xl font-semibold text-white">Scan QR code</h1>
				<button
					type="button"
					onClick={() => navigate({ to: "/dashboard" })}
					className="text-[13px] font-medium text-base-content/40 hover:text-white transition-colors"
				>
					Close
				</button>
			</div>

			<div className="flex-1 flex flex-col items-center justify-center px-5 space-y-6">
				{webFallback ? (
					<div className="text-center space-y-6 w-full max-w-sm">
						<div className="space-y-2">
							<p className="text-[15px] font-medium text-base-content/50">
								{cameraError || "Camera scanning is not available here."}
							</p>
							<p className="text-[13px] text-base-content/30">
								Enter the location code from the entrance sign instead.
							</p>
						</div>
						<ManualEntry onSubmit={handleScanResult} processing={processing} />
					</div>
				) : (
					<div className="text-center space-y-4">
						<p className="text-[15px] font-medium text-base-content/50">
							Camera permission required.
						</p>
						<button
							type="button"
							onClick={startScan}
							className="text-[13px] font-medium text-white underline underline-offset-4"
						>
							Try again
						</button>
					</div>
				)}
			</div>
		</div>
	)
}

function ManualEntry({
	onSubmit,
	processing,
}: {
	onSubmit: (result: ScanResult) => void
	processing: boolean
}) {
	const [code, setCode] = useState("")

	return (
		<div className="w-full space-y-3">
			<div className="space-y-2">
				<label className="text-[13px] font-medium text-base-content/40">Location code</label>
				<Field
					value={code}
					onChange={(e) => setCode(e.target.value)}
					placeholder="Enter code"
				/>
			</div>
			<PrimaryButton
				disabled={!code.trim() || processing}
				onClick={() => onSubmit({ ScanResult: code.trim(), format: 17 })}
			>
				{processing ? "Checking in…" : "Check in"}
			</PrimaryButton>
		</div>
	)
}
