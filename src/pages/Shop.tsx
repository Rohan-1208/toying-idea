import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
  const [collections, setCollections] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(params.get("q") || "");

  const category = params.get("category") || "";
  const collection = params.get("collection") || "";
  const sort = params.get("sort") || "-createdAt";
  const q = params.get("q") || "";

  useEffect(() => {
    api.collections().then((res) => setCollections(res.collections)).catch(() => {});
  }, []);

  useEffect(() => {
    setSearch(q);
  }, [q]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.products
      .list({
        category: category || undefined,
        collection: collection || undefined,
        q: q || undefined,
      })
      .then((res) => {
        if (active) setItems(res.items);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [category, collection, q]);

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
    if (key === "category") next.delete("collection");
    if (key === "collection") next.delete("category");
    setParams(next, { replace: true });
  };

  const title = collection
    ? `${collection} collection`
    : category
      ? `${CATEGORIES.find((c) => c.id === category)?.label || category} toys`
      : q
        ? `Results for “${q}”`
        : "Shop all toys";

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow={collection ? "Collection" : "The Collection"}
        title={title}
        subtitle={
          collection
            ? "Curated pieces from this drop — printed to order in premium PLA."
            : "Editorial, collectible-first, and built for gifting. Every piece printed to order in premium materials."
        }
      />

      <div className="mx-auto max-w-7xl px-5 md:px-8">
        {collection && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-clay/25 bg-clay/5 px-4 py-3">
            <span className="text-sm text-ink/70">
              Browsing <strong className="text-ink">{collection}</strong>
            </span>
            <Link to="/collections" className="text-sm font-medium text-clay hover:underline">
              All collections
            </Link>
            <button
              type="button"
              onClick={() => update("collection", "")}
              className="ml-auto text-sm text-ink/50 hover:text-ink"
            >
              Clear filter ×
            </button>
          </div>
        )}

        <div className="sticky top-[68px] z-30 -mx-5 mb-8 flex flex-wrap items-center gap-3 border-b border-ink/10 bg-cream/85 px-5 py-4 backdrop-blur md:mx-0 md:rounded-2xl md:border md:px-5">
          {!collection && (
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
          )}

          {collections.length > 0 && !collection && (
            <div className="flex flex-wrap gap-1.5 border-l border-ink/10 pl-3">
              {collections.map((name) => (
                <button
                  key={name}
                  onClick={() => update("collection", name)}
                  className="rounded-full border border-ink/15 bg-white/70 px-4 py-1.5 text-sm font-medium text-ink/70 transition-colors hover:border-clay/40 hover:text-clay-deep"
                >
                  {name}
                </button>
              ))}
            </div>
          )}

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

        {loading ? (
          <div className="flex justify-center py-24">
            <Spinner className="h-6 w-6" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-ink/50">No products found.</p>
            <Link to="/shop" className="mt-3 inline-block text-sm font-medium text-clay hover:underline">
              View all toys
            </Link>
          </div>
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
