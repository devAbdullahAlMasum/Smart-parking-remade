import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { normalizeBaseUrl } from "#/lib/api"
import { storage } from "#/lib/storage"
import { PageShell, Heading, Field, PrimaryButton } from "#/components/ui"

export const Route = createFileRoute("/setup")({
	component: SetupScreen,
})

function SetupScreen() {
	const navigate = useNavigate()
	const defaultServiceAddress =
		typeof window === "undefined" ? "http://100.85.28.79:3000" : window.location.origin
	const [input, setInput] = useState(defaultServiceAddress)
	const [error, setError] = useState("")

	async function connect() {
		const normalized = normalizeBaseUrl(input)
		if (!normalized) {
			setError("Enter your parking service address to continue.")
			return
		}

		await storage.setApiUrl(normalized)
		navigate({ to: "/auth" })
	}

	return (
		<PageShell>
			<div className="flex flex-col justify-center min-h-[80dvh] space-y-8">
				<div className="space-y-3">
					<Heading size="xl">Smart Parking</Heading>
					<p className="text-[15px] text-base-content/50 leading-relaxed">
						Connect to your parking service to get started.
					</p>
				</div>

				<div className="space-y-4">
					<div className="space-y-2">
						<label className="text-[13px] font-medium text-base-content/40">
							Service address
						</label>
						<Field
							value={input}
							onChange={(e) => {
								setInput(e.target.value)
								setError("")
							}}
							placeholder={defaultServiceAddress}
							autoCapitalize="off"
							autoCorrect="off"
							spellCheck={false}
							type="url"
						/>
					</div>

					{error && (
						<p className="text-[13px] font-medium text-error">{error}</p>
					)}

					<PrimaryButton onClick={connect}>Connect</PrimaryButton>
				</div>
			</div>
		</PageShell>
	)
}
