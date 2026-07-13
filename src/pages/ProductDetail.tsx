import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Product } from "../lib/types";
import { ProductGallery } from "../components/ProductGallery";
import { Badge, Button, Spinner } from "../components/ui";
import { ProductCard } from "../components/ProductCard";
import { formatINR } from "../lib/format";
import { resolveProductImage, resolveProductPrice, resolveVariant, isBundleProduct, bundleIncludes } from "../lib/cart";
import { useCart } from "../context/CartContext";

export default function ProductDetail() {
  const { slug = "" } = useParams();
  const { add } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [variantId, setVariantId] = useState("");
  const [finish, setFinish] = useState("");
  const [color, setColor] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setQty(1);
    api.products.get(slug).then((res) => {
      if (!active) return;
      const p = res.product;
      setProduct(p);
      const variant = p ? resolveVariant(p, "") : undefined;
      setVariantId(variant?.id || "");
      setFinish(p?.finishes?.[0] || variant?.finish || "");
      setColor(p?.colors?.[0] || "");
      setLoading(false);
      if (p) {
        const cat = p.categories?.[0] || p.category;
        api.products
          .list({ category: cat })
          .then((r) => active && setRelated(r.items.filter((item) => item.slug !== slug).slice(0, 4)));
      }
    });
    return () => {
      active = false;
    };
  }, [slug]);

  const selectedVariant = useMemo(
    () => (product ? resolveVariant(product, variantId) : undefined),
    [product, variantId]
  );

  const unitPrice = product ? resolveProductPrice(product, variantId) : 0;
  const galleryImages = useMemo(() => {
    if (!product) return [];
    const imgs = product.images?.length ? product.images : [];
    const thumb = product.thumbnail;
    if (thumb && !imgs.includes(thumb)) return [thumb, ...imgs];
    return imgs.length ? imgs : thumb ? [thumb] : [];
  }, [product]);

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

  const bundle = product ? isBundleProduct(product) : false;
  const includes = product ? bundleIncludes(product) : [];

  const onAdd = () =>
    add(product, qty, {
      ...(bundle ? { bundle: "1" } : { variantId: selectedVariant?.id || "", variantLabel: selectedVariant?.label || "" }),
      finish,
      color,
    });

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
        <div>
          {galleryImages.length > 0 ? (
            <ProductGallery images={galleryImages} alt={product.name} />
          ) : (
            <div className="aspect-square overflow-hidden rounded-3xl bg-cream-200">
              <img src={resolveProductImage(product)} alt={product.name} className="h-full w-full object-cover" />
            </div>
          )}
        </div>

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
          {(product.tagline || product.collectionName) && (
            <p className="mt-2 text-ink/50">
              {product.tagline || `${product.collectionName} collection`}
            </p>
          )}

          <div className="mt-5 flex items-baseline gap-3">
            <span className="font-display text-3xl font-bold text-ink">{formatINR(unitPrice)}</span>
            {product.compareAtPrice ? (
              <span className="text-lg text-ink/40 line-through">{formatINR(product.compareAtPrice)}</span>
            ) : null}
          </div>

          <p className="mt-5 leading-relaxed text-ink/70">{product.description || product.shortDescription}</p>

          {bundle && includes.length > 0 && (
            <div className="mt-6">
              <span className="text-sm font-medium text-ink/70">This collection includes</span>
              <ul className="mt-2 space-y-1.5">
                {includes.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-ink/70">
                    <span className="h-1.5 w-1.5 rounded-full bg-clay" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-ink/50">Sold as one complete collection for {formatINR(product.price)}.</p>
            </div>
          )}

          {!bundle && product.variants && product.variants.length > 0 && (
            <div className="mt-6">
              <span className="text-sm font-medium text-ink/70">Option</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.variants
                  .filter((v) => v.inStock !== false)
                  .map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setVariantId(v.id)}
                      className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                        variantId === v.id
                          ? "border-clay bg-clay/10 text-clay-deep"
                          : "border-ink/15 text-ink/60 hover:border-ink/30"
                      }`}
                    >
                      {v.label}
                      <span className="ml-1 text-ink/40">· {formatINR(v.price.amount)}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {product.finishes && product.finishes.length > 0 && !product.variants?.length && (
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

          <div className="mt-8 flex items-center gap-3">
            <div className="flex items-center rounded-full border border-ink/15">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-4 py-2.5 text-ink/60 hover:text-ink">−</button>
              <span className="w-8 text-center font-semibold">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="px-4 py-2.5 text-ink/60 hover:text-ink">+</button>
            </div>
            <Button onClick={onAdd} size="lg" className="flex-1">
              Add to cart · {formatINR(unitPrice * qty)}
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
