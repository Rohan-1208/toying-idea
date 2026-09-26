"use client";

import { useEffect, useState } from "react";
import { api, type AgentConfig } from "@/app/admin/agents/api";
import { AgentGlyph, Field, SmallButton, cx, inputCls, textareaCls } from "@/app/admin/agents/tabs/ui";

const EXAMPLES: Record<string, string[]> = {
  orchestrator: [
    "Launch the product in the attached photo as a new listing, then draft 2 launch posts for it.",
    "What should I focus on this week? Check sales, stuck orders and open custom requests.",
  ],
  order_customer: [
    "Check all orders placed more than 2 days ago that are still 'Placed' and draft updates for those customers.",
    "Reply to the latest gifting request with an indicative quote.",
  ],
  product_launch: [
    "Create a draft listing for the attached toy. It's ~90 g of PLA and prints in 5 hours. Offer Small and Medium sizes.",
    "Review our price ladder for all dino products and suggest corrections.",
  ],
  content: [
    "Plan a 5-day Diwali gifting campaign for Instagram with 3 posts and 2 reels.",
    "Write 3 caption options for our best seller this month.",
  ],
  design_3d: [
    "Design a print-in-place articulated snake keychain, 90 mm long, and write the Blender script.",
    "Write a design brief for the latest PYOT request.",
  ],
  intelligence: [
    "Give me a 30-day business report with the top 5 things to act on.",
    "Which custom-request themes keep coming up that we could turn into products?",
  ],
};

export function NewTaskPanel({
  agents,
  initialAgent,
  initialTask,
  onClose,
  onStarted,
}: {
  agents: AgentConfig[];
  initialAgent?: string;
  initialTask?: string;
  onClose: () => void;
  onStarted: (runId: string) => void;
}) {
  const [agent, setAgent] = useState(initialAgent ?? "orchestrator");
  const [task, setTask] = useState(initialTask ?? "");
  const [images, setImages] = useState<Array<{ upload_id: string; name: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setErr(null);
    try {
      for (const f of Array.from(files).slice(0, 4)) {
        const fd = new FormData();
        fd.append("file", f);
        const res = await fetch("/api/admin/uploads/image", { method: "POST", body: fd });
        if (!res.ok) throw new Error("Upload failed");
        const j = (await res.json()) as { id: string };
        setImages((prev) => [...prev, { upload_id: j.id, name: f.name }]);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function start() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ run_id: string }>(`/agents/${agent}/run`, {
        method: "POST",
        json: { task, attachments: images.map((i) => ({ upload_id: i.upload_id })) },
      });
      onStarted(r.run_id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to start");
      setBusy(false);
    }
  }

  const selected = agents.find((a) => a.key === agent);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="New task">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ti-cocoa/35 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative grid w-full max-w-2xl gap-4 rounded-[var(--radius-lg)] border border-border bg-ti-cream p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-0.5">
            <h2 className="font-[var(--font-ti-display)] text-2xl tracking-tight">New task</h2>
            <p className="text-xs text-muted">Not sure who should do it? Leave it with the Orchestrator.</p>
          </div>
          <SmallButton onClick={onClose}>Close</SmallButton>
        </div>

        <div className="flex flex-wrap gap-2">
          {agents.map((a) => (
            <button
              key={a.key}
              type="button"
              disabled={!a.enabled}
              onClick={() => setAgent(a.key)}
              className={cx(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition disabled:opacity-40",
                agent === a.key ? "border-ti-orange bg-surface font-medium" : "border-border hover:bg-surface",
              )}
            >
              <AgentGlyph agent={a.key} className="h-5 w-5 rounded-md text-[10px]" />
              {a.name.replace(" Agent", "")}
            </button>
          ))}
        </div>
        {selected ? <p className="-mt-2 text-[11px] text-muted">{selected.description}</p> : null}

        <Field label="What should be done?">
          <textarea className={cx(textareaCls, "min-h-36")} value={task} onChange={(e) => setTask(e.target.value)} placeholder="Describe the task in plain English…" autoFocus />
        </Field>

        <div className="flex flex-wrap gap-2">
          {(EXAMPLES[agent] ?? []).map((ex) => (
            <button key={ex} type="button" onClick={() => setTask(ex)} className="rounded-full border border-dashed border-border px-3 py-1 text-left text-[11px] text-muted hover:border-ti-orange hover:text-ti-cocoa">
              {ex}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className={cx(inputCls, "flex w-auto cursor-pointer items-center gap-2 text-xs")}>
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void upload(e.target.files)} />
            {uploading ? "Uploading…" : "📎 Attach product photos"}
          </label>
          {images.map((i) => (
            <span key={i.upload_id} className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1 text-[11px]">
              {i.name}
              <button type="button" aria-label={`Remove ${i.name}`} onClick={() => setImages((p) => p.filter((x) => x.upload_id !== i.upload_id))}>
                ×
              </button>
            </span>
          ))}
        </div>

        {err ? <div className="text-sm text-red-700">{err}</div> : null}
        <div className="flex justify-end gap-2">
          <SmallButton onClick={onClose}>Cancel</SmallButton>
          <SmallButton variant="primary" onClick={() => void start()} disabled={busy || task.trim().length < 3}>
            {busy ? "Starting…" : "Start task"}
          </SmallButton>
        </div>
      </div>
    </div>
  );
}
