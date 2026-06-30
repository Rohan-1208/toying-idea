import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { Inquiry } from "../../lib/types";
import { formatDateTime } from "../../lib/format";
import { Spinner } from "../../components/ui";

const TYPES = [
  { id: "", label: "All" },
  { id: "pyot", label: "PYOT" },
  { id: "gifting", label: "Gifting" },
  { id: "contact", label: "Contact" },
];

const STATUSES = ["new", "in-review", "quoted", "approved", "printing", "completed", "closed"];

export default function AdminInquiries() {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [type, setType] = useState("");

  const load = () => {
    setLoading(true);
    api.inquiries
      .adminList({ type: type || undefined })
      .then((res) => setItems(res.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load inquiries"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [type]);

  const setStatus = async (inq: Inquiry, status: string) => {
    if (!inq._id) return;
    const { inquiry } = await api.inquiries.adminUpdate(inq._id, status);
    setItems((prev) => prev.map((i) => (i._id === inquiry._id ? inquiry : i)));
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-ink">Inquiries</h1>

      <div className="mt-5 flex gap-1.5">
        {TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setType(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              type === t.id ? "bg-ink text-cream-50" : "bg-ink/5 text-ink/60 hover:bg-ink/10"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay-deep">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>
      ) : items.length === 0 ? (
        <p className="py-20 text-center text-ink/40">No inquiries found.</p>
      ) : (
        <div className="mt-5 grid gap-3">
          {items.map((inq) => (
            <div key={inq._id} className="rounded-2xl border border-ink/10 bg-cream p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink/60">{inq.type}</span>
                    <p className="font-medium text-ink">{inq.name}</p>
                  </div>
                  <p className="text-sm text-ink/55">{inq.email}{inq.phone ? ` · ${inq.phone}` : ""}</p>
                  <p className="text-xs text-ink/40">{formatDateTime(inq.createdAt)}</p>
                </div>
                <select
                  value={inq.status || "new"}
                  onChange={(e) => setStatus(inq, e.target.value)}
                  className="rounded-full border border-ink/15 bg-cream px-3 py-1.5 text-sm outline-none focus:border-clay"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {inq.message && <p className="mt-3 rounded-xl bg-ink/[0.03] p-3 text-sm text-ink/70">{inq.message}</p>}

              {inq.details && Object.keys(inq.details).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink/60">
                  {Object.entries(inq.details).map(([k, v]) =>
                    v ? (
                      <span key={k}>
                        <span className="font-semibold text-ink/70 capitalize">{k}:</span> {String(v)}
                      </span>
                    ) : null
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
