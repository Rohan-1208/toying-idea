import { useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { formatINR } from "../lib/format";
import { isShopifyConfigured, shopifyConfig } from "../lib/shopify/config";
import { Button, Spinner } from "../components/ui";
import { PageHeader } from "../components/Layout";

export default function Checkout() {
  const { lines, subtotal, clear, beginShopifyCheckout, shopifyReady } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const shippingHint = subtotal >= 1500 || subtotal === 0 ? 0 : 99;

  const goToShopifyCheckout = async () => {
    setError("");
    setSubmitting(true);
    try {
      const checkoutUrl = await beginShopifyCheckout();
      // Clear local cart once we hand off — Shopify owns the cart from here.
      clear();
      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Shopify checkout.");
      setSubmitting(false);
    }
  };

  if (!lines.length && !submitting) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">Your cart is empty</h1>
        <p className="mt-3 text-ink/60">Add something from the shop, then checkout securely with Shopify.</p>
        <Button to="/shop" className="mt-8">
          Browse shop
        </Button>
      </div>
    );
  }

  return (
    <div className="pb-28 md:pb-16">
      <PageHeader
        eyebrow="Checkout"
        title="Secure checkout"
        subtitle="Review your bag, then continue to Shopify for address, shipping, payments (including COD), and order email."
      />

      <div className="mx-auto grid max-w-5xl gap-8 px-5 md:grid-cols-[1.2fr_0.8fr] md:px-8">
        <section className="rounded-3xl border border-ink/10 bg-cream-100/80 p-6">
          <h2 className="font-display text-lg font-bold text-ink">Your items</h2>
          <ul className="mt-4 divide-y divide-ink/10">
            {lines.map((l) => (
              <li key={l.key} className="flex gap-4 py-4">
                {l.image ? (
                  <img src={l.image} alt="" className="h-16 w-16 rounded-xl object-cover" />
                ) : (
                  <div className="h-16 w-16 rounded-xl bg-cream-200" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{l.name}</p>
                  <p className="text-sm text-ink/50">Qty {l.qty}</p>
                </div>
                <p className="font-medium text-ink">{formatINR(l.price * l.qty)}</p>
              </li>
            ))}
          </ul>

          {!shopifyReady && (
            <p className="mt-4 rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay-deep">
              Shopify Storefront credentials are not configured. Add{" "}
              <code className="text-xs">VITE_SHOPIFY_STORE_DOMAIN</code> and{" "}
              <code className="text-xs">VITE_SHOPIFY_STOREFRONT_TOKEN</code> to enable checkout.
            </p>
          )}

          {shopifyReady && (
            <p className="mt-4 text-sm text-ink/55">
              You will complete address, PIN, state, shipping rates, COD/UPI/card, and receive confirmation
              email on{" "}
              <span className="font-medium text-ink">{shopifyConfig.domain}</span>.
            </p>
          )}
        </section>

        <aside className="h-fit rounded-3xl border border-ink/10 bg-white/70 p-6 shadow-sm">
          <h2 className="font-display text-lg font-bold text-ink">Order summary</h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between text-ink/70">
              <span>Subtotal</span>
              <span>{formatINR(subtotal)}</span>
            </div>
            <div className="flex justify-between text-ink/70">
              <span>Shipping</span>
              <span>
                {shippingHint === 0 ? "Calculated at checkout (often free ≥ ₹1500)" : `From ~${formatINR(shippingHint)}`}
              </span>
            </div>
            <div className="flex justify-between border-t border-ink/10 pt-3 font-display text-lg font-bold text-ink">
              <span>Estimated</span>
              <span>{formatINR(subtotal + shippingHint)}</span>
            </div>
          </div>

          {error && <p className="mt-4 rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay-deep">{error}</p>}

          <Button
            className="mt-6 w-full"
            disabled={submitting || !isShopifyConfigured() || !lines.length}
            onClick={goToShopifyCheckout}
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="h-4 w-4" /> Redirecting…
              </span>
            ) : (
              "Continue to Shopify Checkout"
            )}
          </Button>

          <p className="mt-3 text-center text-xs text-ink/45">
            Payments, shipping, and order emails are handled by Shopify.{" "}
            <Link to="/cart" className="underline hover:text-ink">
              Edit cart
            </Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
