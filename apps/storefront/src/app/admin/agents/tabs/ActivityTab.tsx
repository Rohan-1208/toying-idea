"use client";

import { useState } from "react";
import type { DashboardCtx } from "@/app/admin/agents/AgentOSClient";
import { formatDateTime, usd, useApi, type Run } from "@/app/admin/agents/api";
import { AgentGlyph, Empty, StatusPill, inputCls } from "@/app/admin/agents/tabs/ui";

const STATUSES = ["", "running", "completed", "failed", "skipped", "max_steps", "queued"];

export function ActivityTab({ ctx }: { ctx: DashboardCtx }) {
  const [agent, setAgent] = useState("");
  const [status, setStatus] = useState("");
  const q = new URLSearchParams();
  if (agent) q.set("agent", agent);
  if (status) q.set("status_filter", status);
  q.set("limit", "100");
  const { data } = useApi<{ runs: Run[] }>(`/runs?${q.toString()}`, ctx.tick);
  const runs = data?.runs ?? null;

  const agents = ctx.overview?.agents ?? [];
  const name = (k: string) => agents.find((a) => a.key === k)?.name ?? k;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-3">
        <select className={`${inputCls} w-auto`} value={agent} onChange={(e) => setAgent(e.target.value)} aria-label="Filter by agent">
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a.key} value={a.key}>
              {a.name}
            </option>
          ))}
        </select>
        <select className={`${inputCls} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s ? s.replace("_", " ") : "Any status"}
            </option>
          ))}
        </select>
      </div>

      {runs === null ? (
        <div className="text-sm text-muted">Loading…</div>
      ) : runs.length === 0 ? (
        <Empty>No runs match.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-surface">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Trigger</th>
                <th className="px-4 py-3 font-medium">Result</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-2/60" onClick={() => ctx.openRun(r.id)}>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-muted">{formatDateTime(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <AgentGlyph agent={r.agent} className="h-6 w-6 rounded-md text-xs" />
                      {name(r.agent)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                    {r.trigger?.workflow ?? (r.trigger?.type === "manual" ? "Manual task" : r.trigger?.type === "delegation" ? `From ${name(r.trigger.from_agent ?? "")}` : r.trigger?.type)}
                  </td>
                  <td className="max-w-[420px] px-4 py-3">
                    <div className="truncate text-xs">{r.output || r.error || r.task}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-xs tabular-nums text-muted">{usd(r.usage?.cost_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
