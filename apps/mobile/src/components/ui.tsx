import type { InputHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react"

export function Field(props: InputHTMLAttributes<HTMLInputElement>) {
	return (
		<input
			{...props}
			className="w-full h-12 px-4 bg-base-200 border border-base-content/10 text-white text-[15px] font-medium placeholder:text-base-content/30 focus:outline-none focus:border-base-content/30 transition-colors"
		/>
	)
}

export function PrimaryButton({
	children,
	variant = "primary",
	...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
	children: ReactNode
	variant?: "primary" | "accent" | "error"
}) {
	const cls =
		variant === "error"
			? "bg-error text-white"
			: variant === "accent"
				? "bg-accent text-base-100"
				: "bg-white text-base-100"

	return (
		<button
			{...props}
			className={`w-full h-12 text-[15px] font-semibold tracking-tight border-0 transition-opacity ${cls} ${props.disabled ? "opacity-40 cursor-not-allowed" : "hover:opacity-90 active:opacity-80"}`}
		>
			{children}
		</button>
	)
}

export function SecondaryButton({
	children,
	danger = false,
	...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
	children: ReactNode
	danger?: boolean
}) {
	return (
		<button
			{...props}
			className={`w-full h-12 text-[15px] font-medium border transition-colors ${
				danger
					? "border-error/20 text-error hover:bg-error/10"
					: "border-base-content/10 text-base-content hover:text-white hover:border-base-content/20"
			}`}
		>
			{children}
		</button>
	)
}

export function GhostLink({
	children,
	onClick,
}: { children: ReactNode; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="text-sm font-medium text-base-content/50 hover:text-base-content transition-colors py-2 underline underline-offset-4 decoration-base-content/20 hover:decoration-base-content/40"
		>
			{children}
		</button>
	)
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
	return (
		<div className={`border border-base-content/10 bg-base-200 p-5 ${className}`}>
			{children}
		</div>
	)
}

export function Label({ children }: { children: ReactNode }) {
	return (
		<span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-base-content/40">
			{children}
		</span>
	)
}

export function Heading({
	children,
	size = "lg",
}: { children: ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
	const cls = {
		sm: "text-base font-semibold",
		md: "text-xl font-semibold",
		lg: "text-2xl font-semibold tracking-tight",
		xl: "text-[32px] font-semibold tracking-tight leading-tight",
	}[size]

	return <h1 className={`${cls} text-white`}>{children}</h1>
}

export function Stat({
	label,
	value,
}: { label: string; value: string }) {
	return (
		<div className="flex-1 border border-base-content/10 bg-base-200 p-4">
			<div className="text-lg font-semibold text-white">{value}</div>
			<div className="text-[11px] font-medium uppercase tracking-[0.08em] text-base-content/40 mt-1">{label}</div>
		</div>
	)
}

export function InfoRow({
	label,
	value,
	mono = false,
}: { label: string; value: string; mono?: boolean }) {
	return (
		<div className="flex items-baseline justify-between py-3 border-b border-base-content/[0.06] last:border-0">
			<span className="text-[13px] font-medium text-base-content/40">{label}</span>
			<span className={`text-[15px] font-medium text-white ${mono ? "font-mono text-[13px]" : ""}`}>
				{value}
			</span>
		</div>
	)
}

export function TabBar({
	activeTab,
	onTabChange,
}: { activeTab: string; onTabChange: (tab: string) => void }) {
	return (
		<div className="fixed bottom-0 left-0 right-0 border-t border-base-content/10 bg-base-100/95 backdrop-blur-sm pb-[var(--safe-bottom)]">
			<div className="flex max-w-lg mx-auto">
				<TabButton
					active={activeTab === "dashboard"}
					label="Parking"
					onClick={() => onTabChange("dashboard")}
				/>
				<TabButton
					active={activeTab === "account"}
					label="Account"
					onClick={() => onTabChange("account")}
				/>
			</div>
		</div>
	)
}

function TabButton({
	active,
	label,
	onClick,
}: { active: boolean; label: string; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex-1 h-12 text-[13px] font-semibold tracking-wide transition-colors ${
				active
					? "text-white border-b-2 border-white"
					: "text-base-content/40 hover:text-base-content/60"
			}`}
		>
			{label}
		</button>
	)
}

export function PageShell({
	children,
	withTabs = false,
}: { children: ReactNode; withTabs?: boolean }) {
	return (
		<div className="min-h-dvh bg-base-100 flex flex-col">
			<div
				className={`flex-1 overflow-y-auto px-5 max-w-lg mx-auto w-full ${
					withTabs ? "pb-24" : "pb-10"
				}`}
				style={{ paddingTop: "calc(1.5rem + var(--safe-top))" }}
			>
				<div className="space-y-6">{children}</div>
			</div>
		</div>
	)
}

export function ConfirmModal({
	open,
	title,
	message,
	confirmLabel = "Confirm",
	cancelLabel = "Cancel",
	danger = false,
	onConfirm,
	onCancel,
}: {
	open: boolean
	title: string
	message: string
	confirmLabel?: string
	cancelLabel?: string
	danger?: boolean
	onConfirm: () => void
	onCancel: () => void
}) {
	if (!open) return null

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-5" onClick={onCancel}>
			<div className="absolute inset-0 bg-black/60" />
			<div
				className="relative w-full max-w-sm bg-base-200 border border-base-content/10 p-6 space-y-4"
				onClick={(e) => e.stopPropagation()}
			>
				<h3 className="text-lg font-semibold text-white">{title}</h3>
				<p className="text-[15px] text-base-content/60 leading-relaxed">{message}</p>
				<div className="flex gap-3 pt-2">
					<button
						type="button"
						className="flex-1 h-10 text-[13px] font-medium text-base-content/60 border border-base-content/10 hover:text-white transition-colors"
						onClick={onCancel}
					>
						{cancelLabel}
					</button>
					<button
						type="button"
						className={`flex-1 h-10 text-[13px] font-semibold ${danger ? "bg-error text-white" : "bg-white text-base-100"}`}
						onClick={onConfirm}
					>
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>
	)
}

export function Toast({
	message,
	type = "info",
	visible,
}: { message: string; type?: "info" | "success" | "error" | "warning"; visible: boolean }) {
	if (!visible) return null

	const border =
		type === "success"
			? "border-success/30"
			: type === "error"
				? "border-error/30"
				: type === "warning"
					? "border-warning/30"
					: "border-base-content/20"

	return (
		<div
			className="fixed left-4 right-4 z-50 flex justify-center"
			style={{ top: "calc(1rem + var(--safe-top))" }}
		>
			<div className={`bg-base-200 border ${border} px-5 py-3 max-w-sm w-full`}>
				<span className="text-[14px] font-medium text-white">{message}</span>
			</div>
		</div>
	)
}
