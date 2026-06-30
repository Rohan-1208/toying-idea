import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";
import type { Order, OrderStatus } from "../../lib/types";
import { formatINR, formatDateTime } from "../../lib/format";
import { Spinner } from "../../components/ui";

const STATUSES: OrderStatus[] = ["pending", "confirmed", "printing", "shipped", "delivered", "cancelled"];

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-gold/20 text-ink",
  confirmed: "bg-teal/15 text-teal-deep",
  printing: "bg-clay/15 text-clay-deep",
  shipped: "bg-teal-deep/15 text-teal-deep",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-clay/10 text-clay-deep",
};

export default function AdminOrders() {
  const [params] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState(params.get("focus") || "");
  const [selected, setSelected] = useState<Order | null>(null);

  const load = () => {
    setLoading(true);
    api.orders
      .adminList({ status: statusFilter || undefined, q: q || undefined })
      .then((res) => setOrders(res.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load orders"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const updateStatus = async (order: Order, status: OrderStatus) => {
    const { order: updated } = await api.orders.adminUpdate(order._id || order.orderNumber, { status });
    setOrders((prev) => prev.map((o) => (o._id === updated._id ? updated : o)));
    setSelected((s) => (s && s._id === updated._id ? updated : s));
  };

  const updatePayment = async (order: Order, paymentStatus: string) => {
    const { order: updated } = await api.orders.adminUpdate(order._id || order.orderNumber, { paymentStatus });
    setOrders((prev) => prev.map((o) => (o._id === updated._id ? updated : o)));
    setSelected((s) => (s && s._id === updated._id ? updated : s));
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-ink">Orders</h1>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
          className="flex gap-2"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search order / email / name"
            className="w-56 rounded-full border border-ink/15 bg-cream px-4 py-2 text-sm outline-none focus:border-clay"
          />
          <button className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-cream-50">Search</button>
        </form>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-full border border-ink/15 bg-cream px-3 py-2 text-sm outline-none focus:border-clay"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {error && <p className="mt-4 rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay-deep">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>
      ) : orders.length === 0 ? (
        <p className="py-20 text-center text-ink/40">No orders found.</p>
      ) : (
        <div className="mt-5 overflow-hidden rounded-2xl border border-ink/10 bg-cream">
          <table className="w-full text-sm">
            <thead className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-ink/40">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="hidden px-4 py-3 sm:table-cell">Date</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {orders.map((o) => (
                <tr key={o._id} onClick={() => setSelected(o)} className="cursor-pointer hover:bg-ink/[0.03]">
                  <td className="px-4 py-3 font-medium text-ink">{o.orderNumber}</td>
                  <td className="px-4 py-3 text-ink/70">
                    <div>{o.customer.name}</div>
                    <div className="text-xs text-ink/40">{o.customer.email}</div>
                  </td>
                  <td className="hidden px-4 py-3 text-ink/60 sm:table-cell">{formatDateTime(o.createdAt)}</td>
                  <td className="px-4 py-3 font-semibold text-ink">{formatINR(o.total)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLE[o.status]}`}>
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <>
          <div className="fixed inset-0 z-50 bg-ink/30" onClick={() => setSelected(null)} />
          <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-lg overflow-y-auto bg-cream p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-ink/50">Order</p>
                <h2 className="font-display text-2xl font-bold text-ink">{selected.orderNumber}</h2>
                <p className="text-xs text-ink/50">{formatDateTime(selected.createdAt)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-ink/50 hover:text-ink">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-ink/[0.03] p-4">
              <p className="font-medium text-ink">{selected.customer.name}</p>
              <p className="text-sm text-ink/60">{selected.customer.email}</p>
              {selected.customer.phone && <p className="text-sm text-ink/60">{selected.customer.phone}</p>}
              {selected.shippingAddress?.line1 && (
                <p className="mt-2 text-sm text-ink/60">
                  {[selected.shippingAddress.line1, selected.shippingAddress.line2, selected.shippingAddress.city, selected.shippingAddress.state, selected.shippingAddress.pincode]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
            </div>

            <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-ink/40">Items</h3>
            <div className="mt-2 space-y-2">
              {selected.items.map((it, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-ink/70">
                    {it.name} × {it.qty}
                    {it.options && Object.values(it.options).some(Boolean) && (
                      <span className="text-ink/40"> · {Object.values(it.options).filter(Boolean).join(", ")}</span>
                    )}
                  </span>
                  <span className="font-medium text-ink">{formatINR(it.price * it.qty)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between border-t border-ink/10 pt-3">
              <span className="font-semibold text-ink">Total</span>
              <span className="font-display font-bold text-ink">{formatINR(selected.total)}</span>
            </div>

            <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-ink/40">Update status</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(selected, s)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                    selected.status === s ? "bg-ink text-cream-50" : "bg-ink/5 text-ink/60 hover:bg-ink/10"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-ink/40">Payment</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {["unpaid", "paid", "refunded"].map((s) => (
                <button
                  key={s}
                  onClick={() => updatePayment(selected, s)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                    selected.paymentStatus === s ? "bg-teal text-white" : "bg-ink/5 text-ink/60 hover:bg-ink/10"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
