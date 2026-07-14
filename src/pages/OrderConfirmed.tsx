import { Link } from "react-router-dom";
import { Button } from "../components/ui";
import { isShopifyConfigured, shopifyConfig } from "../lib/shopify/config";

export default function OrderConfirmed() {
  const shopifyReady = isShopifyConfigured();
  const accountUrl = shopifyReady
    ? `https://${shopifyConfig.domain}/account`
    : undefined;

  return (
    <div className="mx-auto max-w-2xl px-5 py-20 text-center md:py-28">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-teal/15 text-teal-deep">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <h1 className="mt-6 font-display text-4xl font-bold tracking-tightish text-ink">Thanks for your order</h1>
      <p className="mt-3 text-ink/60">
        If you completed Shopify Checkout, a confirmation email is on its way with your order details and
        tracking link.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button to="/track" variant="dark">
          Track order help
        </Button>
        {accountUrl && (
          <Button href={accountUrl} target="_blank" rel="noreferrer" variant="secondary">
            Shopify account
          </Button>
        )}
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
