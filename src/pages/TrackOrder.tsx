import { Link } from "react-router-dom";
import { isShopifyConfigured, shopifyConfig } from "../lib/shopify/config";
import { Button, Input } from "../components/ui";
import { PageHeader } from "../components/Layout";
import { useState } from "react";

export default function TrackOrder() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");

  const shopifyReady = isShopifyConfigured();
  const accountOrdersUrl = shopifyReady
    ? `https://${shopifyConfig.domain}/account/orders`
    : "https://shopify.com/account";

  return (
    <div className="pb-20">
      <PageHeader
        eyebrow="Support"
        title="Track your order"
        subtitle="Orders are managed in Shopify. Use the confirmation email link, or open your Shopify order status / account."
      />

      <div className="mx-auto mt-6 max-w-2xl space-y-6 px-5 md:px-8">
        <div className="rounded-3xl border border-ink/10 bg-cream-100 p-6">
          <h2 className="font-display text-lg font-bold text-ink">Best way</h2>
          <p className="mt-2 text-sm text-ink/60">
            Open the order confirmation email from Shopify and click <strong>View your order</strong>. That page
            shows payment, shipping, and tracking updates automatically.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button href={accountOrdersUrl} target="_blank" rel="noreferrer">
              Open order account
            </Button>
            <Button to="/contact" variant="secondary">
              Contact us
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border border-dashed border-ink/15 bg-white/50 p-6">
          <h3 className="font-medium text-ink">Have your order number handy?</h3>
          <p className="mt-1 text-sm text-ink/55">
            Include it when you message us — we fulfill from Shopify Admin.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input
              label="Order number"
              placeholder="From your email"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <p className="mt-4 text-sm text-ink/60">
            Prefer email? Write to us via{" "}
            <Link className="text-clay-deep underline" to="/contact">
              Contact
            </Link>
            {orderNumber ? ` and mention ${orderNumber}` : ""}.
          </p>
        </div>
      </div>
    </div>
  );
}
