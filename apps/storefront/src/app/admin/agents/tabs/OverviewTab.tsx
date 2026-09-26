"use client";

import type { DashboardCtx } from "@/app/admin/agents/AgentOSClient";
import { timeAgo, usd } from "@/app/admin/agents/api";
import { AgentGlyph, Empty, Panel, SmallButton, Stat, StatusPill, cx } from "@/app/admin/agents/tabs/ui";

export function OverviewTab({ ctx }: { ctx: DashboardCtx }) {
  const o = ctx.overview;
  if (!o) return <div className="text-sm text-muted">Loading…</div>;

  const agentName = (k: string) => o.agents.find((a) => a.key === k)?.name ?? k;

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <button type="button" className="text-left" onClick={() => ctx.goTo("approvals")}>
          <Stat label="Waiting for you" value={o.pending_actions} hint="approvals" tone={o.pending_actions ? "warn" : undefined} />
        </button>
        <Stat label="Runs today" value={o.runs_today} hint={`budget ${o.daily_run_budget}/day`} />
        <Stat label="Running now" value={o.running} />
        <Stat label="Failed today" value={o.failed_today} tone={o.failed_today ? "bad" : undefined} />
        <Stat label="AI cost today" value={usd(o.cost_today_usd)} hint="Claude API, est." />
        <Stat label="Open orders" value={o.open_orders} hint={`${o.draft_messages} messages to send`} />
      </div>

      <Panel title="Your agents" subtitle="Click an agent to give it a task. Configure models, autonomy and instructions in the Agents tab.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {o.agents.map((a) => (
            <div key={a.key} className={cx("grid gap-3 rounded-[var(--radius-md)] border border-border bg-ti-cream/60 p-4", !a.enabled && "opacity-60")}>
              <div className="flex items-start gap-3">
                <AgentGlyph agent={a.key} />
                <div className="grid min-w-0 gap-0.5">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-medium">{a.name}</div>
                    {!a.enabled ? <StatusPill status="disabled" /> : null}
                  </div>
                  <div className="text-xs text-muted line-clamp-2">{a.description}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
                <span>{a.model}</span>
                <span>{a.runs_today ?? 0} runs today</span>
                <span className="flex items-center gap-1">
                  last {timeAgo(a.last_run_at)} {a.last_status ? <StatusPill status={a.last_status} /> : null}
                </span>
              </div>
              <div className="flex gap-2">
                <SmallButton variant="dark" onClick={() => ctx.newTask(a.key)} disabled={!a.enabled}>
                  Give a task
                </SmallButton>
                <SmallButton onClick={() => ctx.goTo("agents")}>Configure</SmallButton>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Panel title="Latest activity" actions={<SmallButton onClick={() => ctx.goTo("activity")}>All activity</SmallButton>}>
          {o.recent_runs.length === 0 ? (
            <Empty>No agent runs yet. Place a test order, or click “New task”.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {o.recent_runs.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => ctx.openRun(r.id)} className="flex w-full items-start gap-3 py-3 text-left hover:bg-surface-2/60 rounded-lg px-2 -mx-2">
                    <AgentGlyph agent={r.agent} className="h-7 w-7 text-sm" />
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">{agentName(r.agent)}</span>
                        <StatusPill status={r.status} />
                        <span className="text-[11px] text-muted">
                          {r.trigger?.workflow ? `· ${r.trigger.workflow}` : r.trigger?.type === "manual" ? "· manual task" : r.trigger?.type ? `· ${r.trigger.type}` : ""}
                        </span>
                      </div>
                      <div className="truncate text-xs text-muted">{r.output || r.error || r.task}</div>
                    </div>
                    <div className="text-[11px] text-muted whitespace-nowrap">{timeAgo(r.created_at)}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Setup" subtitle="What is connected">
          <ul className="grid gap-3 text-sm">
            <SetupRow ok={o.api_key_configured} label="Claude API key" hint="ANTHROPIC_API_KEY on the backend" />
            <SetupRow ok={o.worker_enabled} label="Background worker" hint="Runs workflows and schedules" />
            <SetupRow ok={!!o.channels?.email} label="Email sending" hint="RESEND_API_KEY + EMAIL_FROM (optional)" optional />
            <SetupRow ok={!!o.channels?.instagram} label="Instagram DMs & posting" hint="Phase 2–3" optional />
            <SetupRow ok={false} label="Blender worker" hint="Phase 4" optional />
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function SetupRow({ ok, label, hint, optional }: { ok: boolean; label: string; hint: string; optional?: boolean }) {
  return (
    <li className="flex items-start gap-3">
      <span className={cx("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold", ok ? "bg-emerald-600 text-white" : optional ? "bg-stone-200 text-stone-600" : "bg-amber-400 text-ti-cocoa")}>
        {ok ? "✓" : optional ? "–" : "!"}
      </span>
      <div className="grid">
        <span className="font-medium">{label}</span>
        <span className="text-[11px] text-muted">{hint}</span>
      </div>
    </li>
  );
}
