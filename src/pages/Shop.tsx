import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Product } from "../lib/types";
import { ProductCard } from "../components/ProductCard";
import { PageHeader } from "../components/Layout";
import { Spinner } from "../components/ui";

const CATEGORIES = [
  { id: "", label: "All" },
  { id: "toys", label: "Toys" },
  { id: "fidget", label: "Fidget" },
  { id: "collectibles", label: "Collectibles" },
  { id: "gifting", label: "Gifting" },
];

const SORTS = [
  { id: "-createdAt", label: "Newest" },
  { id: "price", label: "Price: Low to High" },
  { id: "-price", label: "Price: High to Low" },
  { id: "name", label: "Name A–Z" },
];

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(params.get("q") || "");

  const category = params.get("category") || "";
  const sort = params.get("sort") || "-createdAt";
  const q = params.get("q") || "";

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.products
      .list({ category: category || undefined, q: q || undefined })
      .then((res) => {
        if (active) setItems(res.items);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [category, q]);

  const sorted = useMemo(() => {
    const arr = [...items];
    switch (sort) {
      case "price":
        return arr.sort((a, b) => a.price - b.price);
      case "-price":
        return arr.sort((a, b) => b.price - a.price);
      case "name":
        return arr.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return arr;
    }
  }, [items, sort]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow="The Collection"
        title="Shop all toys"
        subtitle="Editorial, collectible-first, and built for gifting. Every piece printed to order in premium materials."
      />

      <div className="mx-auto max-w-7xl px-5 md:px-8">
        {/* Controls */}
        <div className="sticky top-[68px] z-30 -mx-5 mb-8 flex flex-wrap items-center gap-3 border-b border-ink/10 bg-cream/85 px-5 py-4 backdrop-blur md:mx-0 md:rounded-2xl md:border md:px-5">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => update("category", c.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  category === c.id ? "bg-ink text-cream-50" : "bg-ink/5 text-ink/60 hover:bg-ink/10"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                update("q", search);
              }}
              className="relative"
            >
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search toys…"
                className="w-40 rounded-full border border-ink/15 bg-white/70 px-4 py-1.5 text-sm outline-none focus:border-clay md:w-52"
              />
            </form>
            <select
              value={sort}
              onChange={(e) => update("sort", e.target.value)}
              className="rounded-full border border-ink/15 bg-white/70 px-3 py-1.5 text-sm outline-none focus:border-clay"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-24">
            <Spinner className="h-6 w-6" />
          </div>
        ) : sorted.length === 0 ? (
          <p className="py-24 text-center text-ink/50">No products found. Try a different filter.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
            {sorted.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
