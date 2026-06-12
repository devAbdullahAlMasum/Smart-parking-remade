import { Button as BaseButton } from "@base-ui/react/button";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Field as BaseField } from "@base-ui/react/field";
import { Bell, CalendarCheck, Home, User } from "lucide-react";
import type {
	ButtonHTMLAttributes,
	HTMLAttributes,
	InputHTMLAttributes,
	ReactNode,
} from "react";
import { useEffect, useState } from "react";

type ButtonVariant = "primary" | "accent" | "error";

const buttonVariantClass: Record<ButtonVariant, string> = {
	primary: "bg-[var(--safety-yellow)] text-[#231b00]",
	accent: "bg-[var(--safety-yellow)] text-[#231b00]",
	error: "bg-[var(--occupied)] text-white",
};

const baseButtonClass =
	"flex h-12 w-full items-center justify-center rounded-md border-0 text-[14px] font-bold uppercase tracking-[0.08em] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";

export function Field(props: InputHTMLAttributes<HTMLInputElement>) {
	const { className, ...rest } = props;
	return (
		<BaseField.Root className="block w-full">
			<BaseField.Control
				{...rest}
				className={`w-full h-12 rounded-md border border-[var(--outline)] bg-[var(--surface-container)] px-4 text-[15px] font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/60 outline-none transition-colors focus:border-[var(--safety-yellow)] ${className ?? ""}`}
			/>
		</BaseField.Root>
	);
}

export function PrimaryButton({
	children,
	variant = "primary",
	...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
	children: ReactNode;
	variant?: ButtonVariant;
}) {
	return (
		<BaseButton
			{...props}
			className={`${baseButtonClass} ${buttonVariantClass[variant]} ${props.className ?? ""}`}
		>
			{children}
		</BaseButton>
	);
}

export function SecondaryButton({
	children,
	danger = false,
	...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
	children: ReactNode;
	danger?: boolean;
}) {
	return (
		<BaseButton
			{...props}
			className={`flex h-12 w-full items-center justify-center rounded-md border px-4 text-[14px] font-semibold transition-colors active:scale-[0.98] ${
				danger
					? "border-[var(--occupied)]/40 text-[var(--occupied)]"
					: "border-[var(--outline)] bg-[var(--surface-container-high)] text-[var(--text-primary)]"
			} ${props.className ?? ""}`}
		>
			{children}
		</BaseButton>
	);
}

export function GhostLink({
	children,
	onClick,
}: {
	children: ReactNode;
	onClick: () => void;
}) {
	return (
		<BaseButton
			type="button"
			onClick={onClick}
			className="h-auto w-auto border-0 bg-transparent py-2 text-sm font-semibold text-[var(--safety-yellow)] underline decoration-[var(--outline)] underline-offset-4"
		>
			{children}
		</BaseButton>
	);
}

export function Card({
	children,
	className = "",
	...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
	return (
		<div
			{...props}
			className={`rounded-lg border border-[var(--outline)] bg-[var(--surface-container)] ${className}`}
		>
			{children}
		</div>
	);
}

export function Label({ children }: { children: ReactNode }) {
	return (
		<span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
			{children}
		</span>
	);
}

export function Heading({
	children,
	size = "lg",
}: {
	children: ReactNode;
	size?: "sm" | "md" | "lg" | "xl";
}) {
	const cls = {
		sm: "text-base font-semibold",
		md: "text-xl font-semibold",
		lg: "text-2xl font-bold leading-8",
		xl: "text-[32px] font-bold leading-10",
	}[size];

	return <h1 className={`${cls} text-[var(--text-primary)]`}>{children}</h1>;
}

export function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex-1 rounded-lg border border-[var(--outline)] bg-[var(--surface-container)] p-4">
			<div className="font-mono text-2xl font-bold text-[var(--text-primary)]">
				{value}
			</div>
			<div className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
				{label}
			</div>
		</div>
	);
}

export function InfoRow({
	label,
	value,
	mono = false,
}: {
	label: string;
	value: string;
	mono?: boolean;
}) {
	return (
		<div className="flex items-baseline justify-between border-b border-[var(--outline)]/70 py-3 last:border-0">
			<span className="text-[13px] font-medium text-[var(--text-muted)]">
				{label}
			</span>
			<span
				className={`text-[15px] font-semibold text-[var(--text-primary)] ${mono ? "font-mono text-[13px]" : ""}`}
			>
				{value}
			</span>
		</div>
	);
}

const tabs = [
	{ id: "home", label: "Home", icon: Home },
	{ id: "bookings", label: "Bookings", icon: CalendarCheck },
	{ id: "alerts", label: "Inbox", icon: Bell },
	{ id: "profile", label: "Profile", icon: User },
] as const;

export function TabBar({
	activeTab,
	onTabChange,
}: {
	activeTab: string;
	onTabChange: (tab: string) => void;
}) {
	return (
		<nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--outline)] bg-[var(--surface)]/98 pb-[var(--safe-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
			<div className="mx-auto grid h-16 max-w-lg grid-cols-4 px-1">
				{tabs.map((tab) => (
					<TabButton
						key={tab.id}
						active={activeTab === tab.id}
						icon={tab.icon}
						label={tab.label}
						onClick={() => onTabChange(tab.id)}
					/>
				))}
			</div>
		</nav>
	);
}

function TabButton({
	active,
	icon: Icon,
	label,
	onClick,
}: {
	active: boolean;
	icon: typeof Home;
	label: string;
	onClick: () => void;
}) {
	return (
		<BaseButton
			type="button"
			onClick={onClick}
			className={`h-auto w-auto min-w-0 flex-col gap-1 rounded-lg border-0 bg-transparent text-[10px] transition-transform active:scale-95 ${
				active ? "text-[#231b00]" : "text-[var(--text-muted)]"
			}`}
		>
			<span
				className={`flex h-8 min-w-10 items-center justify-center rounded-md ${
					active ? "bg-[var(--safety-yellow)] px-3" : ""
				}`}
			>
				<Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
			</span>
			<span
				className={`truncate ${active ? "font-bold text-[var(--safety-yellow)]" : ""}`}
			>
				{label}
			</span>
		</BaseButton>
	);
}

export function PageShell({
	children,
	withTabs = false,
}: {
	children: ReactNode;
	withTabs?: boolean;
}) {
	return (
		<div className="min-h-dvh bg-[var(--surface)] text-[var(--text-primary)]">
			<div
				className={`mx-auto min-h-dvh w-full max-w-lg px-4 ${withTabs ? "pb-24" : "pb-10"}`}
				style={{ paddingTop: "calc(1.5rem + var(--safe-top))" }}
			>
				{children}
			</div>
		</div>
	);
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
	open: boolean;
	title: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	danger?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}) {
	return (
		<BaseDialog.Root
			open={open}
			onOpenChange={(next) => {
				if (!next) onCancel();
			}}
		>
			<BaseDialog.Portal>
				<BaseDialog.Backdrop className="fixed inset-0 z-50 bg-black/70 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
				<BaseDialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-5">
					<BaseDialog.Popup className="w-full max-w-sm rounded-lg border border-[var(--outline)] bg-[var(--surface-container)] p-5 shadow-2xl transition-[opacity,scale] duration-200 data-ending-style:scale-[0.96] data-ending-style:opacity-0 data-starting-style:scale-[0.96] data-starting-style:opacity-0">
						<BaseDialog.Title className="text-lg font-bold text-[var(--text-primary)]">
							{title}
						</BaseDialog.Title>
						<BaseDialog.Description className="mt-2 text-[15px] leading-relaxed text-[var(--text-secondary)]">
							{message}
						</BaseDialog.Description>
						<div className="mt-5 flex gap-3">
							<SecondaryButton className="h-11" onClick={onCancel}>
								{cancelLabel}
							</SecondaryButton>
							<PrimaryButton
								className="h-11"
								variant={danger ? "error" : "primary"}
								onClick={onConfirm}
							>
								{confirmLabel}
							</PrimaryButton>
						</div>
					</BaseDialog.Popup>
				</BaseDialog.Viewport>
			</BaseDialog.Portal>
		</BaseDialog.Root>
	);
}

export function Toast({
	message,
	type = "info",
	visible,
}: {
	message: string;
	type?: "info" | "success" | "error" | "warning";
	visible: boolean;
}) {
	const [mounted, setMounted] = useState(visible);
	const [phase, setPhase] = useState<"in" | "out">("in");

	useEffect(() => {
		if (visible) {
			setMounted(true);
			setPhase("in");
			return;
		}
		if (!mounted) return;
		setPhase("out");
		const timeout = window.setTimeout(() => setMounted(false), 220);
		return () => window.clearTimeout(timeout);
	}, [visible, mounted]);

	if (!mounted) return null;

	const accent =
		type === "error"
			? "border-[var(--occupied)]"
			: type === "warning"
				? "border-[var(--warning)]"
				: "border-[var(--safety-yellow)]";

	return (
		<div
			className="fixed left-4 right-4 z-50 flex justify-center"
			style={{ top: "calc(1rem + var(--safe-top))" }}
		>
			<div
				className={`w-full max-w-sm rounded-lg border ${accent} bg-[var(--surface-container-high)] px-4 py-3 shadow-xl ${
					phase === "in"
						? "animate-[toast-in_220ms_ease-out]"
						: "animate-[toast-out_220ms_ease-in_forwards]"
				}`}
			>
				<span className="text-[14px] font-semibold text-[var(--text-primary)]">
					{message}
				</span>
			</div>
		</div>
	);
}
