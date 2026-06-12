import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ArrowRight,
	Bell,
	CalendarPlus,
	Car,
	ChevronRight,
	Clock3,
	CreditCard,
	FileText,
	History,
	Lock,
	MapPin,
	QrCode,
	ReceiptText,
	Settings,
	ShieldAlert,
	Star,
	Timer,
	UserRound,
	Wallet,
	X,
	Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	Card,
	ConfirmModal,
	Field,
	InfoRow,
	Label,
	PageShell,
	PrimaryButton,
	SecondaryButton,
	TabBar,
	Toast,
} from "#/components/ui";
import { requestJson } from "#/lib/api";
import { createWebAuthClient } from "#/lib/auth";
import { createRealtimeClient } from "#/lib/realtime";
import { storage } from "#/lib/storage";
import type { Parking, StatusData, User } from "#/lib/types";

export const Route = createFileRoute("/dashboard")({
	component: DashboardScreen,
});

type ToastType = "info" | "success" | "error" | "warning";
type PendingBooking = {
	parkingId: number;
	parkingName: string;
	parkingCode: string;
	createdAt: string;
};
type SheetType =
	| "booking"
	| "receipt"
	| "vehicle"
	| "driver"
	| "payment"
	| "plan"
	| "security"
	| null;

const defaultParking: Parking = {
	id: 1,
	name: "Parking in dinajpur",
	code: "DINJPUR-PARKING-1",
	updatedAt: new Date().toISOString(),
};

const settingsSheetByLabel: Record<string, Exclude<SheetType, null>> = {
	"Vehicle Data": "vehicle",
	"Driver data": "driver",
	"Payment settings": "payment",
	"Plan settings": "plan",
};

function DashboardScreen() {
	const navigate = useNavigate();
	const [user, setUser] = useState<User | null>(null);
	const [apiUrl, setApiUrl] = useState("");
	const [statusData, setStatusData] = useState<StatusData | undefined>(
		undefined,
	);
	const [parkings, setParkings] = useState<Parking[]>([]);
	const [activeTab, setActiveTab] = useState("home");
	const [profileMode, setProfileMode] = useState<"profile" | "settings">(
		"profile",
	);
	const [booking, setBooking] = useState<PendingBooking | null>(null);
	const [sheet, setSheet] = useState<SheetType>(null);
	const [toast, setToast] = useState<{
		message: string;
		type: ToastType;
		visible: boolean;
	}>({
		message: "",
		type: "info",
		visible: false,
	});
	const [confirmModal, setConfirmModal] = useState({
		open: false,
		title: "",
		message: "",
		danger: false,
		onConfirm: () => {},
	});
	const alertedRef = useRef(new Set<number>());

	const session =
		statusData?.session && statusData.session.status !== "exited"
			? statusData.session
			: null;
	const lockdown = statusData?.lockdown ?? false;
	const activeVehicle = user?.vehicleNumber ?? "";
	const parking = parkings[0] ?? defaultParking;

	function showToast(message: string, type: ToastType = "info") {
		setToast({ message, type, visible: true });
		setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3500);
	}

	useEffect(() => {
		let mounted = true;

		storage.getApiUrl().then(async (url) => {
			if (!url) {
				navigate({ to: "/setup" });
				return;
			}

			setApiUrl(url);
			const authClient = createWebAuthClient(url);
			const session = await authClient.getSession();
			if (session.error || !session.data?.user) {
				navigate({ to: "/auth" });
				return;
			}

			const [data, parkingData] = await Promise.all([
				requestJson<{ driver: User | null }>(`${url}/api/me`),
				requestJson<Parking[]>(`${url}/api/parkings`),
			]);
			if (!mounted) return;
			setParkings(parkingData);
			setBooking(await storage.getBooking<PendingBooking>());
			if (!data.driver) {
				navigate({ to: "/profile" });
				return;
			}

			await storage.setUser(data.driver);
			setUser(data.driver);
		});

		return () => {
			mounted = false;
		};
	}, [navigate]);

	useEffect(() => {
		if (!apiUrl || !user) return;
		const currentUser = user;

		let mounted = true;

		async function refresh() {
			try {
				const data = await requestJson<StatusData>(
					`${apiUrl}/api/me/status`,
				);
				if (mounted) setStatusData(data);
			} catch (err) {
				if (mounted) console.warn(err);
			}
		}

		refresh();
		const rt = createRealtimeClient(apiUrl, currentUser.id);
		const showVehicleAlert = (alert: { sessionId: number; title: string; body: string }) => {
			if (alertedRef.current.has(alert.sessionId)) return;
			alertedRef.current.add(alert.sessionId);
			if ("Notification" in window && Notification.permission === "granted") {
				new Notification(alert.title, { body: alert.body });
			} else if ("Notification" in window && Notification.permission === "default") {
				Notification.requestPermission().catch(() => undefined);
			}
			setConfirmModal({
				open: true,
				title: alert.title,
				message: `${alert.body} Choose It's me if you are leaving, or It's not me to lock the gate immediately.`,
				danger: true,
				onConfirm: async () => {
					try {
						await requestJson(`${apiUrl}/api/security/lockdown`, { method: "POST" });
						showToast("Gate locked.", "warning");
					} catch (err) {
						showToast(err instanceof Error ? err.message : "Failed to lock gate.", "error");
					}
					setConfirmModal((m) => ({ ...m, open: false }));
				},
			});
			refresh();
		};
		rt.subscribe(refresh);
		rt.subscribeVehicleMovement(showVehicleAlert);

		const onVisibility = () => {
			if (document.visibilityState === "visible") refresh();
		};
		document.addEventListener("visibilitychange", onVisibility);

		return () => {
			mounted = false;
			rt.unsubscribe(refresh);
			rt.unsubscribeVehicleMovement();
			rt.close();
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, [apiUrl, user]);

	useEffect(() => {
		if (!session) return;
		setBooking(null);
		storage.removeBooking().catch(() => undefined);
	}, [session]);

	useEffect(() => {
		if (!session || !apiUrl) return;

		if (
			session.status === "departing" &&
			!lockdown &&
			!alertedRef.current.has(session.id)
		) {
			alertedRef.current.add(session.id);
			if ("Notification" in window && Notification.permission === "granted") {
				new Notification("Vehicle movement detected", {
					body: "Was this you? Open EmptySpot to confirm or lock the gate.",
				});
			} else if ("Notification" in window && Notification.permission === "default") {
				Notification.requestPermission().catch(() => undefined);
			}
			setConfirmModal({
				open: true,
				title: "Vehicle movement detected",
				message:
					"Your car left its slot. Choose It's me if you are leaving, or It's not me to lock the gate immediately.",
				danger: true,
				onConfirm: async () => {
					try {
						await requestJson(`${apiUrl}/api/security/lockdown`, {
							method: "POST",
						});
						showToast("Gate locked.", "warning");
					} catch (err) {
						showToast(
							err instanceof Error ? err.message : "Failed to lock gate.",
							"error",
						);
					}
					setConfirmModal((m) => ({ ...m, open: false }));
				},
			});
		}

		if (session.status === "parked" || session.status === "exited") alertedRef.current.clear();
	}, [session, lockdown, apiUrl]);

	if (lockdown) {
		navigate({ to: "/lockdown" });
		return null;
	}

	if (!user) return null;

	async function confirmBooking() {
		const pendingBooking = {
			parkingId: parking.id,
			parkingName: parking.name,
			parkingCode: parking.code,
			createdAt: new Date().toISOString(),
		};
		await storage.setBooking(pendingBooking);
		setBooking(pendingBooking);
		setActiveTab("bookings");
		setProfileMode("profile");
		setSheet(null);
		showToast(`Booking created for ${parking.name}.`, "success");
	}

	function cancelBooking() {
		setConfirmModal({
			open: true,
			title: "Cancel booking?",
			message:
				"This will remove your pending booking. You can book again before scanning the entry QR.",
			danger: false,
			onConfirm: async () => {
				await storage.removeBooking();
				setBooking(null);
				setConfirmModal((m) => ({ ...m, open: false }));
				showToast("Booking cancelled.", "success");
			},
		});
	}

	return (
		<PageShell withTabs>
			<Toast {...toast} />
			<ConfirmModal
				{...confirmModal}
				confirmLabel="It's not me"
				cancelLabel="It's me"
				onCancel={async () => {
					setConfirmModal((m) => ({ ...m, open: false }));
					if (!apiUrl) return;
					try {
						await requestJson(`${apiUrl}/api/me/departure/confirm`, { method: "POST" });
						showToast("Departure confirmed.", "success");
					} catch (err) {
						showToast(err instanceof Error ? err.message : "Could not confirm departure.", "error");
					}
				}}
			/>

			<div className="space-y-6">
				{activeTab === "home" && (
					<HomeView
						booking={booking}
						session={session}
						parking={parking}
						vehicle={activeVehicle}
						onNewBooking={() => setSheet("booking")}
						onOpenBookings={() => setActiveTab("bookings")}
					/>
				)}
				{activeTab === "bookings" && (
					<BookingsView
						booking={booking}
						session={session}
						parking={parking}
						vehicle={activeVehicle}
						onNewBooking={() => setSheet("booking")}
						onCancel={cancelBooking}
						onReceipt={() => setSheet("receipt")}
						onScan={() => navigate({ to: "/scanner" })}
					/>
				)}
				{activeTab === "alerts" && (
					<AlertsView onLock={() => setSheet("security")} />
				)}
				{activeTab === "profile" &&
					(profileMode === "settings" ? (
						<SettingsView
							onBack={() => setProfileMode("profile")}
							onSelect={(label) =>
								setSheet(settingsSheetByLabel[label] ?? "driver")
							}
						/>
					) : (
						<ProfileView
							user={user}
							apiUrl={apiUrl}
							onAccount={() => navigate({ to: "/profile" })}
							onSettings={() => setProfileMode("settings")}
						/>
					))}
			</div>

			<TabBar
				activeTab={activeTab}
				onTabChange={(tab) => {
					setActiveTab(tab);
					if (tab !== "profile") setProfileMode("profile");
				}}
			/>

			<AppSheet
				type={sheet}
				user={user}
				vehicle={activeVehicle}
				parking={parking}
				onClose={() => setSheet(null)}
				onLockdown={async () => {
					await requestJson(`${apiUrl}/api/security/lockdown`, { method: "POST" });
					showToast("Gate lockdown enabled.", "warning");
				}}
				onConfirmBooking={confirmBooking}
				onSave={(message) => {
					setSheet(null);
					showToast(message, "success");
				}}
			/>
		</PageShell>
	);
}

function HomeView({
	booking,
	session,
	parking,
	vehicle,
	onNewBooking,
	onOpenBookings,
}: {
	booking: PendingBooking | null;
	session: StatusData["session"];
	parking: Parking;
	vehicle: string;
	onNewBooking: () => void;
	onOpenBookings: () => void;
}) {
	const hasActiveSession = booking || !!session;

	return (
		<div className="space-y-6">
			<section className="space-y-3">
				<Label>Active Session</Label>
				{hasActiveSession ? (
					<Card className="p-4">
						<div className="flex min-w-0 items-center gap-4">
							<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--safety-yellow)] text-[#231b00]">
								<Timer className="h-6 w-6" />
							</div>
							<div className="min-w-0">
								<h2 className="truncate text-lg font-bold text-[var(--text-primary)]">
									{vehicle}
								</h2>
								<p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--safety-yellow)]">
									{session ? "Charged by actual stay time" : `Reserved at ${parking.name}`}
								</p>
							</div>
						</div>
					</Card>
				) : (
					<Card className="p-5">
						<div className="flex items-start gap-4">
							<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-variant)] text-[var(--safety-yellow)]">
								<Car className="h-6 w-6" />
							</div>
							<div>
								<h2 className="text-lg font-bold">No active session</h2>
								<p className="mt-1 text-sm leading-5 text-[var(--text-muted)]">
									Choose {parking.name} or scan the entrance QR to start parking.
								</p>
							</div>
						</div>
					</Card>
				)}
			</section>

			<section className="space-y-3">
				<Label>Registered Parking</Label>
				<div className="space-y-2">
					<LocationCard name={parking.name} level="Main parking area" fullness={0} status="Live" />
				</div>
			</section>

			<div className="grid grid-cols-2 gap-3">
				<PrimaryButton onClick={onNewBooking}>
					<CalendarPlus className="mr-2 h-5 w-5" />
					New
				</PrimaryButton>
				<SecondaryButton onClick={onOpenBookings}>
					<History className="mr-2 h-5 w-5" />
					History
				</SecondaryButton>
			</div>
		</div>
	);
}

function LocationCard({
	name,
	level,
	fullness,
	status,
}: {
	name: string;
	level: string;
	fullness: number;
	status: string;
}) {
	const color =
		fullness > 90
			? "bg-[var(--occupied)]"
			: fullness > 75
				? "bg-[var(--warning)]"
				: "bg-[var(--maintenance)]";

	return (
		<Card className="flex items-center justify-between gap-3 p-4">
			<div className="flex min-w-0 items-center gap-3">
				<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--surface-variant)] text-[var(--text-primary)]">
					<MapPin className="h-5 w-5" />
				</div>
				<div className="min-w-0">
					<p className="truncate text-sm font-bold text-[var(--text-primary)]">
						{name}
					</p>
					<p className="truncate text-[11px] text-[var(--text-muted)]">
						{level}
					</p>
				</div>
			</div>
			<div className="w-24 shrink-0">
				<div className="mb-1 flex justify-between font-mono text-[10px] text-[var(--text-muted)]">
					<span>{fullness}%</span>
					<span>{status}</span>
				</div>
				<div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-variant)]">
					<div
						className={`h-full ${color}`}
						style={{ width: `${fullness}%` }}
					/>
				</div>
			</div>
		</Card>
	);
}

function BookingsView({
	booking,
	session,
	parking,
	vehicle,
	onNewBooking,
	onCancel,
	onReceipt,
	onScan,
}: {
	booking: PendingBooking | null;
	session: StatusData["session"];
	parking: Parking;
	vehicle: string;
	onNewBooking: () => void;
	onCancel: () => void;
	onReceipt: () => void;
	onScan: () => void;
}) {
	const hasActive = booking || !!session;

	return (
		<div className="space-y-5">
			<div className="flex items-center gap-2">
				<span className="h-2 w-2 rounded-full bg-[var(--safety-yellow)]" />
				<h2 className="text-lg font-bold uppercase tracking-[0.12em]">
					Active Session
				</h2>
			</div>

			{hasActive ? (
				<Card className="overflow-hidden">
						<div className="space-y-5 p-5">
						<div className="flex items-start justify-between gap-4">
							<div>
								<Label>Current Location</Label>
								<h3 className="mt-2 text-xl font-bold">
									{parking.name}
								</h3>
								<p className="mt-1 flex items-center gap-2 text-[var(--text-muted)]">
									<MapPin className="h-4 w-4 text-[var(--safety-yellow)]" />
									Assigned slot {session?.slotCode ?? "pending"}
								</p>
							</div>
							<div className="rounded border border-[var(--safety-yellow)]/30 bg-[var(--safety-yellow)]/10 px-3 py-2 font-mono text-[11px] font-bold tracking-[0.12em] text-[var(--safety-yellow)]">
								{parking.code}
							</div>
						</div>

						<div className="border-t border-[var(--outline)] pt-4">
							<InfoRow label="Vehicle" value={vehicle} />
							<InfoRow label="Parking" value={parking.name} />
							<InfoRow label="Parking code" value={parking.code} mono />
							<InfoRow label="Billing" value="Hourly rate, charged when you leave" />
							{booking && !session && <InfoRow label="Booked at" value={new Date(booking.createdAt).toLocaleTimeString()} />}
						</div>
					</div>

					<button
						type="button"
						onClick={onScan}
						className="flex w-full items-center justify-between border-t border-[var(--outline)] bg-[var(--surface-container-high)] p-5 text-left"
					>
						<div className="flex items-center gap-4">
							<div className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-[var(--safety-yellow)] text-[var(--safety-yellow)]">
								<QrCode className="h-8 w-8" />
							</div>
							<div>
								<p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em]">
									Entry pass active
								</p>
								<p className="text-sm text-[var(--text-muted)]">
									Scan the entrance QR at {parking.name}
								</p>
							</div>
						</div>
						<ChevronRight className="h-5 w-5 text-[var(--text-muted)]" />
					</button>
				</Card>
			) : (
				<Card className="p-5 text-center">
					<Clock3 className="mx-auto h-10 w-10 text-[var(--safety-yellow)]" />
					<h3 className="mt-3 text-lg font-bold">No booking yet</h3>
					<p className="mt-1 text-sm text-[var(--text-muted)]">
						Create a booking for Parking in dinajpur before scanning the entrance QR.
					</p>
				</Card>
			)}

			<div className="grid grid-cols-2 gap-3">
				<PrimaryButton onClick={hasActive ? onScan : onNewBooking}>
					<CalendarPlus className="mr-2 h-5 w-5" />
					{hasActive ? "Scan Entry" : "New Booking"}
				</PrimaryButton>
				<SecondaryButton onClick={hasActive ? onReceipt : onScan}>
					{hasActive ? "Receipt" : "Scan Entry"}
				</SecondaryButton>
			</div>
			{hasActive && (
				<SecondaryButton danger onClick={onCancel}>
					{session ? "Close" : "Cancel Booking"}
				</SecondaryButton>
			)}
		</div>
	);
}

function AlertsView({ onLock }: { onLock: () => void }) {
	return (
		<div className="space-y-4">
			<div>
				<Label>Notifications</Label>
				<h2 className="mt-1 text-2xl font-bold">Alerts</h2>
			</div>
			<Card className="p-4">
				<div className="flex gap-3">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--safety-yellow)] text-[#231b00]">
						<Bell className="h-5 w-5" />
					</div>
					<div>
						<h3 className="font-bold">Parking status synced</h3>
						<p className="mt-1 text-sm leading-5 text-[var(--text-muted)]">
							Parking in dinajpur availability was updated moments ago.
						</p>
					</div>
				</div>
			</Card>
			<Card className="p-4">
				<div className="flex gap-3">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--surface-variant)] text-[var(--warning)]">
						<ShieldAlert className="h-5 w-5" />
					</div>
					<div>
						<h3 className="font-bold">Security mode ready</h3>
						<p className="mt-1 text-sm leading-5 text-[var(--text-muted)]">
							Lockdown closes the gate and starts the red warning lights through the parking controller.
						</p>
					</div>
				</div>
			</Card>
			<SecondaryButton onClick={onLock}>
				<Zap className="mr-2 h-5 w-5" />
				Lock gate
			</SecondaryButton>
		</div>
	);
}

function ProfileView({
	user,
	apiUrl,
	onAccount,
	onSettings,
}: {
	user: User;
	apiUrl: string;
	onAccount: () => void;
	onSettings: () => void;
}) {
	const initials = useMemo(
		() =>
			user.name
				.split(" ")
				.map((p) => p[0])
				.join("")
				.slice(0, 2)
				.toUpperCase(),
		[user.name],
	);

	return (
		<div className="relative min-h-[calc(100dvh-9rem)] space-y-6 pb-20">
			<section className="flex flex-col items-center text-center">
				<div className="mb-4 flex h-32 w-32 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-[var(--safety-yellow)] text-[#231b00]">
					<span className="text-4xl font-bold">{initials}</span>
				</div>
				<h2 className="text-3xl font-bold text-[var(--primary,#fff4dc)]">
					{user.name}
				</h2>
				<p className="mt-2 text-lg text-[var(--text-muted)]">
					Authenticated driver
				</p>
				<div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--outline)] bg-[var(--surface-container)] px-4 py-2">
					<Star className="h-4 w-4 fill-[var(--safety-yellow)] text-[var(--safety-yellow)]" />
					<span className="font-mono text-sm font-semibold uppercase text-[var(--text-primary)]">
						Pro Member
					</span>
				</div>
			</section>

			<section className="grid grid-cols-1 gap-4">
				<SecondaryButton onClick={onAccount}>Account and logout</SecondaryButton>

				<Card className="space-y-6 rounded p-6">
					<div className="flex items-center gap-3 border-b border-[var(--outline)] pb-3">
						<FileText className="h-6 w-6 text-[var(--safety-yellow)]" />
						<h3 className="text-xl font-semibold text-[var(--primary,#fff4dc)]">
							Account Details
						</h3>
					</div>
					<div className="space-y-6">
						<div className="space-y-2">
							<span className="text-sm uppercase tracking-[0.08em] text-[var(--text-muted)]">
								Phone Number
							</span>
							<p className="text-xl text-[var(--text-primary)]">{user.phone}</p>
						</div>
						<div className="space-y-2">
							<span className="text-sm uppercase tracking-[0.08em] text-[var(--text-muted)]">
								License Plate
							</span>
							<div className="inline-block rounded border border-[var(--outline)] bg-[var(--surface-variant)] px-4 py-2">
								<span className="font-mono text-2xl font-bold leading-none text-[var(--primary,#fff4dc)]">
									{user.vehicleNumber}
								</span>
							</div>
						</div>
					</div>
				</Card>

				<Card className="space-y-6 rounded p-6">
					<div className="flex items-center gap-3 border-b border-[var(--outline)] pb-3">
						<Car className="h-6 w-6 text-[var(--safety-yellow)]" />
						<h3 className="text-xl font-semibold text-[var(--primary,#fff4dc)]">
							Vehicle Information
						</h3>
					</div>
					<div className="space-y-6">
						<div className="space-y-2">
							<span className="text-sm uppercase tracking-[0.08em] text-[var(--text-muted)]">
								Model
							</span>
							<p className="text-xl text-[var(--text-primary)]">Registered vehicle</p>
						</div>
						<div className="space-y-2">
							<span className="text-sm uppercase tracking-[0.08em] text-[var(--text-muted)]">
								Color
							</span>
							<div className="flex items-center gap-3">
								<div className="h-6 w-6 rounded-full border border-[var(--outline)] bg-[#222222]" />
								<span className="text-xl text-[var(--text-primary)]">On file</span>
							</div>
						</div>
						<div className="space-y-2">
							<span className="text-sm uppercase tracking-[0.08em] text-[var(--text-muted)]">
								Service
							</span>
							<p className="text-base text-[var(--text-secondary)]">
								{apiUrl || "Demo mode"}
							</p>
						</div>
					</div>
				</Card>
			</section>

			<button
				type="button"
				onClick={onSettings}
				className="fixed bottom-24 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--safety-yellow)] text-[#231b00] shadow-lg transition-transform active:scale-90"
				aria-label="Open settings"
			>
				<Settings className="h-6 w-6" />
			</button>
		</div>
	);
}

function SettingsView({
	onBack,
	onSelect,
}: {
	onBack: () => void;
	onSelect: (label: string) => void;
}) {
	return (
		<div className="-mx-4 -mt-6 min-h-[calc(100dvh-5rem)] bg-[var(--surface)] pb-6">
			<header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-[var(--outline)] bg-[var(--surface)] px-4">
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={onBack}
						className="rounded-lg p-2 text-[var(--primary,#fff4dc)] active:scale-95"
						aria-label="Go back"
					>
						<ArrowRight className="h-5 w-5 rotate-180" />
					</button>
					<h1 className="text-2xl font-bold text-[var(--primary,#fff4dc)]">
						VALET PRO
					</h1>
				</div>
				<Bell className="h-5 w-5 text-[var(--primary,#fff4dc)]" />
			</header>

			<main className="px-4 py-8">
				<div className="relative mb-10 h-40 overflow-hidden rounded-xl border border-[var(--outline)] bg-[#25231c]">
					<div className="absolute inset-0 opacity-70 [background:linear-gradient(135deg,#111_0%,#2b2922_42%,#5b4d14_58%,#15130f_100%)]" />
					<div className="absolute inset-x-8 top-10 h-16 rounded-full bg-[#111] shadow-[0_0_0_8px_rgba(255,213,45,0.12),0_22px_40px_rgba(0,0,0,0.7)]" />
					<div className="absolute inset-0 bg-gradient-to-t from-[var(--surface)] via-transparent to-transparent" />
					<div className="absolute bottom-4 left-4">
						<p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--safety-yellow)]">
							Account Dashboard
						</p>
						<h2 className="text-2xl font-bold text-[var(--text-primary)]">
							Manage Settings
						</h2>
					</div>
				</div>

				<div className="space-y-4">
					<SettingsAction
						icon={<Car className="h-6 w-6" />}
						title="Vehicle Data"
						description="Manage license plates & models"
						onClick={() => onSelect("Vehicle Data")}
					/>
					<SettingsAction
						icon={<FileText className="h-6 w-6" />}
						title="Driver data"
						description="Update profile and permissions"
						onClick={() => onSelect("Driver data")}
					/>
					<SettingsAction
						icon={<CreditCard className="h-6 w-6" />}
						title="Payment settings"
						description="Methods and billing"
						onClick={() => onSelect("Payment settings")}
					/>
					<SettingsAction
						icon={<Clock3 className="h-6 w-6" />}
						title="Plan settings"
						description="Manage your subscription"
						onClick={() => onSelect("Plan settings")}
					/>
				</div>
			</main>
		</div>
	);
}

function SettingsAction({
	icon,
	title,
	description,
	onClick,
}: {
	icon: ReactNode;
	title: string;
	description: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="group flex h-32 w-full items-center justify-between rounded border-2 border-[var(--outline)] bg-[var(--surface-variant)] p-6 text-left shadow-lg transition-all active:scale-[0.98]"
		>
			<div className="flex min-w-0 items-center gap-4">
				<div className="rounded-lg border border-[var(--outline)] bg-[var(--surface)] p-3 text-[var(--safety-yellow)]">
					{icon}
				</div>
				<div className="min-w-0">
					<span className="block truncate text-2xl font-bold text-[var(--primary,#fff4dc)]">
						{title}
					</span>
					<span className="mt-1 block truncate text-sm text-[var(--text-secondary)]">
						{description}
					</span>
				</div>
			</div>
			<ChevronRight className="h-6 w-6 shrink-0 text-[var(--outline)] group-hover:text-[var(--safety-yellow)]" />
		</button>
	);
}

function AppSheet({
	type,
	user,
	vehicle,
	parking,
	onClose,
	onLockdown,
	onConfirmBooking,
	onSave,
}: {
	type: SheetType;
	user: User;
	vehicle: string;
	parking: Parking;
	onClose: () => void;
	onLockdown: () => Promise<void>;
	onConfirmBooking: () => void;
	onSave: (message: string) => void;
}) {
	const title = type
		? {
				booking: "New Booking",
				receipt: "Session Receipt",
				vehicle: "Vehicle Data",
				driver: "Driver Data",
				payment: "Payment Settings",
				plan: "Plan Settings",
				security: "Security Control",
			}[type]
		: "";

	return (
		<BaseDialog.Root
			open={type !== null}
			onOpenChange={(next) => {
				if (!next) onClose()
			}}
		>
			<BaseDialog.Portal>
				<BaseDialog.Backdrop className="fixed inset-0 z-50 bg-black/70 transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0" />
				<BaseDialog.Popup className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-xl border border-[var(--outline)] bg-[var(--surface-container)] p-5 pb-[calc(1.25rem+var(--safe-bottom))] shadow-2xl transition-transform duration-300 ease-out data-ending-style:translate-y-full data-starting-style:translate-y-full">
					<div className="mx-auto mb-3 h-1 w-12 rounded-full bg-[var(--outline)]" />
					<div className="mb-5 flex items-center justify-between gap-4">
						<div>
							<Label>EmptySpot</Label>
							<h2 className="mt-1 text-2xl font-bold text-[var(--primary,#fff4dc)]">{title}</h2>
						</div>
						<button
							type="button"
							onClick={onClose}
							className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--outline)] text-[var(--text-primary)]"
							aria-label="Close"
						>
							<X className="h-5 w-5" />
						</button>
					</div>

					{type === "booking" && (
						<BookingSheet parking={parking} vehicle={vehicle} onConfirm={onConfirmBooking} onClose={onClose} />
					)}
					{type === "receipt" && <ReceiptSheet parking={parking} vehicle={vehicle} />}
					{type === "vehicle" && (
						<VehicleSheet vehicle={vehicle} onSave={() => onSave("Vehicle data saved.")} />
					)}
					{type === "driver" && (
						<DriverSheet user={user} onSave={() => onSave("Driver profile saved.")} />
					)}
					{type === "payment" && (
						<PaymentSheet onSave={() => onSave("Payment method updated.")} />
					)}
					{type === "plan" && <PlanSheet onSave={() => onSave("Plan selection saved.")} />}
					{type === "security" && (
						<SecuritySheet onArm={onLockdown} onClose={onClose} />
					)}
				</BaseDialog.Popup>
			</BaseDialog.Portal>
		</BaseDialog.Root>
	);
}

function BookingSheet({
	parking,
	vehicle,
	onConfirm,
	onClose,
}: {
	parking: Parking;
	vehicle: string;
	onConfirm: () => void;
	onClose: () => void;
}) {
	return (
		<div className="space-y-5">
			<div className="grid grid-cols-2 gap-3">
				<SheetStat label="Parking" value="1" />
				<SheetStat label="Code" value={parking.code} />
			</div>

			<div className="space-y-3">
				<ChoiceButton
					active
					title={parking.name}
					description="Registered parking for this system"
					onClick={() => undefined}
				/>
			</div>

			<Card className="space-y-3 p-4">
				<InfoRow label="Vehicle" value={vehicle} />
				<InfoRow label="Parking" value={parking.name} />
				<InfoRow label="Parking code" value={parking.code} mono />
				<InfoRow label="Billing" value="Hourly rate, charged for the time you stay" />
			</Card>

			<div className="grid grid-cols-2 gap-3">
				<SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
				<PrimaryButton onClick={onConfirm}>Reserve Parking</PrimaryButton>
			</div>
		</div>
	);
}

function ReceiptSheet({ parking, vehicle }: { parking: Parking; vehicle: string }) {
	return (
		<div className="space-y-5">
			<Card className="p-5">
				<div className="mb-5 flex items-center gap-3">
					<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--safety-yellow)] text-[#231b00]">
						<ReceiptText className="h-6 w-6" />
					</div>
					<div>
						<h3 className="text-lg font-bold">{parking.name}</h3>
						<p className="text-sm text-[var(--text-muted)]">Parking code {parking.code}</p>
					</div>
				</div>
				<InfoRow label="Vehicle" value={vehicle} />
				<InfoRow label="Parking" value={parking.name} />
				<InfoRow label="Billing" value="Hourly rate, final amount calculated when you leave" />
			</Card>
			<PrimaryButton onClick={() => undefined}>Receipt after exit</PrimaryButton>
		</div>
	);
}

function VehicleSheet({
	vehicle,
	onSave,
}: {
	vehicle: string;
	onSave: () => void;
}) {
	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<label className="text-sm font-semibold text-[var(--text-muted)]">
					License plate
				</label>
				<Field defaultValue={vehicle} />
			</div>
			<div className="space-y-2">
				<label className="text-sm font-semibold text-[var(--text-muted)]">
					Vehicle model
				</label>
				<Field defaultValue="BMW i8" />
			</div>
			<div className="space-y-2">
				<label className="text-sm font-semibold text-[var(--text-muted)]">
					Color
				</label>
				<Field defaultValue="Sophisto Grey" />
			</div>
			<PrimaryButton onClick={onSave}>Save Vehicle</PrimaryButton>
		</div>
	);
}

function DriverSheet({ user, onSave }: { user: User; onSave: () => void }) {
	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<label className="text-sm font-semibold text-[var(--text-muted)]">
					Full name
				</label>
				<Field defaultValue={user.name} />
			</div>
			<div className="space-y-2">
				<label className="text-sm font-semibold text-[var(--text-muted)]">
					Phone number
				</label>
				<Field defaultValue={user.phone} type="tel" />
			</div>
			<div className="space-y-2">
				<label className="text-sm font-semibold text-[var(--text-muted)]">
					License number
				</label>
				<Field defaultValue={user.licenseNumber} />
			</div>
			<PrimaryButton onClick={onSave}>Save Driver</PrimaryButton>
		</div>
	);
}

function PaymentSheet({ onSave }: { onSave: () => void }) {
	return (
		<div className="space-y-5">
			<Card className="p-4">
				<div className="flex items-center gap-4">
					<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--safety-yellow)]">
						<Wallet className="h-6 w-6" />
					</div>
					<div>
						<h3 className="font-bold">Visa ending 4242</h3>
						<p className="text-sm text-[var(--text-muted)]">
							Default payment method
						</p>
					</div>
				</div>
			</Card>
			<div className="space-y-2">
				<label className="text-sm font-semibold text-[var(--text-muted)]">
					Card number
				</label>
				<Field placeholder="4242 4242 4242 4242" inputMode="numeric" />
			</div>
			<div className="grid grid-cols-2 gap-3">
				<Field placeholder="MM / YY" inputMode="numeric" />
				<Field placeholder="CVC" inputMode="numeric" />
			</div>
			<PrimaryButton onClick={onSave}>Save Payment</PrimaryButton>
		</div>
	);
}

function PlanSheet({ onSave }: { onSave: () => void }) {
	return (
		<div className="space-y-4">
			<ChoiceButton
				active
				title="Pro Member"
				description="$9.99 / month - priority parking and lower fees"
				onClick={() => undefined}
			/>
			<ChoiceButton
				title="Business"
				description="$29.99 / month - team vehicles and monthly invoices"
				onClick={() => undefined}
			/>
			<ChoiceButton
				title="Standard"
				description="Pay as you park with normal rates"
				onClick={() => undefined}
			/>
			<PrimaryButton onClick={onSave}>Save Plan</PrimaryButton>
		</div>
	);
}

function SecuritySheet({
	onArm,
	onClose,
}: {
	onArm: () => Promise<void>;
	onClose: () => void;
}) {
	const [arming, setArming] = useState(false);

	async function arm() {
		setArming(true);
		try {
			await onArm();
			onClose();
		} finally {
			setArming(false);
		}
	}

	return (
		<div className="space-y-5">
			<Card className="p-5">
				<div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--occupied)] text-white">
					<Lock className="h-7 w-7" />
				</div>
				<h3 className="text-xl font-bold">Gate lockdown</h3>
				<p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
					Use this if vehicle movement is suspicious. The gate will close and warning lights will blink at the parking controller.
				</p>
			</Card>
			<div className="grid grid-cols-2 gap-3">
				<SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
				<PrimaryButton variant="error" onClick={arm} disabled={arming}>
					{arming ? "Locking…" : "Arm Lock"}
				</PrimaryButton>
			</div>
		</div>
	);
}

function ChoiceButton({
	active = false,
	title,
	description,
	onClick,
}: {
	active?: boolean;
	title: string;
	description: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors ${
				active
					? "border-[var(--safety-yellow)] bg-[var(--safety-yellow)]/10"
					: "border-[var(--outline)] bg-[var(--surface-container-high)]"
			}`}
		>
			<div className="min-w-0">
				<h3 className="truncate font-bold text-[var(--text-primary)]">
					{title}
				</h3>
				<p className="mt-1 truncate text-sm text-[var(--text-muted)]">
					{description}
				</p>
			</div>
			{active && <CheckMark />}
		</button>
	);
}

function CheckMark() {
	return (
		<div className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--safety-yellow)] text-[#231b00]">
			<UserRound className="h-4 w-4" />
		</div>
	);
}

function SheetStat({ label, value }: { label: string; value: string }) {
	return (
		<Card className="p-4">
			<p className="font-mono text-2xl font-bold text-[var(--safety-yellow)]">
				{value}
			</p>
			<p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
				{label}
			</p>
		</Card>
	);
}
