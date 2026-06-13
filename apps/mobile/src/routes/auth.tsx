import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"
import { storage } from "#/lib/storage"
import { createWebAuthClient, getAuthSession } from "#/lib/auth"
import { PageShell, Heading, Field, PrimaryButton, GhostLink } from "#/components/ui"

export const Route = createFileRoute("/auth")({
	component: AuthScreen,
})

function AuthScreen() {
	const navigate = useNavigate()
	const [apiUrl, setApiUrl] = useState("")
	const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in")
	const [name, setName] = useState("")
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState("")

	const authClient = useMemo(
		() => (apiUrl ? createWebAuthClient(apiUrl) : null),
		[apiUrl],
	)

	useEffect(() => {
		storage.getApiUrl().then((url) => {
			if (!url) {
				navigate({ to: "/setup" })
				return
			}
			setApiUrl(url)
		})
	}, [navigate])

	async function submit() {
		if (!authClient) return
		setError("")

		function reportAuthLog(message: string, extra: Record<string, unknown> = {}) {
			void fetch(`${apiUrl}/api/client-log`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					level: "error",
					message,
					url: `${apiUrl}/api/auth/${mode === "sign-up" ? "sign-up/email" : "sign-in/email"}`,
					method: "POST",
					...extra,
				}),
			}).catch(() => undefined)
		}

		if (!email.trim() || !password) {
			setError("Enter your email and password.")
			return
		}

		if (mode === "sign-up" && !name.trim()) {
			setError("Enter your name.")
			return
		}

		setSubmitting(true)
		try {
			const result =
				mode === "sign-up"
					? await authClient.signUp.email({
							name: name.trim(),
							email: email.trim(),
							password,
						})
					: await authClient.signIn.email({
							email: email.trim(),
							password,
						})

			if (result.error) {
				reportAuthLog("Better Auth returned an error", { authError: result.error })
			}

			const session = await getAuthSession(apiUrl)
			if (session.error || !session.data?.user) {
				reportAuthLog("Better Auth login succeeded but no session was found", {
					sessionError: session.error,
				})
			}

			navigate({ to: "/profile" })
		} catch (err) {
			reportAuthLog("Better Auth request threw", {
				error: err instanceof Error ? err.message : String(err),
			})
			navigate({ to: "/profile" })
		} finally {
			setSubmitting(false)
		}
	}

	if (!apiUrl) return null

	return (
		<PageShell>
			<div className="space-y-8 pt-8">
				<div className="space-y-3">
					<Heading size="xl">
						{mode === "sign-up" ? "Create account" : "Sign in"}
					</Heading>
					<p className="text-[15px] text-base-content/50 leading-relaxed">
						{mode === "sign-up"
							? "Set up your account to manage parking and receive alerts."
							: "Sign in to manage your parking and vehicle."}
					</p>
				</div>

				<div className="flex border border-base-content/10">
					<button
						type="button"
						onClick={() => { setMode("sign-in"); setError("") }}
						className={`flex-1 h-10 text-[13px] font-semibold transition-colors ${
							mode === "sign-in"
								? "bg-white text-base-100"
								: "text-base-content/40 hover:text-base-content/60"
						}`}
					>
						Sign in
					</button>
					<button
						type="button"
						onClick={() => { setMode("sign-up"); setError("") }}
						className={`flex-1 h-10 text-[13px] font-semibold transition-colors ${
							mode === "sign-up"
								? "bg-white text-base-100"
								: "text-base-content/40 hover:text-base-content/60"
						}`}
					>
						Sign up
					</button>
				</div>

				<div className="space-y-4">
					{mode === "sign-up" && (
						<div className="space-y-2">
							<label className="text-[13px] font-medium text-base-content/40">Name</label>
							<Field
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Your full name"
							/>
						</div>
					)}

					<div className="space-y-2">
						<label className="text-[13px] font-medium text-base-content/40">Email</label>
						<Field
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="you@example.com"
							type="email"
							autoCapitalize="off"
							autoCorrect="off"
						/>
					</div>

					<div className="space-y-2">
						<label className="text-[13px] font-medium text-base-content/40">Password</label>
						<Field
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="Enter password"
							type="password"
							autoCapitalize="off"
						/>
					</div>

					{error && (
						<p className="text-[13px] font-medium text-error">{error}</p>
					)}

					<PrimaryButton onClick={submit} disabled={submitting}>
						{submitting
							? "Please wait…"
							: mode === "sign-up"
								? "Create account"
								: "Sign in"}
					</PrimaryButton>

					<div className="flex justify-center pt-2">
						<GhostLink
							onClick={() => setMode(mode === "sign-up" ? "sign-in" : "sign-up")}
						>
							{mode === "sign-up"
								? "Already have an account? Sign in"
								: "Need an account? Sign up"}
						</GhostLink>
					</div>
				</div>
			</div>
		</PageShell>
	)
}
