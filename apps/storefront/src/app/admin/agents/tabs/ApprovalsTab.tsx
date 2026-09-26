"use client";

import { useState } from "react";
import type { DashboardCtx } from "@/app/admin/agents/AgentOSClient";
import { api, formatDateTime, timeAgo, useApi, type AgentAction } from "@/app/admin/agents/api";
import { AgentGlyph, Empty, Json, SmallButton, StatusPill, cx, textareaCls } from "@/app/admin/agents/tabs/ui";

const FILTERS = [
  { key: "pending", label: "Waiting" },
  { key: "executed", label: "Done" },
  { key: "failed", label: "Failed" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
] as const;

export function ApprovalsTab({ ctx }: { ctx: DashboardCtx }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("pending");
  const { data, error: err, reload } = useApi<{ actions: AgentAction[] }>(`/actions?status_filter=${filter}`, ctx.tick);
  const items = data?.actions ?? null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full border border-border bg-surface p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cx("rounded-full px-3 py-1.5 text-xs font-medium", filter === f.key ? "bg-ti-cocoa text-ti-cream" : "text-muted hover:text-ti-cocoa")}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">Approving runs the action exactly as shown. “Always allow” lets that agent do this without asking next time.</p>
      </div>
      {err ? <div className="text-sm text-red-700">{err}</div> : null}
      {items === null ? (
        <div className="text-sm text-muted">Loading…</div>
      ) : items.length === 0 ? (
        <Empty>{filter === "pending" ? "Nothing needs your approval right now." : "Nothing here yet."}</Empty>
      ) : (
        <div className="grid gap-3">
          {items.map((a) => (
            <ActionCard key={a.id} a={a} ctx={ctx} onChanged={async () => { await reload(); await ctx.refresh(); }} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActionCard({ a, ctx, onChanged }: { a: AgentAction; ctx: DashboardCtx; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [showArgs, setShowArgs] = useState(false);
  const msg = a.preview?.kind === "message" ? a.preview.message : null;
  const [body, setBody] = useState(msg?.body ?? "");
  const [error, setError] = useState<string | null>(null);

  async function decide(kind: "approve" | "reject" | "retry", alwaysAllow = false) {
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { note: note || null, always_allow: alwaysAllow };
      if (kind === "approve" && msg && body !== msg.body) payload.message_body = body;
      await api(`/actions/${a.id}/${kind}`, { method: "POST", json: kind === "retry" ? undefined : payload });
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={cx("grid gap-4 rounded-[var(--radius-lg)] border bg-surface p-5 ti-ring", a.status === "pending" ? "border-ti-orange/40" : "border-border")}>
      <header className="flex flex-wrap items-start gap-3">
        <AgentGlyph agent={a.agent} />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{a.label}</span>
            <StatusPill status={a.status} />
          </div>
          <div className="text-sm">{a.summary}</div>
          <div className="text-[11px] text-muted">
            {a.agent_name} · proposed {timeAgo(a.created_at)}
            {a.decided_by ? ` · ${a.status} by ${a.decided_by.replace("human:", "")} ${formatDateTime(a.decided_at)}` : ""}
          </div>
        </div>
        {a.run_id ? <SmallButton onClick={() => ctx.openRun(a.run_id!)}>View run</SmallButton> : null}
      </header>

      {a.reason ? (
        <div className="rounded-[var(--radius-md)] bg-ti-cream px-4 py-3 text-sm">
          <span className="text-xs font-medium text-muted">Why: </span>
          {a.reason}
        </div>
      ) : null}

      {/* Previews */}
      {msg ? (
        <div className="grid gap-2">
          <div className="text-xs text-muted">
            {msg.channel} to <span className="font-medium text-ti-cocoa">{msg.customer_name ? `${msg.customer_name} <${msg.to}>` : msg.to}</span>
            {msg.subject ? ` · “${msg.subject}”` : ""}
          </div>
          {a.status === "pending" ? (
            <textarea className={cx(textareaCls, "min-h-40")} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Message text" />
          ) : (
            <div className="whitespace-pre-wrap rounded-[var(--radius-md)] border border-border bg-ti-cream/60 p-3 text-sm">{msg.body}</div>
          )}
          {a.status === "pending" && body !== msg.body ? <div className="text-[11px] text-amber-800">Your edits will be saved before sending.</div> : null}
        </div>
      ) : null}
      {a.preview?.kind === "order" ? (
        <div className="grid gap-1 rounded-[var(--radius-md)] border border-border p-3 text-sm">
          <div>
            Order <strong>{a.preview.number}</strong> · {a.preview.customer} · now <StatusPill status={a.preview.current_status} />
          </div>
          <div className="text-xs text-muted">{a.preview.items.join(" · ")}</div>
        </div>
      ) : null}
      {a.preview?.kind === "content" ? (
        <div className="grid gap-1 rounded-[var(--radius-md)] border border-border p-3 text-sm">
          <div className="font-medium">{a.preview.content.title}</div>
          <div className="whitespace-pre-wrap">{a.preview.content.caption}</div>
          <div className="text-xs text-muted">{a.preview.content.hashtags?.join(" ")}</div>
        </div>
      ) : null}
      {a.preview?.kind === "product" ? (
        <div className="grid gap-1 rounded-[var(--radius-md)] border border-border p-3 text-sm">
          <div className="font-medium">{String(a.preview.product.name ?? a.preview.product.slug)}</div>
          <div className="text-xs text-muted">{String(a.preview.product.tagline ?? "")}</div>
          <div className="text-xs">
            {(a.preview.product.variants ?? []).map((v) => `${String(v.label)} ₹${String(v.price)}`).join(" · ")}
          </div>
        </div>
      ) : null}

      {a.status === "executed" && a.result ? (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted">Result</summary>
          <Json value={a.result} />
        </details>
      ) : null}
      {a.error ? <div className="rounded-[var(--radius-md)] bg-red-50 px-3 py-2 text-sm text-red-900">{a.error}</div> : null}
      {a.note ? <div className="text-xs text-muted">Note: {a.note}</div> : null}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="text-[11px] text-muted underline" onClick={() => setShowArgs((v) => !v)}>
          {showArgs ? "Hide" : "Show"} exact parameters
        </button>
      </div>
      {showArgs ? <Json value={a.args} /> : null}

      {error ? <div className="text-sm text-red-700">{error}</div> : null}

      {a.status === "pending" ? (
        <footer className="grid gap-2">
          {showReject ? (
            <input
              className="h-10 rounded-[var(--radius-sm)] border border-border bg-ti-cream px-3 text-sm"
              placeholder="Optional note: why reject / what to do instead"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <SmallButton variant="primary" disabled={busy} onClick={() => void decide("approve")}>
              Approve
            </SmallButton>
            <SmallButton variant="dark" disabled={busy} onClick={() => void decide("approve", true)} title="Approve and let this agent do this action without asking next time">
              Approve & always allow
            </SmallButton>
            {showReject ? (
              <SmallButton variant="danger" disabled={busy} onClick={() => void decide("reject")}>
                Confirm reject
              </SmallButton>
            ) : (
              <SmallButton variant="danger" disabled={busy} onClick={() => setShowReject(true)}>
                Reject
              </SmallButton>
            )}
          </div>
        </footer>
      ) : a.status === "failed" ? (
        <div>
          <SmallButton disabled={busy} onClick={() => void decide("retry")}>
            Retry
          </SmallButton>
        </div>
      ) : null}
    </article>
  );
}
