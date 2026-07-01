import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Order } from "../lib/types";
import { Button, Input } from "../components/ui";
import { PageHeader } from "../components/Layout";
import { formatINR, formatDateTime } from "../lib/format";

const STEPS: { id: Order["status"]; label: string }[] = [
  { id: "pending", label: "Placed" },
  { id: "confirmed", label: "Confirmed" },
  { id: "printing", label: "Printing" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
];

export default function TrackOrder() {
  const [params] = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(params.get("order") || "");
  const [email, setEmail] = useState(params.get("email") || "");
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchOrder = async (number: string, mail: string) => {
    setError("");
    setOrder(null);
    setLoading(true);
    try {
      const { order } = await api.orders.track(number.trim(), mail.trim());
      setOrder(order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order not found.");
    } finally {
      setLoading(false);
    }
  };

  const lookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber || !email) {
      setError("Enter your order number and email.");
      return;
    }
    fetchOrder(orderNumber, email);
  };

  useEffect(() => {
    const initialOrder = params.get("order") || "";
    const initialEmail = params.get("email") || "";
    if (initialOrder && initialEmail) {
      fetchOrder(initialOrder, initialEmail);
    }
  }, [params]);

  const activeStep = order ? STEPS.findIndex((s) => s.id === order.status) : -1;
  const cancelled = order?.status === "cancelled";

  return (
    <div className="pb-20">
      <PageHeader eyebrow="Support" title="Track your order" subtitle="Enter your order number and email to see where your build is." />

      <div className="mx-auto mt-6 max-w-2xl px-5 md:px-8">
        <form onSubmit={lookup} className="grid gap-4 rounded-3xl border border-ink/10 bg-cream-100 p-6 sm:grid-cols-[1.2fr_1.4fr_auto]">
          <Input label="Order number" placeholder="TI-20260624-1234" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
          <Input label="Email" type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="flex items-end">
            <Button className="w-full sm:w-auto" disabled={loading}>{loading ? "Looking…" : "Track"}</Button>
          </div>
        </form>

        {error && <p className="mt-4 rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay-deep">{error}</p>}

        {order && (
          <div className="mt-8 rounded-3xl border border-ink/10 bg-white/60 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm text-ink/50">Order</p>
                <p className="font-display text-xl font-bold text-ink">{order.orderNumber}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                  cancelled ? "bg-clay/15 text-clay-deep" : "bg-teal/15 text-teal-deep"
                }`}
              >
                {order.status}
              </span>
            </div>

            {!cancelled ? (
              <div className="mt-8">
                <div className="relative flex justify-between">
                  <div className="absolute left-0 right-0 top-3 h-0.5 bg-ink/10" />
                  <div
                    className="absolute left-0 top-3 h-0.5 bg-clay transition-all"
                    style={{ width: `${(Math.max(activeStep, 0) / (STEPS.length - 1)) * 100}%` }}
                  />
                  {STEPS.map((s, i) => (
                    <div key={s.id} className="relative z-10 flex flex-col items-center">
                      <span
                        className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold ${
                          i <= activeStep ? "bg-clay text-white" : "bg-cream-200 text-ink/40"
                        }`}
                      >
                        {i < activeStep ? "✓" : i + 1}
                      </span>
                      <span className={`mt-2 text-[11px] ${i <= activeStep ? "font-semibold text-ink" : "text-ink/40"}`}>
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-6 rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay-deep">
                This order was cancelled. Contact us if you think this is a mistake.
              </p>
            )}

            <div className="mt-8 space-y-2 border-t border-ink/10 pt-5">
              {order.items.map((it, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-ink/70">{it.name} × {it.qty}</span>
                  <span className="font-medium text-ink">{formatINR(it.price * it.qty)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-ink/10 pt-3">
                <span className="font-semibold text-ink">Total</span>
                <span className="font-display font-bold text-ink">{formatINR(order.total)}</span>
              </div>
            </div>
            <p className="mt-4 text-xs text-ink/45">Placed {formatDateTime(order.createdAt)}</p>

            {order.tracking?.number && (
              <div className="mt-5 rounded-xl border border-teal/20 bg-teal/5 px-4 py-3 text-sm">
                <p className="font-semibold text-teal-deep">Shipment</p>
                <p className="mt-1 text-ink/70">
                  {order.tracking.carrier && <span>{order.tracking.carrier} · </span>}
                  {order.tracking.number}
                </p>
                {order.tracking.url && (
                  <a href={order.tracking.url} className="mt-2 inline-block text-clay underline" target="_blank" rel="noreferrer">
                    Track package
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
