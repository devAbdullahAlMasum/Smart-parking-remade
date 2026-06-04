import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { storage } from "#/lib/storage"
import { PageShell } from "#/components/ui"
import { Loader2 } from "lucide-react"

export const Route = createFileRoute("/")({
	component: IndexRedirect,
})

function IndexRedirect() {
	const navigate = useNavigate()
	const [checking, setChecking] = useState(true)

	useEffect(() => {
		(async () => {
			const apiUrl = await storage.getApiUrl()

			if (!apiUrl) {
				navigate({ to: "/setup" })
				return
			}

			const user = await storage.getUser()

			if (!user) {
				navigate({ to: "/auth" })
				return
			}

			navigate({ to: "/dashboard" })
			setChecking(false)
		})()
	}, [navigate])

	if (!checking) return null

	return (
		<PageShell>
			<div className="flex items-center justify-center min-h-[60dvh]">
				<Loader2 className="w-10 h-10 text-accent animate-spin" />
			</div>
		</PageShell>
	)
}
