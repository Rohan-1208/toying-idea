import { StarRating } from "./StarRating";
import { isShopifyConfigured } from "../lib/shopify/config";

/**
 * Reviews are owned by Shopify (Product Reviews / Judge.me / etc.).
 * This block shows product rating fields when present and points shoppers to leave a review after purchase.
 */
export function ProductReviews({
  productName,
  rating,
  reviewCount,
}: {
  slug?: string;
  productName: string;
  rating?: number;
  reviewCount?: number;
}) {
  const average = rating ?? 0;
  const count = reviewCount ?? 0;
  const shopify = isShopifyConfigured();

  return (
    <section className="mx-auto mt-16 max-w-7xl border-t border-ink/10 px-5 pt-12 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-ink">Customer reviews</h2>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {count > 0 ? (
              <>
                <StarRating value={average} />
                <span className="text-sm text-ink/60">
                  {average.toFixed(1)} · {count} review{count === 1 ? "" : "s"}
                </span>
              </>
            ) : (
              <span className="text-sm text-ink/55">No published reviews yet for {productName}.</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 max-w-2xl rounded-2xl border border-ink/10 bg-cream-100/80 p-5 text-sm text-ink/65">
        {shopify ? (
          <p>
            Reviews are collected through Shopify after purchase. Install{" "}
            <strong>Shopify Product Reviews</strong> (or Judge.me) in your Shopify Admin to gather ratings and
            show them on product pages.
          </p>
        ) : (
          <p>Connect Shopify to collect and display verified reviews from completed orders.</p>
        )}
      </div>
    </section>
  );
}
