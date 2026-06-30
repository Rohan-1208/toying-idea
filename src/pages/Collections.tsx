import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Product } from "../lib/types";
import { ProductImage } from "../components/ProductImage";
import { PageHeader } from "../components/Layout";
import { Spinner } from "../components/ui";

export default function Collections() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.products
      .list()
      .then((res) => setItems(res.items))
      .finally(() => setLoading(false));
  }, []);

  const collections = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of items) {
      const name = p.collectionName || "Other";
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(p);
    }
    return Array.from(map.entries()).map(([name, products]) => ({ name, products }));
  }, [items]);

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Featured Collections"
        title="Collections"
        subtitle="Clear hierarchy, strong rhythm, and merchandising that feels premium."
      />

      <div className="mx-auto max-w-7xl px-5 md:px-8">
        {loading ? (
          <div className="flex justify-center py-24">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {collections.map(({ name, products }) => (
              <Link
                key={name}
                to={`/shop?collection=${encodeURIComponent(name)}`}
                className="group relative block overflow-hidden rounded-3xl bg-cream-200"
              >
                <div className="aspect-[4/3]">
                  <ProductImage product={products[0]} rounded="rounded-none" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <h3 className="font-display text-2xl font-bold text-cream-50">{name}</h3>
                  <p className="text-sm text-cream-50/80">
                    {products.length} {products.length === 1 ? "piece" : "pieces"} →
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
