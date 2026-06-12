import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"
import { requestJson } from "#/lib/api"
import { createWebAuthClient } from "#/lib/auth"
import { storage } from "#/lib/storage"
import type { User } from "#/lib/types"
import { PageShell, Heading, Field, PrimaryButton, SecondaryButton, Toast } from "#/components/ui"

export const Route = createFileRoute("/profile")({
	component: ProfileScreen,
})

type ToastType = "info" | "success" | "error"

function ProfileScreen() {
	const navigate = useNavigate()
	const [apiUrl, setApiUrl] = useState("")
	const [authEmail, setAuthEmail] = useState("")
	const [form, setForm] = useState({
		name: "",
		phone: "",
		licenseNumber: "",
		vehicleNumber: "",
	})
	const [saving, setSaving] = useState(false)
	const [signingOut, setSigningOut] = useState(false)
	const [error, setError] = useState("")
	const [toast, setToast] = useState<{ message: string; type: ToastType; visible: boolean }>({
		message: "",
		type: "success",
		visible: false,
	})
	const authClient = useMemo(
		() => (apiUrl ? createWebAuthClient(apiUrl) : null),
		[apiUrl],
	)

	useEffect(() => {
		storage.getApiUrl().then(async (url) => {
			if (!url) { navigate({ to: "/setup" }); return }
			setApiUrl(url)

			const client = createWebAuthClient(url)
			const session = await client.getSession()
			if (session.error || !session.data?.user) {
				navigate({ to: "/auth" })
				return
			}

			const authUser = session.data.user
			setAuthEmail(authUser.email)
			const data = await requestJson<{ authUser: unknown; driver: User | null }>(`${url}/api/me`)
			if (data.driver) {
				setForm({
					name: data.driver.name,
					phone: data.driver.phone,
					licenseNumber: data.driver.licenseNumber,
					vehicleNumber: data.driver.vehicleNumber,
				})
				await storage.setUser(data.driver)
			} else {
				setForm((prev) => ({ ...prev, name: authUser.name || "" }))
			}
		})
	}, [navigate])

	function showToast(message: string, type: ToastType = "success") {
		setToast({ message, type, visible: true })
		setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000)
	}

	function update(field: string, value: string) {
		setForm((prev) => ({ ...prev, [field]: value }))
		setError("")
	}

	async function save() {
		setError("")
		const payload = {
			name: form.name.trim(),
			phone: form.phone.trim(),
			licenseNumber: form.licenseNumber.trim(),
			vehicleNumber: form.vehicleNumber.trim(),
		}

		if (Object.values(payload).some((v) => !v)) {
			setError("All fields are required.")
			return
		}

		setSaving(true)
		try {
			const user = await requestJson<User>(`${apiUrl}/api/me`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			})

			await storage.setUser(user)
			showToast("Vehicle registered.")
			setTimeout(() => navigate({ to: "/dashboard" }), 500)
		} catch (err) {
			setError(err instanceof Error ? err.message : "Registration failed. Try again.")
		} finally {
			setSaving(false)
		}
	}

	async function signOut() {
		if (!authClient) return
		setSigningOut(true)
		try {
			await authClient.signOut()
			await storage.removeUser()
			await storage.removeBooking()
			navigate({ to: "/auth" })
		} finally {
			setSigningOut(false)
		}
	}

	return (
		<PageShell>
			<Toast {...toast} />

			<div className="space-y-8 pt-8">
				<div className="space-y-3">
					<Heading size="xl">Account</Heading>
					<p className="text-[15px] text-base-content/50 leading-relaxed">
						{authEmail ? `Signed in as ${authEmail}. ` : ""}Keep your real driver and vehicle details up to date.
					</p>
				</div>

				<div className="space-y-4">
					<div className="space-y-2">
						<label className="text-[13px] font-medium text-base-content/40">Full name</label>
						<Field
							value={form.name}
							onChange={(e) => update("name", e.target.value)}
							placeholder="Your name"
						/>
					</div>

					<div className="space-y-2">
						<label className="text-[13px] font-medium text-base-content/40">Phone number</label>
						<Field
							value={form.phone}
							onChange={(e) => update("phone", e.target.value)}
							placeholder="+880 1XXX XXXXXX"
							type="tel"
						/>
					</div>

					<div className="space-y-2">
						<label className="text-[13px] font-medium text-base-content/40">License number</label>
						<Field
							value={form.licenseNumber}
							onChange={(e) => update("licenseNumber", e.target.value)}
							placeholder="Your driving license"
						/>
					</div>

					<div className="space-y-2">
						<label className="text-[13px] font-medium text-base-content/40">Vehicle plate</label>
						<Field
							value={form.vehicleNumber}
							onChange={(e) => update("vehicleNumber", e.target.value)}
							placeholder="e.g. DHAKA METRO GA 12-3456"
						/>
					</div>

					{error && (
						<p className="text-[13px] font-medium text-error">{error}</p>
					)}

					<PrimaryButton onClick={save} disabled={saving}>
						{saving ? "Saving…" : "Save account"}
					</PrimaryButton>

					<SecondaryButton danger onClick={signOut} disabled={signingOut}>
						{signingOut ? "Signing out…" : "Log out"}
					</SecondaryButton>
				</div>
			</div>
		</PageShell>
	)
}
