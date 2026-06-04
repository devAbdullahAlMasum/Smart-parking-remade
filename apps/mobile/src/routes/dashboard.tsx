import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { requestJson } from "#/lib/api"
import { storage } from "#/lib/storage"
import { createRealtimeClient } from "#/lib/realtime"
import type { User, StatusData } from "#/lib/types"
import {
	PageShell,
	Card,
	Label,
	Heading,
	Stat,
	InfoRow,
	SecondaryButton,
	TabBar,
	ConfirmModal,
	Toast,
} from "#/components/ui"
import { Loader2 } from "lucide-react"

export const Route = createFileRoute("/dashboard")({
	component: DashboardScreen,
})

function formatTime(iso: string) {
	return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function DashboardScreen() {
	const navigate = useNavigate()
	const [user, setUser] = useState<User | null>(null)
	const [apiUrl, setApiUrl] = useState("")
	const [statusData, setStatusData] = useState<StatusData | undefined>(undefined)
	const [activeTab, setActiveTab] = useState("dashboard")
	const [toast, setToast] = useState({ message: "", type: "info" as const, visible: false })
	const [confirmModal, setConfirmModal] = useState({
		open: false,
		title: "",
		message: "",
		danger: false,
		onConfirm: () => {},
	})
	const alertedRef = useRef(new Set<number>())

	function showToast(message: string, type: "info" | "success" | "error" | "warning" = "info") {
		setToast({ message, type, visible: true })
		setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3500)
	}

	useEffect(() => {
		Promise.all([storage.getApiUrl(), storage.getUser<User>()]).then(
			([url, u]) => {
				if (!url) { navigate({ to: "/setup" }); return }
				if (!u) { navigate({ to: "/auth" }); return }
				setApiUrl(url)
				setUser(u)
			},
		)
	}, [navigate])

	useEffect(() => {
		if (!apiUrl || !user) return

		let mounted = true

		async function refresh() {
			try {
				const data = await requestJson<StatusData>(
					`${apiUrl}/api/users/${user!.id}/status`,
				)
				if (mounted) setStatusData(data)
			} catch (err) {
				if (mounted) console.warn(err)
			}
		}

		refresh()

		const rt = createRealtimeClient(apiUrl, user.id)
		rt.subscribe(refresh)

		const onVisibility = () => {
			if (document.visibilityState === "visible") refresh()
		}
		document.addEventListener("visibilitychange", onVisibility)

		return () => {
			mounted = false
			rt.unsubscribe(refresh)
			rt.close()
			document.removeEventListener("visibilitychange", onVisibility)
		}
	}, [apiUrl, user])

	const session = statusData?.session ?? null
	const lockdown = statusData?.lockdown ?? false

	useEffect(() => {
		if (!session || !apiUrl) return

		if (session.status === "departing" && !lockdown && !alertedRef.current.has(session.id)) {
			alertedRef.current.add(session.id)
			setConfirmModal({
				open: true,
				title: "Your vehicle is moving",
				message:
					"Your car has left the parking spot. If this wasn't you, lock the gate immediately to prevent unauthorized exit.",
				danger: true,
				onConfirm: async () => {
					try {
						await requestJson(`${apiUrl}/api/security/lockdown`, {
							method: "POST",
						})
						showToast("Gate locked.", "warning")
					} catch (err) {
						showToast(
							err instanceof Error ? err.message : "Failed to lock gate.",
							"error",
						)
					}
					setConfirmModal((m) => ({ ...m, open: false }))
				},
			})
		}

		if (session.status === "parked") {
			alertedRef.current.clear()
		}
	}, [session, lockdown, apiUrl])

	if (lockdown) {
		navigate({ to: "/lockdown" })
		return null
	}

	if (!user || !apiUrl) return null

	return (
		<PageShell withTabs>
			<Toast {...toast} />
			<ConfirmModal
				{...confirmModal}
				confirmLabel="Lock gate"
				cancelLabel="It was me"
				onCancel={() => setConfirmModal((m) => ({ ...m, open: false }))}
			/>

			{activeTab === "dashboard" ? (
				<ParkingView
					user={user}
					session={statusData?.session ?? null}
					statusData={statusData}
					onScan={() => navigate({ to: "/scanner" })}
				/>
			) : (
				<AccountView
					user={user}
					onEditProfile={async () => {
						await storage.removeUser()
						navigate({ to: "/profile" })
					}}
					onSignOut={async () => {
						await storage.removeUser()
						navigate({ to: "/auth" })
					}}
					showToast={showToast}
				/>
			)}

			<TabBar activeTab={activeTab} onTabChange={setActiveTab} />
		</PageShell>
	)
}

function ParkingView({
	user,
	session,
	statusData,
	onScan,
}: {
	user: User
	session: StatusData["session"]
	statusData: StatusData | undefined
	onScan: () => void
}) {
	const parked = session?.status === "parked"
	const departing = session?.status === "departing"

	const statusColor = parked
		? "text-success"
		: departing
			? "text-warning"
			: session
				? "text-white"
				: "text-base-content/40"

	const statusLabel = session?.status
		? session.status.charAt(0).toUpperCase() + session.status.slice(1)
		: "Ready"

	return (
		<div className="space-y-6">
			<div className="space-y-1">
				<Label>Smart Parking</Label>
				<Heading size="lg">Hi, {user.name.split(" ")[0]}</Heading>
			</div>

			<Card className="space-y-4">
				<div className="flex items-center justify-between">
					<Label>Status</Label>
					<span className={`text-[13px] font-semibold ${statusColor}`}>
						{statusLabel}
					</span>
				</div>

				{statusData === undefined ? (
					<div className="flex justify-center py-6">
						<Loader2 className="w-5 h-5 text-base-content/30 animate-spin" />
					</div>
				) : session ? (
					<div className="space-y-2">
						<p className={`text-xl font-semibold leading-7 ${statusColor}`}>
							{session.status === "active" &&
								`Drive to spot ${session.slotCode}`}
							{session.status === "parked" &&
								`Parked in ${session.slotCode}`}
							{session.status === "departing" &&
								`Leaving ${session.slotCode}`}
							{session.status === "exited" &&
								`Exited ${session.slotCode}`}
						</p>
						<p className="text-[13px] font-medium text-base-content/40">
							Since {formatTime(session.assignedAt)}
						</p>
					</div>
				) : (
					<div className="space-y-2">
						<p className="text-xl font-semibold text-white">
							No active session
						</p>
						<p className="text-[13px] font-medium text-base-content/40">
							Scan the QR code at the entrance to park.
						</p>
					</div>
				)}
			</Card>

			<div className="flex gap-px">
				<Stat label="Vehicle" value={user.vehicleNumber} />
				<Stat label="Status" value={session ? "Active" : "Idle"} />
			</div>

			<button
				type="button"
				onClick={onScan}
				className="w-full h-14 bg-white text-base-100 text-[15px] font-semibold tracking-tight hover:opacity-90 active:opacity-80 transition-opacity"
			>
				Scan to park
			</button>
		</div>
	)
}

function AccountView({
	user,
	onEditProfile,
	onSignOut,
	showToast,
}: {
	user: User
	onEditProfile: () => void
	onSignOut: () => void
	showToast: (msg: string, type: "info" | "success" | "error") => void
}) {
	const initials = user.name
		.split(" ")
		.map((p) => p[0])
		.join("")
		.slice(0, 2)
		.toUpperCase()

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-4">
				<div className="w-14 h-14 bg-white text-base-100 flex items-center justify-center flex-shrink-0">
					<span className="text-lg font-semibold">{initials}</span>
				</div>
				<div className="flex-1 min-w-0">
					<h2 className="text-xl font-semibold text-white truncate">
						{user.name}
					</h2>
					<p className="text-[13px] font-medium text-base-content/40 truncate">
						{user.vehicleNumber}
					</p>
				</div>
			</div>

			<Card>
				<InfoRow label="Phone" value={user.phone} />
				<InfoRow label="License" value={user.licenseNumber} />
				<InfoRow label="Vehicle" value={user.vehicleNumber} />
			</Card>

			<div className="space-y-2">
				<SecondaryButton
					onClick={async () => {
						await storage.setUser(user)
						showToast("Account saved.", "success")
					}}
				>
					Save account
				</SecondaryButton>
				<SecondaryButton onClick={onEditProfile}>
					Edit profile
				</SecondaryButton>
				<SecondaryButton onClick={onSignOut}>
					Switch account
				</SecondaryButton>
				<SecondaryButton danger onClick={onSignOut}>
					Sign out
				</SecondaryButton>
			</div>
		</div>
	)
}
