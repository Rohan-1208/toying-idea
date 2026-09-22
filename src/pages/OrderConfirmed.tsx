import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui";

export default function OrderConfirmed() {
  const [params] = useSearchParams();
  const order = params.get("order") || "";
  const email = params.get("email") || "";
  const trackHref =
    order && email
      ? `/track?order=${encodeURIComponent(order)}&email=${encodeURIComponent(email)}`
      : "/track";

  return (
    <div className="mx-auto max-w-2xl px-5 py-20 text-center md:py-28">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-teal/15 text-teal-deep">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <h1 className="mt-6 font-display text-4xl font-bold tracking-tightish text-ink">Thanks for your order</h1>
      {order ? (
        <p className="mt-3 font-display text-xl font-semibold text-ink">{order}</p>
      ) : null}
      <p className="mt-3 text-ink/60">
        Cash on delivery. We’ll print your piece in PLA and ship from Patiala. Keep this order number to track
        status.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button to={trackHref} variant="dark">
          Track order
        </Button>
        <Button to="/shop" variant="secondary">
          Continue shopping
        </Button>
      </div>

      <p className="mt-8 text-sm text-ink/50">
        Stuck?{" "}
        <Link to="/contact" className="font-semibold text-clay hover:underline">
          Contact us
        </Link>
      </p>
    </div>
  );
}
