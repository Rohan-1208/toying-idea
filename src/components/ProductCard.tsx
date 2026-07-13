import { Link } from "react-router-dom";
import type { Product } from "../lib/types";
import { ProductImage } from "./ProductImage";
import { StarRating } from "./StarRating";
import { Badge } from "./ui";
import { formatINR } from "../lib/format";
import { useCart } from "../context/CartContext";

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const rating = product.rating ?? 5;
  const reviewCount = product.reviewCount ?? 0;

  return (
    <div className="group flex flex-col">
      <Link to={`/product/${product.slug}`} className="relative block aspect-square overflow-hidden rounded-2xl bg-cream-200">
        <ProductImage product={product} />
        {product.badges && product.badges.length > 0 && (
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {product.badges.slice(0, 2).map((b) => (
              <Badge key={b}>{b}</Badge>
            ))}
          </div>
        )}
        <button
          onClick={(e) => {
            e.preventDefault();
            add(product, 1);
          }}
          className="absolute bottom-3 right-3 rounded-full bg-ink px-4 py-2.5 text-xs font-semibold text-cream-50 shadow-md transition-all active:scale-95 md:translate-y-2 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100"
        >
          Add +
        </button>
      </Link>

      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/product/${product.slug}`} className="font-medium leading-tight text-ink hover:text-clay">
            {product.name}
          </Link>
          <div className="mt-1 flex items-center gap-1.5">
            <StarRating value={rating} size="sm" />
            {reviewCount > 0 && <span className="text-[11px] text-ink/45">({reviewCount})</span>}
          </div>
          {product.collectionName && (
            <p className="text-xs text-ink/45">{product.collectionName}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <span className="font-display font-bold text-ink">{formatINR(product.price)}</span>
          {product.compareAtPrice ? (
            <span className="block text-xs text-ink/40 line-through">{formatINR(product.compareAtPrice)}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
