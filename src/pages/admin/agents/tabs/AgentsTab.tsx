import { useState } from "react";
import type { DashboardCtx } from "../AgentOSClient";
import { api, useApi, type AgentConfig } from "../api";
import { AgentGlyph, Field, Panel, RiskBadge, SmallButton, Toggle, cx, inputCls, textareaCls } from "./ui";

type AgentsResponse = { agents: AgentConfig[]; models: Array<{ id: string; label: string }> };

export function AgentsTab({ ctx }: { ctx: DashboardCtx }) {
  const { data, reload: load } = useApi<AgentsResponse>("/agents");
  const [selected, setSelected] = useState<string>("order_customer");

  if (!data) return <div className="text-sm text-ink/50">Loading…</div>;
  const agent = data.agents.find((a) => a.key === selected) ?? data.agents[0];

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <nav className="grid content-start gap-2">
        {data.agents.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setSelected(a.key)}
            className={cx(
              "flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition",
              a.key === agent.key ? "border-clay bg-cream-50 ti-ring" : "border-ink/10 hover:bg-cream-50",
            )}
          >
            <AgentGlyph agent={a.key} className="h-8 w-8 text-sm" />
            <div className="grid min-w-0">
              <span className="truncate text-sm font-medium">{a.name}</span>
              <span className="truncate text-[11px] text-ink/50">{a.enabled ? a.model : "disabled"}</span>
            </div>
          </button>
        ))}
      </nav>
      <AgentEditor key={agent.key} agent={agent} models={data.models} ctx={ctx} onSaved={load} />
    </div>
  );
}

function AgentEditor({ agent, models, ctx, onSaved }: { agent: AgentConfig; models: AgentsResponse["models"]; ctx: DashboardCtx; onSaved: () => Promise<void> }) {
  const [enabled, setEnabled] = useState(agent.enabled);
  const [model, setModel] = useState(agent.model);
  const [instructions, setInstructions] = useState(agent.instructions ?? "");
  const [auto, setAuto] = useState<string[]>(agent.auto_approve_tools ?? []);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const dirty =
    enabled !== agent.enabled ||
    model !== agent.model ||
    instructions !== (agent.instructions ?? "") ||
    JSON.stringify([...auto].sort()) !== JSON.stringify([...(agent.auto_approve_tools ?? [])].sort());

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await api(`/agents/${agent.key}`, { method: "PATCH", json: { enabled, model, instructions, auto_approve_tools: auto } });
      await onSaved();
      await ctx.refresh();
      setMsg("Saved");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  const tools = agent.tool_details ?? [];
  const groups: Array<{ risk: "read" | "draft" | "action"; title: string; hint: string }> = [
    { risk: "action", title: "Actions", hint: "Consequential. Ask for approval unless you tick “auto-approve”." },
    { risk: "draft", title: "Drafts", hint: "Internal drafts only. Run immediately." },
    { risk: "read", title: "Look-ups", hint: "Read-only. Run immediately." },
  ];

  return (
    <div className="grid gap-5">
      <Panel
        title={
          <span className="flex items-center gap-3">
            <AgentGlyph agent={agent.key} /> {agent.name}
          </span>
        }
        subtitle={`${agent.role} — ${agent.description}`}
        actions={
          <div className="flex items-center gap-2">
            <SmallButton variant="dark" onClick={() => ctx.newTask(agent.key)} disabled={!agent.enabled}>
              Give a task
            </SmallButton>
          </div>
        }
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Enabled" hint="Disabled agents skip all runs, including workflows.">
            <div className="flex items-center gap-3">
              <Toggle checked={enabled} onChange={setEnabled} label="Enabled" />
              <span className="text-sm text-ink/50">{enabled ? "On" : "Off"}</span>
            </div>
          </Field>
          <Field label="Model" hint={`Default: ${agent.default_model}. Stronger models cost more per run.`}>
            <select className={inputCls} value={model} onChange={(e) => setModel(e.target.value)}>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Standing instructions" hint="House rules this agent always follows, e.g. “Always offer gift wrap for orders above ₹1500”, “Never post on Sundays”.">
              <textarea className={cx(textareaCls, "min-h-28")} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Add rules in plain English…" />
            </Field>
          </div>
        </div>
      </Panel>

      <Panel title="Tools & autonomy" subtitle="What this agent can do, and what it may do without asking you.">
        <div className="grid gap-5">
          {groups.map((g) => {
            const list = tools.filter((t) => t.risk === g.risk);
            if (!list.length) return null;
            return (
              <div key={g.risk} className="grid gap-2">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-medium">{g.title}</h3>
                  <span className="text-[11px] text-ink/50">{g.hint}</span>
                </div>
                <ul className="grid gap-2 md:grid-cols-2">
                  {list.map((t) => (
                    <li key={t.name} className="grid gap-1 rounded-2xl border border-ink/10 bg-cream/50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{t.label}</span>
                        <RiskBadge risk={t.risk} />
                      </div>
                      <p className="text-[11px] leading-relaxed text-ink/50">{t.description}</p>
                      {t.risk === "action" ? (
                        <label className="mt-1 flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={auto.includes(t.name)}
                            onChange={(e) => setAuto((prev) => (e.target.checked ? [...prev, t.name] : prev.filter((x) => x !== t.name)))}
                          />
                          Auto-approve (no approval needed)
                        </label>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Panel>

      <details className="rounded-3xl border border-ink/10 bg-cream-50 p-5">
        <summary className="cursor-pointer text-sm font-medium">Built-in role instructions</summary>
        <pre className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-ink/50">{agent.system_prompt}</pre>
      </details>

      <div className="sticky bottom-4 flex items-center justify-end gap-3">
        {msg ? <span className="text-sm text-ink/50">{msg}</span> : null}
        <SmallButton variant="primary" onClick={() => void save()} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save changes"}
        </SmallButton>
      </div>
    </div>
  );
}
