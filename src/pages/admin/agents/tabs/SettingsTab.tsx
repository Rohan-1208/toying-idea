import { useState } from "react";
import type { DashboardCtx } from "../AgentOSClient";
import { api, useApi, type OSSettings } from "../api";
import { Field, Panel, SmallButton, inputCls, textareaCls } from "./ui";

const PRICING_FIELDS: Array<[string, string, string]> = [
  ["machine_cost_per_hour", "Machine cost / hour (₹)", "Electricity, wear, printer depreciation"],
  ["labour_cost_per_hour", "Labour / hour (₹)", "Post-processing, painting, packing"],
  ["failure_rate", "Failure rate (0–1)", "0.1 = 10% of prints fail"],
  ["packaging_cost", "Packaging per item (₹)", ""],
  ["platform_fee_pct", "Payment/platform fee %", ""],
  ["gst_pct", "GST %", "Prices are shown GST-inclusive"],
  ["default_target_margin_pct", "Target margin %", "Before tax, after all costs"],
  ["round_to", "Price ending", "49 → prices end in 49/99"],
];

export function SettingsTab({ ctx }: { ctx: DashboardCtx }) {
  const { data } = useApi<OSSettings>("/settings");
  if (!data) return <div className="text-sm text-ink/50">Loading…</div>;
  return <SettingsForm initial={data} ctx={ctx} />;
}

function SettingsForm({ initial, ctx }: { initial: OSSettings; ctx: DashboardCtx }) {
  const [s, setS] = useState<OSSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const setPricing = (k: string, v: unknown) => setS({ ...s, pricing: { ...s.pricing, [k]: v } });
  const setFilament = (k: string, v: number) => setS({ ...s, pricing: { ...s.pricing, filament_cost_per_kg: { ...s.pricing.filament_cost_per_kg, [k]: v } } });

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const next = await api<OSSettings>("/settings", {
        method: "PATCH",
        json: {
          daily_run_budget: s.daily_run_budget,
          max_steps: s.max_steps,
          low_stock_threshold: s.low_stock_threshold,
          business: s.business,
          pricing: s.pricing,
        },
      });
      setS(next);
      await ctx.refresh();
      setMsg("Saved");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Guardrails" subtitle="Limits that keep agents safe and costs predictable.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Runs per day" hint="Top-level runs; stops new runs after this">
              <input className={inputCls} type="number" min={1} value={s.daily_run_budget} onChange={(e) => setS({ ...s, daily_run_budget: Number(e.target.value) })} />
            </Field>
            <Field label="Max steps per run" hint="Tool calls + replies">
              <input className={inputCls} type="number" min={2} max={40} value={s.max_steps} onChange={(e) => setS({ ...s, max_steps: Number(e.target.value) })} />
            </Field>
            <Field label="Low-stock at" hint="Default reorder point">
              <input className={inputCls} type="number" min={0} value={s.low_stock_threshold} onChange={(e) => setS({ ...s, low_stock_threshold: Number(e.target.value) })} />
            </Field>
          </div>
        </Panel>

        <Panel title="Brand voice" subtitle="Shared by every agent that writes to customers or posts.">
          <div className="grid gap-4">
            <Field label="Tone">
              <textarea className={textareaCls} rows={2} value={s.business.tone ?? ""} onChange={(e) => setS({ ...s, business: { ...s.business, tone: e.target.value } })} />
            </Field>
            <Field label="Lead times to quote">
              <input className={inputCls} value={s.business.production_lead_days ?? ""} onChange={(e) => setS({ ...s, business: { ...s.business, production_lead_days: e.target.value } })} />
            </Field>
          </div>
        </Panel>
      </div>

      <Panel title="Pricing model" subtitle="Used by the pricing calculator for new products and custom quotes.">
        <div className="grid gap-5">
          <div>
            <div className="mb-2 text-sm font-medium">Filament cost per kg (₹)</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {Object.entries(s.pricing.filament_cost_per_kg).map(([k, v]) => (
                <Field key={k} label={k}>
                  <input className={inputCls} type="number" min={0} value={v} onChange={(e) => setFilament(k, Number(e.target.value))} />
                </Field>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {PRICING_FIELDS.map(([k, label, hint]) => (
              <Field key={k} label={label} hint={hint || undefined}>
                <input className={inputCls} type="number" step="any" value={Number(s.pricing[k] ?? 0)} onChange={(e) => setPricing(k, Number(e.target.value))} />
              </Field>
            ))}
          </div>
        </div>
      </Panel>

      <div className="flex items-center justify-end gap-3">
        {msg ? <span className="text-sm text-ink/50">{msg}</span> : null}
        <SmallButton variant="primary" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </SmallButton>
      </div>
    </div>
  );
}
