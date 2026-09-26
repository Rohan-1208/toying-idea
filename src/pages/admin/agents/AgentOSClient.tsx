import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, useApi, type Overview } from "./api";
import { cx, Toggle } from "./tabs/ui";
import { OverviewTab } from "./tabs/OverviewTab";
import { ApprovalsTab } from "./tabs/ApprovalsTab";
import { AgentsTab } from "./tabs/AgentsTab";
import { WorkflowsTab } from "./tabs/WorkflowsTab";
import { ActivityTab } from "./tabs/ActivityTab";
import { OutputsTab } from "./tabs/OutputsTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { RunDrawer } from "./tabs/RunDrawer";
import { NewTaskPanel } from "./tabs/NewTaskPanel";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "approvals", label: "Approvals" },
  { key: "agents", label: "Agents" },
  { key: "workflows", label: "Workflows" },
  { key: "activity", label: "Activity" },
  { key: "outputs", label: "Outputs" },
  { key: "settings", label: "Settings" },
] as const;

export type TabKey = (typeof TABS)[number]["key"];

export type DashboardCtx = {
  overview: Overview | null;
  refresh: () => Promise<void>;
  openRun: (runId: string) => void;
  goTo: (tab: TabKey) => void;
  newTask: (agent?: string, task?: string) => void;
  tick: number;
};

export function AgentOSClient() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.key === params.get("tab"))?.key ?? "overview") as TabKey;
  const [runId, setRunId] = useState<string | null>(null);
  const [taskOpen, setTaskOpen] = useState<{ agent?: string; task?: string } | null>(null);
  const [tick, setTick] = useState(0);
  const [pausing, setPausing] = useState(false);
  const { data: overview, error, reload } = useApi<Overview>("/overview", tick);

  // Poll every 6s while the tab is visible; bumping `tick` also refreshes the open tab's data.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") setTick((t) => t + 1);
    }, 6000);
    return () => window.clearInterval(id);
  }, []);

  const refresh = useCallback(async () => {
    await reload();
    setTick((t) => t + 1);
  }, [reload]);

  const goTo = useCallback(
    (t: TabKey) => {
      const next = new URLSearchParams(params);
      next.set("tab", t);
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const ctx: DashboardCtx = {
    overview,
    refresh,
    openRun: setRunId,
    goTo,
    newTask: (agent, task) => setTaskOpen({ agent, task }),
    tick,
  };

  async function togglePause(next: boolean) {
    setPausing(true);
    try {
      await api("/settings", { method: "PATCH", json: { paused: next } });
      await refresh();
    } finally {
      setPausing(false);
    }
  }

  const paused = overview?.paused ?? false;

  return (
    <div className="grid gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl md:text-4xl tracking-tight">Agent OS</h1>
            <span className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", paused ? "bg-red-100 text-red-900" : "bg-emerald-100 text-emerald-900")}>
              <span className={cx("h-2 w-2 rounded-full", paused ? "bg-red-600" : "bg-emerald-600 animate-pulse")} />
              {paused ? "Paused" : "Running"}
            </span>
          </div>
          <p className="text-sm text-ink/50">Your AI team for Toying Idea. Agents draft and propose; you approve what matters.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 rounded-full border border-ink/10 bg-cream-50 px-3 py-1.5 text-xs">
            <span className="font-medium">{paused ? "Resume all agents" : "Pause all agents"}</span>
            <Toggle checked={!paused} onChange={(v) => void togglePause(!v)} disabled={pausing || !overview} label="Agents running" />
          </label>
          <button
            type="button"
            onClick={() => setTaskOpen({})}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-clay px-5 text-sm font-medium text-cream-50 shadow-[0_10px_30px_rgba(36,21,11,0.18)] hover:brightness-95"
          >
            <span aria-hidden>＋</span> New task
          </button>
        </div>
      </div>

      {overview && !overview.api_key_configured ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Almost ready:</strong> add <code className="rounded bg-amber-100 px-1">ANTHROPIC_API_KEY</code> in the Vercel project settings so agents can think. The dashboard still works without it.
        </div>
      ) : null}
      {error ? <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}

      {/* Tabs */}
      <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-ink/10 px-1" aria-label="Agent OS sections">
        {TABS.map((t) => {
          const count = t.key === "approvals" ? overview?.pending_actions : undefined;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => goTo(t.key)}
              className={cx(
                "relative -mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition",
                tab === t.key ? "border-clay font-medium text-ink" : "border-transparent text-ink/50 hover:text-ink",
              )}
            >
              {t.label}
              {count ? <span className="rounded-full bg-clay px-1.5 py-0.5 text-[10px] font-semibold text-cream-50 tabular-nums">{count}</span> : null}
            </button>
          );
        })}
      </nav>

      <div>
        {tab === "overview" && <OverviewTab ctx={ctx} />}
        {tab === "approvals" && <ApprovalsTab ctx={ctx} />}
        {tab === "agents" && <AgentsTab ctx={ctx} />}
        {tab === "workflows" && <WorkflowsTab ctx={ctx} />}
        {tab === "activity" && <ActivityTab ctx={ctx} />}
        {tab === "outputs" && <OutputsTab ctx={ctx} />}
        {tab === "settings" && <SettingsTab ctx={ctx} />}
      </div>

      {runId ? <RunDrawer runId={runId} onClose={() => setRunId(null)} ctx={ctx} /> : null}
      {taskOpen ? (
        <NewTaskPanel
          initialAgent={taskOpen.agent}
          initialTask={taskOpen.task}
          agents={overview?.agents ?? []}
          onClose={() => setTaskOpen(null)}
          onStarted={(id) => {
            setTaskOpen(null);
            setRunId(id);
            void refresh();
          }}
        />
      ) : null}
    </div>
  );
}
