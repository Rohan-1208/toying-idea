import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import type { ShopifyTrackedOrder } from "../lib/types";
import { Button, Input, Spinner } from "../components/ui";
import { PageHeader } from "../components/Layout";

const STEPS: { id: ShopifyTrackedOrder["step"]; label: string }[] = [
  { id: "placed", label: "Placed" },
  { id: "confirmed", label: "Confirmed" },
  { id: "printing", label: "Preparing" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
];

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TrackOrder() {
  const [params] = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(params.get("order") || "");
  const [email, setEmail] = useState(params.get("email") || "");
  const [order, setOrder] = useState<ShopifyTrackedOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const lookup = async (number: string, mail: string) => {
    setError("");
    setOrder(null);
    setLoading(true);
    try {
      const { order: result } = await api.orders.trackShopify(number.trim(), mail.trim());
      setOrder(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order not found.");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim() || !email.trim()) {
      setError("Enter your order number and email.");
      return;
    }
    lookup(orderNumber, email);
  };

  useEffect(() => {
    const initialOrder = params.get("order") || "";
    const initialEmail = params.get("email") || "";
    if (initialOrder && initialEmail) {
      lookup(initialOrder, initialEmail);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const activeStep = order ? STEPS.findIndex((s) => s.id === order.step) : -1;
  const cancelled = order?.step === "cancelled";

  return (
    <div className="pb-20">
      <PageHeader
        eyebrow="Support"
        title="Track your order"
        subtitle="Enter the order number and email from your confirmation message."
      />

      <div className="mx-auto mt-6 max-w-2xl space-y-6 px-5 md:px-8">
        <form
          onSubmit={onSubmit}
          className="grid gap-4 rounded-3xl border border-ink/10 bg-cream-100 p-6 sm:grid-cols-[1.1fr_1.3fr_auto]"
        >
          <Input
            label="Order number"
            placeholder="#1001"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            autoComplete="off"
          />
          <Input
            label="Email"
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <div className="flex items-end">
            <Button className="w-full sm:w-auto" disabled={loading}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner className="h-4 w-4" /> Looking…
                </span>
              ) : (
                "Track"
              )}
            </Button>
          </div>
        </form>

        {error && <p className="rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay-deep">{error}</p>}

        {order && (
          <div className="rounded-3xl border border-ink/10 bg-white/70 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-ink/50">Order</p>
                <p className="font-display text-2xl font-bold text-ink">{order.orderNumber}</p>
                {order.processedAt && (
                  <p className="mt-1 text-xs text-ink/45">
                    Placed {new Date(order.processedAt).toLocaleString("en-IN")}
                  </p>
                )}
              </div>
              <div className="text-right text-sm">
                <p className="text-ink/50">Payment</p>
                <p className="font-medium text-ink">{formatLabel(order.financialStatus)}</p>
                <p className="mt-2 text-ink/50">Fulfillment</p>
                <p className="font-medium text-ink">{formatLabel(order.fulfillmentStatus)}</p>
              </div>
            </div>

            {!cancelled && (
              <ol className="mt-8 flex flex-wrap gap-2">
                {STEPS.map((s, i) => {
                  const done = activeStep >= i;
                  return (
                    <li
                      key={s.id}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        done ? "bg-teal text-white" : "bg-ink/5 text-ink/40"
                      }`}
                    >
                      {s.label}
                    </li>
                  );
                })}
              </ol>
            )}

            {cancelled && (
              <p className="mt-6 rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay-deep">
                This order was cancelled.
              </p>
            )}

            {order.fulfillments.length > 0 && (
              <div className="mt-8 border-t border-ink/10 pt-6">
                <h3 className="font-display text-lg font-bold text-ink">Shipping</h3>
                <ul className="mt-3 space-y-3">
                  {order.fulfillments.map((f, i) => (
                    <li key={i} className="rounded-2xl bg-cream-100 px-4 py-3 text-sm">
                      <p className="font-medium text-ink">{formatLabel(f.status)}</p>
                      {(f.carrier || f.number) && (
                        <p className="mt-1 text-ink/60">
                          {[f.carrier, f.number].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {f.url && (
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block font-semibold text-clay-deep underline"
                        >
                          Open carrier tracking
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-8 border-t border-ink/10 pt-6">
              <h3 className="font-display text-lg font-bold text-ink">Items</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {order.items.map((it, i) => (
                  <li key={i} className="flex justify-between gap-3 text-ink/70">
                    <span>{it.title}</span>
                    <span className="shrink-0 font-medium text-ink">×{it.quantity}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {order.statusPageUrl && (
                <Button href={order.statusPageUrl} target="_blank" rel="noreferrer">
                  Full order status
                </Button>
              )}
              <Button to="/contact" variant="secondary">
                Need help?
              </Button>
            </div>
          </div>
        )}

        <p className="text-center text-sm text-ink/50">
          Can’t find it?{" "}
          <Link to="/contact" className="font-semibold text-clay hover:underline">
            Contact us
          </Link>{" "}
          with your order number.
        </p>
      </div>
    </div>
  );
}
