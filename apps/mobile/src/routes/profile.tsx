import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { requestJson } from "#/lib/api"
import { storage } from "#/lib/storage"
import type { User } from "#/lib/types"
import { PageShell, Heading, Field, PrimaryButton, Toast } from "#/components/ui"

export const Route = createFileRoute("/profile")({
	component: ProfileScreen,
})

function ProfileScreen() {
	const navigate = useNavigate()
	const [apiUrl, setApiUrl] = useState("")
	const [form, setForm] = useState({
		name: "",
		phone: "",
		licenseNumber: "",
		vehicleNumber: "",
	})
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState("")
	const [toast, setToast] = useState({ message: "", type: "success" as const, visible: false })

	useEffect(() => {
		storage.getApiUrl().then((url) => {
			if (!url) { navigate({ to: "/setup" }); return }
			setApiUrl(url)
		})
		storage.getUser<User>().then((user) => {
			if (user) navigate({ to: "/dashboard" })
		})
	}, [navigate])

	function showToast(message: string, type: "info" | "success" | "error" = "success") {
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
			const user = await requestJson<User>(`${apiUrl}/api/users`, {
				method: "POST",
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

	return (
		<PageShell>
			<Toast {...toast} />

			<div className="space-y-8 pt-8">
				<div className="space-y-3">
					<Heading size="xl">Register your vehicle</Heading>
					<p className="text-[15px] text-base-content/50 leading-relaxed">
						Add your details to enable parking access and receive alerts.
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
						{saving ? "Registering…" : "Register vehicle"}
					</PrimaryButton>
				</div>
			</div>
		</PageShell>
	)
}
