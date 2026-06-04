import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { requestJson } from "#/lib/api"
import { storage } from "#/lib/storage"
import { Toast } from "#/components/ui"

export const Route = createFileRoute("/lockdown")({
	component: LockdownScreen,
})

function LockdownScreen() {
	const navigate = useNavigate()
	const [apiUrl, setApiUrl] = useState("")
	const [unlocking, setUnlocking] = useState(false)
	const [toast, setToast] = useState({ message: "", type: "info" as const, visible: false })

	function showToast(message: string, type: "info" | "success" | "error" = "info") {
		setToast({ message, type, visible: true })
		setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3500)
	}

	useEffect(() => {
		storage.getApiUrl().then((url) => {
			if (!url) { navigate({ to: "/setup" }); return }
			setApiUrl(url)
		})
	}, [navigate])

	async function unlock() {
		if (!apiUrl) return
		setUnlocking(true)
		try {
			await requestJson(`${apiUrl}/api/security/unlock`, { method: "POST" })
			showToast("Gate unlocked.", "success")
			setTimeout(() => navigate({ to: "/dashboard" }), 1000)
		} catch (err) {
			showToast(
				err instanceof Error ? err.message : "Could not unlock. Try again.",
				"error",
			)
		} finally {
			setUnlocking(false)
		}
	}

	return (
		<div className="min-h-dvh bg-error flex flex-col">
			<Toast {...toast} />

			<div className="flex-1 flex flex-col items-center justify-center px-6 space-y-10">
				<div className="space-y-4 text-center max-w-sm">
					<h1 className="text-[32px] font-semibold text-white tracking-tight">
						Gate locked
					</h1>
					<p className="text-[15px] font-medium text-white/60 leading-relaxed">
						The parking gate has been secured. No vehicles can enter or exit until the gate is unlocked.
					</p>
				</div>

				<button
					type="button"
					onClick={unlock}
					disabled={unlocking}
					className="w-full max-w-sm h-14 bg-white text-error text-[15px] font-semibold hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-40"
				>
					{unlocking ? "Unlocking…" : "Unlock gate"}
				</button>
			</div>
		</div>
	)
}
