"use client";

import type { ReactNode } from "react";
import type { Risk } from "@/app/admin/agents/api";

export function cx(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

const STATUS_TONE: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-900",
  executed: "bg-emerald-100 text-emerald-900",
  sent: "bg-emerald-100 text-emerald-900",
  scheduled: "bg-sky-100 text-sky-900",
  running: "bg-sky-100 text-sky-900",
  executing: "bg-sky-100 text-sky-900",
  queued: "bg-surface-2 text-ti-cocoa",
  pending: "bg-amber-100 text-amber-900",
  draft: "bg-amber-50 text-amber-900",
  ready_to_send: "bg-amber-100 text-amber-900",
  pending_approval: "bg-amber-100 text-amber-900",
  approved: "bg-sky-100 text-sky-900",
  failed: "bg-red-100 text-red-900",
  error: "bg-red-100 text-red-900",
  rejected: "bg-stone-200 text-stone-800",
  skipped: "bg-stone-200 text-stone-800",
  max_steps: "bg-orange-100 text-orange-900",
  auto_executed: "bg-emerald-100 text-emerald-900",
  ok: "bg-surface-2 text-ti-cocoa",
};

export function StatusPill({ status, className }: { status?: string | null; className?: string }) {
  const s = status ?? "—";
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap", STATUS_TONE[s] ?? "bg-surface-2 text-ti-cocoa", className)}>
      {s.replaceAll("_", " ")}
    </span>
  );
}

export function RiskBadge({ risk }: { risk?: Risk }) {
  if (!risk) return null;
  const tone = risk === "action" ? "bg-ti-orange/15 text-ti-cocoa border-ti-orange/40" : risk === "draft" ? "bg-ti-gold/25 text-ti-cocoa border-ti-gold/60" : "bg-ti-sky/20 text-ti-cocoa border-ti-sky/50";
  const label = risk === "action" ? "needs approval" : risk === "draft" ? "draft" : "read";
  return <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium", tone)}>{label}</span>;
}

export function Panel({ title, subtitle, actions, children, className }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-[var(--radius-lg)] border border-border bg-surface ti-ring", className)}>
      {title || actions ? (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div className="grid gap-0.5">
            {title ? <h2 className="font-[var(--font-ti-display)] text-lg tracking-tight">{title}</h2> : null}
            {subtitle ? <p className="text-xs text-muted">{subtitle}</p> : null}
          </div>
          {actions}
        </header>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "warn" | "bad" | "good" }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3 grid gap-1">
      <div className="text-xs text-muted">{label}</div>
      <div className={cx("text-2xl font-semibold tracking-tight tabular-nums", tone === "warn" && "text-amber-700", tone === "bad" && "text-red-700", tone === "good" && "text-emerald-700")}>{value}</div>
      {hint ? <div className="text-[11px] text-muted">{hint}</div> : null}
    </div>
  );
}

export function SmallButton({ children, onClick, variant = "ghost", disabled, type = "button", title }: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "dark";
  disabled?: boolean;
  type?: "button" | "submit";
  title?: string;
}) {
  const v =
    variant === "primary"
      ? "bg-ti-orange text-ti-cream hover:brightness-95"
      : variant === "dark"
        ? "bg-ti-cocoa text-ti-cream hover:bg-ti-cocoa/90"
        : variant === "danger"
          ? "border border-red-300 text-red-800 hover:bg-red-50"
          : "border border-border text-ti-cocoa hover:bg-surface-2";
  return (
    <button type={type} title={title} onClick={onClick} disabled={disabled} className={cx("inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-medium transition disabled:opacity-50 disabled:pointer-events-none", v)}>
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50", checked ? "bg-emerald-600" : "bg-stone-300")}
    >
      <span className={cx("inline-block h-5 w-5 rounded-full bg-white shadow transition", checked ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium text-ti-cocoa">{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputCls = "h-10 w-full rounded-[var(--radius-sm)] border border-border bg-ti-cream px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ti-sky/60";
export const textareaCls = "w-full rounded-[var(--radius-sm)] border border-border bg-ti-cream px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ti-sky/60";

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-[var(--radius-md)] border border-dashed border-border px-4 py-8 text-center text-sm text-muted">{children}</div>;
}

export function Json({ value }: { value: unknown }) {
  return (
    <pre className="max-h-64 overflow-auto rounded-[var(--radius-sm)] bg-ti-cocoa/[0.04] p-3 text-[11px] leading-relaxed text-ti-cocoa/90 whitespace-pre-wrap break-words">
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}

export const AGENT_GLYPH: Record<string, string> = {
  orchestrator: "◎",
  order_customer: "▣",
  product_launch: "▲",
  content: "◐",
  design_3d: "◆",
  intelligence: "◇",
};

export function AgentGlyph({ agent, className }: { agent: string; className?: string }) {
  return (
    <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ti-cocoa text-ti-gold text-base", className)} aria-hidden>
      {AGENT_GLYPH[agent] ?? "●"}
    </span>
  );
}
