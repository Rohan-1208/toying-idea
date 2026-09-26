"use client";

import { useEffect, useState } from "react";
import type { DashboardCtx } from "@/app/admin/agents/AgentOSClient";
import { formatDateTime, usd, useApi, type AgentAction, type Run, type RunStep } from "@/app/admin/agents/api";
import { AgentGlyph, Json, RiskBadge, SmallButton, StatusPill } from "@/app/admin/agents/tabs/ui";

type RunDetail = { run: Run; actions: AgentAction[]; children: Run[] };

export function RunDrawer({ runId, onClose, ctx }: { runId: string; onClose: () => void; ctx: DashboardCtx }) {
  const [poll, setPoll] = useState(0);
  const { data, error: err } = useApi<RunDetail>(`/runs/${runId}`, poll);

  const live = data?.run.status === "queued" || data?.run.status === "running";
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setPoll((p) => p + 1), 2500);
    return () => window.clearInterval(id);
  }, [live]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const agentName = (k: string) => ctx.overview?.agents.find((a) => a.key === k)?.name ?? k;
  const r = data?.run;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label="Run details">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ti-cocoa/30 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-border bg-ti-cream shadow-2xl">
        <header className="flex items-start gap-3 border-b border-border px-5 py-4">
          {r ? <AgentGlyph agent={r.agent} /> : null}
          <div className="grid min-w-0 flex-1 gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-[var(--font-ti-display)] text-lg tracking-tight">{r ? agentName(r.agent) : "Run"}</span>
              {r ? <StatusPill status={r.status} /> : null}
              {live ? <span className="text-[11px] text-muted animate-pulse">working…</span> : null}
            </div>
            {r ? (
              <div className="text-[11px] text-muted">
                {formatDateTime(r.created_at)} · {r.trigger?.workflow ?? r.trigger?.type} · {r.model ?? "—"} · {r.usage?.llm_calls ?? 0} calls ·{" "}
                {((r.usage?.input_tokens ?? 0) + (r.usage?.output_tokens ?? 0)).toLocaleString()} tokens · {usd(r.usage?.cost_usd)}
              </div>
            ) : null}
          </div>
          <SmallButton onClick={onClose}>Close</SmallButton>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {err ? <div className="text-sm text-red-700">{err}</div> : null}
          {!r ? (
            <div className="text-sm text-muted">Loading…</div>
          ) : (
            <div className="grid gap-5">
              <section className="grid gap-1.5">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Task</h3>
                <div className="whitespace-pre-wrap rounded-[var(--radius-md)] border border-border bg-surface p-3 text-sm">{r.task}</div>
              </section>

              {r.output || r.error ? (
                <section className="grid gap-1.5">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted">{r.error ? "Error" : "Summary"}</h3>
                  <div className={`whitespace-pre-wrap rounded-[var(--radius-md)] border p-3 text-sm ${r.error ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50/60"}`}>
                    {r.error || r.output}
                  </div>
                </section>
              ) : null}

              {data.actions.length ? (
                <section className="grid gap-2">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Proposed actions</h3>
                  {data.actions.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm">
                      <span className="min-w-0 truncate">{a.summary}</span>
                      <StatusPill status={a.status} />
                    </div>
                  ))}
                  {data.actions.some((a) => a.status === "pending") ? (
                    <div>
                      <SmallButton variant="primary" onClick={() => { onClose(); ctx.goTo("approvals"); }}>
                        Review in Approvals
                      </SmallButton>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {data.children.length ? (
                <section className="grid gap-2">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Delegated to</h3>
                  {data.children.map((c) => (
                    <button key={c.id} type="button" onClick={() => ctx.openRun(c.id)} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-left text-sm hover:bg-surface-2">
                      <AgentGlyph agent={c.agent} className="h-6 w-6 rounded-md text-xs" />
                      <span className="flex-1 truncate">{agentName(c.agent)} — {c.output || c.task}</span>
                      <StatusPill status={c.status} />
                    </button>
                  ))}
                </section>
              ) : null}

              <section className="grid gap-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Step by step</h3>
                {(r.steps ?? []).length === 0 ? <div className="text-sm text-muted">{live ? "Thinking…" : "No steps recorded."}</div> : null}
                <ol className="grid gap-2">
                  {(r.steps ?? []).map((s, i) => (
                    <StepItem key={i} s={s} />
                  ))}
                </ol>
              </section>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function StepItem({ s }: { s: RunStep }) {
  if (s.type === "message") {
    return (
      <li className="rounded-[var(--radius-md)] bg-surface-2/70 px-3 py-2 text-sm whitespace-pre-wrap">
        <span className="mr-1 text-[11px] text-muted">thinking</span>
        {s.text}
      </li>
    );
  }
  return (
    <li className="rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2">
      <details>
        <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
          <code className="rounded bg-ti-cocoa/[0.06] px-1.5 py-0.5 text-xs">{s.tool}</code>
          <RiskBadge risk={s.risk} />
          <StatusPill status={s.status} />
        </summary>
        <div className="mt-2 grid gap-2">
          <div className="text-[11px] text-muted">Input</div>
          <Json value={s.input} />
          <div className="text-[11px] text-muted">Output</div>
          <Json value={s.output} />
        </div>
      </details>
    </li>
  );
}
