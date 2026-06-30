import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Product } from "../lib/types";
import { ProductImage } from "../components/ProductImage";
import { Badge, Button, Spinner } from "../components/ui";
import { ProductCard } from "../components/ProductCard";
import { formatINR } from "../lib/format";
import { useCart } from "../context/CartContext";

export default function ProductDetail() {
  const { slug = "" } = useParams();
  const { add } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [finish, setFinish] = useState("");
  const [color, setColor] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setQty(1);
    api.products.get(slug).then((res) => {
      if (!active) return;
      setProduct(res.product);
      setFinish(res.product?.finishes?.[0] || "");
      setColor(res.product?.colors?.[0] || "");
      setLoading(false);
      if (res.product) {
        api.products
          .list({ category: res.product.category })
          .then((r) => active && setRelated(r.items.filter((p) => p.slug !== slug).slice(0, 4)));
      }
    });
    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex justify-center py-40">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-32 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">Product not found</h1>
        <p className="mt-3 text-ink/60">It may have been removed or the link is incorrect.</p>
        <Button to="/shop" className="mt-6">Back to shop</Button>
      </div>
    );
  }

  const onAdd = () => add(product, qty, { finish, color });

  return (
    <div className="pb-16">
      <div className="mx-auto max-w-7xl px-5 pt-6 md:px-8">
        <nav className="text-sm text-ink/50">
          <Link to="/shop" className="hover:text-clay">Shop</Link>
          <span className="px-2">/</span>
          <span className="text-ink/70">{product.name}</span>
        </nav>
      </div>

      <div className="mx-auto mt-6 grid max-w-7xl gap-10 px-5 md:grid-cols-2 md:px-8">
        {/* Gallery */}
        <div>
          <div className="aspect-square overflow-hidden rounded-3xl bg-cream-200">
            <ProductImage product={product} rounded="rounded-3xl" />
          </div>
          {product.images && product.images.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {product.images.slice(0, 4).map((img, i) => (
                <div key={i} className="aspect-square overflow-hidden rounded-xl bg-cream-200">
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="md:py-2">
          {product.badges && product.badges.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {product.badges.map((b) => (
                <Badge key={b}>{b}</Badge>
              ))}
            </div>
          )}
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tightish text-ink md:text-5xl">
            {product.name}
          </h1>
          {product.collectionName && (
            <p className="mt-2 text-ink/50">{product.collectionName} collection</p>
          )}

          <div className="mt-5 flex items-baseline gap-3">
            <span className="font-display text-3xl font-bold text-ink">{formatINR(product.price)}</span>
            {product.compareAtPrice ? (
              <span className="text-lg text-ink/40 line-through">{formatINR(product.compareAtPrice)}</span>
            ) : null}
          </div>

          <p className="mt-5 leading-relaxed text-ink/70">{product.description || product.shortDescription}</p>

          {/* Options */}
          {product.finishes && product.finishes.length > 0 && (
            <div className="mt-6">
              <span className="text-sm font-medium text-ink/70">Finish</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.finishes.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFinish(f)}
                    className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                      finish === f ? "border-clay bg-clay/10 text-clay-deep" : "border-ink/15 text-ink/60 hover:border-ink/30"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          {product.colors && product.colors.length > 0 && (
            <div className="mt-4">
              <span className="text-sm font-medium text-ink/70">Color</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                      color === c ? "border-clay bg-clay/10 text-clay-deep" : "border-ink/15 text-ink/60 hover:border-ink/30"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Qty + add */}
          <div className="mt-8 flex items-center gap-3">
            <div className="flex items-center rounded-full border border-ink/15">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-4 py-2.5 text-ink/60 hover:text-ink">−</button>
              <span className="w-8 text-center font-semibold">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="px-4 py-2.5 text-ink/60 hover:text-ink">+</button>
            </div>
            <Button onClick={onAdd} size="lg" className="flex-1">
              Add to cart · {formatINR(product.price * qty)}
            </Button>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 text-center text-xs text-ink/60">
            <div className="rounded-xl bg-ink/5 px-2 py-3">
              <p className="font-semibold text-ink">{product.material || "PLA"}</p>
              <p>Material</p>
            </div>
            <div className="rounded-xl bg-ink/5 px-2 py-3">
              <p className="font-semibold text-ink">Made to order</p>
              <p>Print on demand</p>
            </div>
            <div className="rounded-xl bg-ink/5 px-2 py-3">
              <p className="font-semibold text-ink">Free over ₹1.5k</p>
              <p>Shipping</p>
            </div>
          </div>

          <p className="mt-6 text-sm text-ink/50">
            Want a custom version?{" "}
            <Link to="/pyot" className="font-semibold text-clay hover:underline">
              Print your own toy →
            </Link>
          </p>
        </div>
      </div>

      {related.length > 0 && (
        <div className="mx-auto mt-20 max-w-7xl px-5 md:px-8">
          <h2 className="mb-6 font-display text-2xl font-bold text-ink">You might also like</h2>
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
