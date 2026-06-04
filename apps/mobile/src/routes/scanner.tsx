import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { requestJson } from "#/lib/api"
import { storage } from "#/lib/storage"
import type { User } from "#/lib/types"
import { Toast, Field, PrimaryButton } from "#/components/ui"
import { ScanLine } from "lucide-react"

type ScanResult = { ScanResult: string; format: number }

export const Route = createFileRoute("/scanner")({
	component: ScannerScreen,
})

function ScannerScreen() {
	const navigate = useNavigate()
	const [scanning, setScanning] = useState(false)
	const [processing, setProcessing] = useState(false)
	const [toast, setToast] = useState({ message: "", type: "info" as const, visible: false })
	const [webFallback, setWebFallback] = useState(false)

	function showToast(message: string, type: "info" | "success" | "error" = "info") {
		setToast({ message, type, visible: true })
		setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3500)
	}

	async function handleScanResult(result: ScanResult) {
		if (processing) return
		setProcessing(true)

		try {
			const apiUrl = await storage.getApiUrl()
			const user = await storage.getUser<User>()

			if (!apiUrl || !user) {
				navigate({ to: "/setup" })
				return
			}

			const data = await requestJson<{ assignedSlotCode: string }>(
				`${apiUrl}/api/check-in`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						userId: user.id,
						locationCode: result.ScanResult,
					}),
				},
			)

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

	async function startScan() {
		try {
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
		} catch {
			setWebFallback(true)
			setScanning(false)
		}
	}

	useEffect(() => {
		startScan()
	}, [])

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
								Camera scanning is available in the installed app.
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
