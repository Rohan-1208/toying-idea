import { useCallback, useEffect, useState } from "react";

// Typed client for the Agent OS admin API (proxied to the FastAPI backend via /api rewrites).

export type Risk = "read" | "draft" | "action";

export type AgentConfig = {
  key: string;
  name: string;
  role: string;
  description: string;
  enabled: boolean;
  model: string;
  default_model?: string;
  auto_approve_tools: string[];
  instructions: string;
  tools: string[];
  icon?: string;
  system_prompt?: string;
  tool_details?: Array<{ name: string; label: string; risk: Risk; description: string }>;
  runs_today?: number;
  failed_today?: number;
  last_run_at?: string | null;
  last_status?: string | null;
};

export type Usage = { input_tokens: number; output_tokens: number; cost_usd: number; llm_calls: number };

export type RunStep = {
  type: "message" | "tool";
  at: string;
  text?: string;
  tool?: string;
  risk?: Risk;
  status?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  action_id?: string;
};

export type Run = {
  id: string;
  agent: string;
  task: string;
  trigger: { type: string; event?: string; workflow?: string; by?: string; from_agent?: string };
  status: "queued" | "running" | "completed" | "failed" | "skipped" | "max_steps";
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  model?: string | null;
  steps?: RunStep[];
  action_ids?: string[];
  child_run_ids?: string[];
  parent_run_id?: string | null;
  depth?: number;
  output?: string | null;
  error?: string | null;
  usage?: Usage;
};

export type AgentAction = {
  id: string;
  agent: string;
  agent_name?: string;
  tool: string;
  label: string;
  summary: string;
  args: Record<string, unknown>;
  reason: string;
  run_id: string | null;
  status: "pending" | "approved" | "executing" | "executed" | "failed" | "rejected";
  created_at: string;
  decided_at?: string | null;
  decided_by?: string | null;
  note?: string | null;
  result?: unknown;
  error?: string | null;
  preview?: ActionPreview | null;
};

export type ActionPreview =
  | { kind: "message"; message: CustomerMessage }
  | { kind: "order"; number: string; current_status: string; customer?: string; items: string[] }
  | { kind: "content"; content: ContentItem }
  | { kind: "product"; product: Record<string, unknown> & { name?: string; slug?: string; variants?: Array<Record<string, unknown>> } };

export type CustomerMessage = {
  id: string;
  channel: string;
  to: string;
  customer_name?: string | null;
  subject?: string | null;
  body: string;
  status: string;
  order_number?: string | null;
  request_id?: string | null;
  created_at: string;
  created_by?: string;
  delivery?: { status: string; note?: string } | null;
};

export type ContentItem = {
  id: string;
  type: string;
  title: string;
  caption: string;
  hashtags: string[];
  visual_brief: string;
  reel_script?: string | null;
  suggested_slot?: string | null;
  scheduled_for?: string | null;
  status: string;
  product_slugs: string[];
  created_at: string;
};

export type Insight = {
  id: string;
  title: string;
  kind: string;
  summary: string;
  recommendations: Array<{ title: string; rationale: string; priority: string; category?: string; suggested_agent?: string }>;
  created_at: string;
};

export type Workflow = {
  id: string;
  key?: string;
  name: string;
  description: string;
  agent: string;
  agent_name?: string;
  instruction: string;
  trigger: {
    type: "event" | "schedule" | "manual";
    event?: string;
    every?: "daily" | "weekly" | "hourly" | "interval";
    at?: string;
    weekday?: number;
    interval_minutes?: number;
    filter?: Record<string, unknown>;
  };
  trigger_label?: string;
  enabled: boolean;
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_run_id?: string | null;
  run_count?: number;
};

export type Overview = {
  paused: boolean;
  pending_actions: number;
  runs_today: number;
  failed_today: number;
  running: number;
  cost_today_usd: number;
  daily_run_budget: number;
  open_orders: number;
  draft_messages: number;
  api_key_configured: boolean;
  worker_enabled: boolean;
  channels: Record<string, boolean>;
  agents: AgentConfig[];
  recent_runs: Run[];
};

export type OSSettings = {
  paused: boolean;
  daily_run_budget: number;
  max_steps: number;
  low_stock_threshold: number;
  utc_offset_minutes: number;
  business: Record<string, string>;
  pricing: Record<string, unknown> & { filament_cost_per_kg: Record<string, number> };
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const BASE = "/api/admin/agent-os";

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(`${BASE}${path}`, {
    cache: "no-store",
    ...rest,
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 401 || res.status === 403) {
    if (typeof window !== "undefined") window.location.href = "/admin";
    throw new ApiError(res.status, "Not authorised");
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = (await res.json()) as { detail?: unknown };
      if (j?.detail) msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.round((Date.now() - t) / 1000);
  const future = s < 0;
  const a = Math.abs(s);
  const v = a < 60 ? `${a}s` : a < 3600 ? `${Math.round(a / 60)}m` : a < 86400 ? `${Math.round(a / 3600)}h` : `${Math.round(a / 86400)}d`;
  return future ? `in ${v}` : `${v} ago`;
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function usd(n?: number): string {
  return `$${(n ?? 0).toFixed((n ?? 0) < 1 ? 3 : 2)}`;
}

// ---------------------------------------------------------------------------
// Data hook: fetches `path` whenever it or `refreshKey` changes. State is only set
// from promise callbacks (never synchronously inside the effect).

export function useApi<T>(path: string | null, refreshKey?: unknown) {
  const [state, setState] = useState<{ path: string | null; data: T | null; error: string | null }>({ path: null, data: null, error: null });

  useEffect(() => {
    if (!path) return;
    let active = true;
    api<T>(path).then(
      (data) => active && setState({ path, data, error: null }),
      (e: unknown) => active && setState((s) => ({ ...s, path, error: e instanceof Error ? e.message : "Failed to load" })),
    );
    return () => {
      active = false;
    };
  }, [path, refreshKey]);

  const reload = useCallback(async () => {
    if (!path) return;
    try {
      const data = await api<T>(path);
      setState({ path, data, error: null });
    } catch (e) {
      setState((s) => ({ ...s, error: e instanceof Error ? e.message : "Failed to load" }));
    }
  }, [path]);

  // Data from a previous path is hidden while the new one loads.
  const data = state.path === path ? state.data : null;
  return { data, error: state.error, reload };
}
