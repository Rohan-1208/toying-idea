import { Link, useLocation } from "react-router-dom";
import type { Order } from "../lib/types";
import { Button } from "../components/ui";
import { formatINR } from "../lib/format";

export default function OrderConfirmed() {
  const location = useLocation();
  const order = (location.state as { order?: Order } | null)?.order;

  return (
    <div className="mx-auto max-w-2xl px-5 py-20 text-center md:py-28">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-teal/15 text-teal-deep">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <h1 className="mt-6 font-display text-4xl font-bold tracking-tightish text-ink">Order placed!</h1>
      <p className="mt-3 text-ink/60">
        Thank you{order?.customer?.name ? `, ${order.customer.name}` : ""}. We've received your order and
        started preparing your build.
      </p>

      {order && (
        <div className="mx-auto mt-8 max-w-md rounded-3xl border border-ink/10 bg-cream-100 p-6 text-left">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink/50">Order number</span>
            <span className="font-display text-lg font-bold text-ink">{order.orderNumber}</span>
          </div>
          <div className="mt-4 space-y-2 border-t border-ink/10 pt-4">
            {order.items.map((it, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-ink/70">{it.name} × {it.qty}</span>
                <span className="font-medium text-ink">{formatINR(it.price * it.qty)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between border-t border-ink/10 pt-4">
            <span className="font-semibold text-ink">Total</span>
            <span className="font-display text-xl font-bold text-ink">{formatINR(order.total)}</span>
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {order && (
          <Button to={`/track?order=${order.orderNumber}&email=${encodeURIComponent(order.customer?.email || "")}`} variant="dark">Track your order</Button>
        )}
        <Button to="/shop" variant="secondary">Continue shopping</Button>
      </div>

      {!order && (
        <p className="mt-8 text-sm text-ink/50">
          No order details to show.{" "}
          <Link to="/shop" className="font-semibold text-clay hover:underline">Go to shop</Link>
        </p>
      )}
    </div>
  );
}
