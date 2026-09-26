import { useState } from "react";
import type { DashboardCtx } from "../AgentOSClient";
import { api, formatDateTime, timeAgo, useApi, type Workflow } from "../api";
import { AgentGlyph, Empty, Field, Panel, SmallButton, Toggle, cx, inputCls, textareaCls } from "./ui";

type WfResponse = {
  workflows: Workflow[];
  event_types: Array<{ type: string; label: string }>;
  agents: Array<{ key: string; name: string }>;
};

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function WorkflowsTab({ ctx }: { ctx: DashboardCtx }) {
  const { data, error: loadErr, reload: load } = useApi<WfResponse>("/workflows", ctx.tick);
  const [editing, setEditing] = useState<Partial<Workflow> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function patch(id: string, body: Partial<Workflow>) {
    setBusy(id);
    try {
      await api(`/workflows/${id}`, { method: "PATCH", json: body });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function runNow(id: string) {
    setBusy(id);
    try {
      const r = await api<{ run_id: string }>(`/workflows/${id}/run`, { method: "POST" });
      ctx.openRun(r.run_id);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this workflow?")) return;
    await api(`/workflows/${id}`, { method: "DELETE" });
    await load();
  }

  async function processNow() {
    setBusy("tick");
    try {
      await api("/tick", { method: "POST" });
      await ctx.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (!data) return <div className="text-sm text-ink/50">Loading…</div>;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink/50">
          A workflow says <em>when</em> an agent should act and <em>what</em> it should do. Events fire instantly (new order, new request…);
          schedules run in IST. The worker checks every ~20 seconds.
        </p>
        <div className="flex gap-2">
          <SmallButton onClick={() => void processNow()} disabled={busy === "tick"}>
            {busy === "tick" ? "Processing…" : "Process queue now"}
          </SmallButton>
          <SmallButton variant="primary" onClick={() => setEditing({ enabled: true, agent: "order_customer", trigger: { type: "event", event: "order.created" } })}>
            ＋ New workflow
          </SmallButton>
        </div>
      </div>
      {err || loadErr ? <div className="text-sm text-red-700">{err || loadErr}</div> : null}

      {editing ? <WorkflowEditor initial={editing} meta={data} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} /> : null}

      {data.workflows.length === 0 ? (
        <Empty>No workflows yet.</Empty>
      ) : (
        <div className="grid gap-3">
          {data.workflows.map((w) => (
            <div key={w.id} className={cx("grid gap-3 rounded-3xl border border-ink/10 bg-cream-50 p-4 md:grid-cols-[auto_1fr_auto] md:items-center", !w.enabled && "opacity-70")}>
              <Toggle checked={w.enabled} onChange={(v) => void patch(w.id, { enabled: v })} disabled={busy === w.id} label={`Enable ${w.name}`} />
              <div className="grid min-w-0 gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{w.name}</span>
                  <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-medium", w.trigger.type === "event" ? "bg-ti-sky/25" : w.trigger.type === "schedule" ? "bg-ti-gold/30" : "bg-ink/5")}>
                    {w.trigger_label}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-ink/50">
                    → <AgentGlyph agent={w.agent} className="h-5 w-5 rounded-md text-[10px]" /> {w.agent_name}
                  </span>
                </div>
                {w.description ? <div className="text-xs text-ink/50">{w.description}</div> : null}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink/50">
                  <span>{w.run_count ?? 0} runs</span>
                  <span>
                    last:{" "}
                    {w.last_run_id ? (
                      <button type="button" className="underline" onClick={() => ctx.openRun(w.last_run_id!)}>
                        {timeAgo(w.last_run_at)}
                      </button>
                    ) : (
                      "never"
                    )}
                  </span>
                  {w.trigger.type === "schedule" && w.enabled ? <span>next: {formatDateTime(w.next_run_at)}</span> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <SmallButton variant="dark" onClick={() => void runNow(w.id)} disabled={busy === w.id}>
                  Run now
                </SmallButton>
                <SmallButton onClick={() => setEditing(w)}>Edit</SmallButton>
                <SmallButton variant="danger" onClick={() => void remove(w.id)}>
                  Delete
                </SmallButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowEditor({ initial, meta, onClose, onSaved }: { initial: Partial<Workflow>; meta: WfResponse; onClose: () => void; onSaved: () => Promise<void> }) {
  const [w, setW] = useState<Partial<Workflow>>({ ...initial, trigger: { ...(initial.trigger ?? { type: "manual" }) } });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const trig = w.trigger ?? { type: "manual" as const };
  const setTrig = (t: Partial<Workflow["trigger"]>) => setW((p) => ({ ...p, trigger: { ...(p.trigger ?? { type: "manual" }), ...t } as Workflow["trigger"] }));

  async function save() {
    setSaving(true);
    setErr(null);
    const body = { name: w.name, description: w.description ?? "", agent: w.agent, instruction: w.instruction, trigger: cleanTrigger(trig), enabled: w.enabled ?? true };
    try {
      if (w.id) await api(`/workflows/${w.id}`, { method: "PATCH", json: body });
      else await api(`/workflows`, { method: "POST", json: body });
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title={w.id ? `Edit “${initial.name}”` : "New workflow"} actions={<SmallButton onClick={onClose}>Close</SmallButton>} className="border-clay/50">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name">
          <input className={inputCls} value={w.name ?? ""} onChange={(e) => setW({ ...w, name: e.target.value })} placeholder="e.g. Diwali gifting follow-up" />
        </Field>
        <Field label="Agent">
          <select className={inputCls} value={w.agent} onChange={(e) => setW({ ...w, agent: e.target.value })}>
            {meta.agents.map((a) => (
              <option key={a.key} value={a.key}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field label="Description (optional)">
            <input className={inputCls} value={w.description ?? ""} onChange={(e) => setW({ ...w, description: e.target.value })} />
          </Field>
        </div>

        <Field label="Trigger">
          <select className={inputCls} value={trig.type} onChange={(e) => setTrig({ type: e.target.value as Workflow["trigger"]["type"] })}>
            <option value="event">When something happens (event)</option>
            <option value="schedule">On a schedule</option>
            <option value="manual">Manual only (Run now)</option>
          </select>
        </Field>
        {trig.type === "event" ? (
          <Field label="Event">
            <select className={inputCls} value={trig.event ?? ""} onChange={(e) => setTrig({ event: e.target.value })}>
              <option value="" disabled>
                Choose…
              </option>
              {meta.event_types.map((e) => (
                <option key={e.type} value={e.type}>
                  {e.label}
                </option>
              ))}
            </select>
          </Field>
        ) : trig.type === "schedule" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Repeat">
              <select className={inputCls} value={trig.every ?? "daily"} onChange={(e) => setTrig({ every: e.target.value as Workflow["trigger"]["every"] })}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="hourly">Hourly</option>
                <option value="interval">Every N minutes</option>
              </select>
            </Field>
            {trig.every === "interval" ? (
              <Field label="Minutes">
                <input className={inputCls} type="number" min={5} value={trig.interval_minutes ?? 60} onChange={(e) => setTrig({ interval_minutes: Number(e.target.value) })} />
              </Field>
            ) : (
              <Field label="Time (IST)">
                <input className={inputCls} type="time" value={trig.at ?? "09:00"} onChange={(e) => setTrig({ at: e.target.value })} />
              </Field>
            )}
            {trig.every === "weekly" ? (
              <Field label="Day">
                <select className={inputCls} value={trig.weekday ?? 0} onChange={(e) => setTrig({ weekday: Number(e.target.value) })}>
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
          </div>
        ) : (
          <div />
        )}

        <div className="md:col-span-2">
          <Field label="Instruction" hint="What the agent should do each time. For events, the event details (order number etc.) are attached automatically.">
            <textarea className={cx(textareaCls, "min-h-32")} value={w.instruction ?? ""} onChange={(e) => setW({ ...w, instruction: e.target.value })} />
          </Field>
        </div>
      </div>
      {err ? <div className="mt-3 text-sm text-red-700">{err}</div> : null}
      <div className="mt-4 flex justify-end gap-2">
        <SmallButton onClick={onClose}>Cancel</SmallButton>
        <SmallButton variant="primary" onClick={() => void save()} disabled={saving || !w.name || !w.instruction}>
          {saving ? "Saving…" : "Save workflow"}
        </SmallButton>
      </div>
    </Panel>
  );
}

function cleanTrigger(t: Workflow["trigger"]): Workflow["trigger"] {
  if (t.type === "event") return { type: "event", event: t.event, ...(t.filter ? { filter: t.filter } : {}) };
  if (t.type === "schedule") {
    const every = t.every ?? "daily";
    if (every === "interval") return { type: "schedule", every, interval_minutes: t.interval_minutes ?? 60 };
    if (every === "weekly") return { type: "schedule", every, weekday: t.weekday ?? 0, at: t.at ?? "09:00" };
    return { type: "schedule", every, at: t.at ?? "09:00" };
  }
  return { type: "manual" };
}
