import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import type { Product } from "../../lib/types";
import { formatINR } from "../../lib/format";
import { ProductImage } from "../../components/ProductImage";
import { Spinner } from "../../components/ui";

export default function AdminProducts() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    api.products
      .adminList()
      .then((res) => setItems(res.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load products"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Products</h1>
          <p className="mt-1 text-sm text-ink/55">Live catalog in Supabase. Add new listings from Catalog after approval.</p>
        </div>
        <Link
          to="/admin/catalog"
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream-50 transition-transform hover:-translate-y-0.5"
        >
          Photograph a product
        </Link>
      </div>

      {error && <p className="mt-4 rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay-deep">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-6 w-6" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-20 text-center text-ink/40">
          No products yet. Apply <code>supabase/schema.sql</code> or photograph a piece in Catalog.
        </p>
      ) : (
        <div className="mt-5 grid gap-3">
          {items.map((p) => (
            <div
              key={p._id || p.slug}
              className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-cream p-3"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                <ProductImage product={p} rounded="rounded-xl" width={160} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-ink">{p.name}</p>
                  {!p.inStock && (
                    <span className="rounded bg-ink/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink/50">
                      Out of stock
                    </span>
                  )}
                  {p.featured && (
                    <span className="rounded bg-gold/30 px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink/70">
                      Featured
                    </span>
                  )}
                  {p.active === false && (
                    <span className="rounded bg-clay/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-clay-deep">
                      Hidden
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-ink/50">
                  {p.category || "uncategorized"} · {p.collectionName || "—"} · /{p.slug} · stock {p.stock ?? 0}
                </p>
              </div>
              <span className="font-semibold text-ink">{formatINR(p.price)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
