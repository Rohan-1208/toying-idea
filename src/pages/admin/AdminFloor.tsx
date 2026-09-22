import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { PrintJob } from "../../lib/types";
import { formatDateTime } from "../../lib/format";
import { Spinner } from "../../components/ui";

const STATUSES = ["queued", "printing", "paused", "done"];

export default function AdminFloor() {
  const [items, setItems] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api.studio
      .printJobs()
      .then((res) => setItems(res.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load print queue"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const patch = async (job: PrintJob, body: { status?: string; printer?: string; dueAt?: string }) => {
    const { job: updated } = await api.studio.patchPrintJob(job.id, body);
    setItems((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-ink">Floor</h1>
      <p className="mt-1 text-sm text-ink/55">Print queue from live COD orders. Update status as pieces leave the bed.</p>

      {error && <p className="mt-4 rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay-deep">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-6 w-6" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-20 text-center text-ink/40">No print jobs yet. They appear when a COD order is placed.</p>
      ) : (
        <div className="mt-5 grid gap-3">
          {items.map((job) => (
            <div key={job.id} className="rounded-2xl border border-ink/10 bg-cream p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">{job.order_number}</p>
                  <p className="text-sm text-ink/55">
                    {job.sku || "SKU"} · qty {job.qty}
                    {job.due_at ? ` · due ${formatDateTime(job.due_at)}` : ""}
                  </p>
                </div>
                <select
                  value={job.status}
                  onChange={(e) => patch(job, { status: e.target.value })}
                  className="rounded-full border border-ink/15 bg-cream px-3 py-1.5 text-sm outline-none focus:border-clay"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-ink/50">
                  Printer
                  <input
                    defaultValue={job.printer || ""}
                    onBlur={(e) => {
                      if (e.target.value !== (job.printer || "")) patch(job, { printer: e.target.value });
                    }}
                    className="mt-1 w-full rounded-xl border border-ink/15 bg-white/70 px-3 py-2 text-sm text-ink"
                    placeholder="e.g. A1 Mini"
                  />
                </label>
                <label className="text-xs text-ink/50">
                  Due
                  <input
                    type="date"
                    defaultValue={job.due_at ? job.due_at.slice(0, 10) : ""}
                    onChange={(e) => patch(job, { dueAt: e.target.value ? `${e.target.value}T18:00:00.000Z` : undefined })}
                    className="mt-1 w-full rounded-xl border border-ink/15 bg-white/70 px-3 py-2 text-sm text-ink"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
