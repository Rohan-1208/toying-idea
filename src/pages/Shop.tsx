import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Product } from "../lib/types";
import { ProductCard } from "../components/ProductCard";
import { PageHeader } from "../components/Layout";
import { Spinner } from "../components/ui";

/** One filter row — curated collections (not duplicate type chips). */
const FILTERS = [
  { id: "", label: "All" },
  { id: "home-decor", label: "Home Decor" },
  { id: "character-figures", label: "Figures" },
  { id: "keychains-charms", label: "Keychains" },
  { id: "festive-seasonal", label: "Festive" },
  { id: "custom-personal", label: "Custom" },
] as const;

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
  const [error, setError] = useState("");
  const [search, setSearch] = useState(params.get("q") || "");

  // Prefer collection; migrate old ?category= links to the matching collection when possible.
  const legacyCategory = params.get("category") || "";
  const collectionParam = params.get("collection") || "";
  const collection =
    collectionParam ||
    ({
      home: "home-decor",
      collectibles: "character-figures",
      keychains: "keychains-charms",
      seasonal: "festive-seasonal",
      custom: "custom-personal",
    }[legacyCategory] ??
      "");

  const sort = params.get("sort") || "-createdAt";
  const q = params.get("q") || "";

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.products
      .list({
        collection: collection || undefined,
        q: q || undefined,
      })
      .then((res) => {
        if (active) setItems(res.items);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Could not load products");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [collection, q]);

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
    if (key === "collection") next.delete("category");
    setParams(next, { replace: true });
  };

  const active = FILTERS.find((c) => c.id === collection);

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Shop"
        title={active?.id ? active.label : "The collection"}
        subtitle={
          active?.id
            ? "A curated set of related prints — pick one or collect the set."
            : "Printed to order. Built to keep."
        }
      />

      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="sticky top-[68px] z-30 -mx-5 mb-10 flex flex-wrap items-center gap-3 border-b border-ink/10 bg-cream/90 px-5 py-4 backdrop-blur md:mx-0 md:rounded-2xl md:border md:px-5">
          <div className="flex max-w-full flex-wrap gap-1.5">
            {FILTERS.map((c) => (
              <button
                key={c.id || "all"}
                type="button"
                onClick={() => update("collection", c.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  collection === c.id ? "bg-ink text-cream-50" : "bg-ink/5 text-ink/55 hover:bg-ink/10"
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
            >
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-36 rounded-full border border-ink/15 bg-white/70 px-4 py-1.5 text-sm outline-none focus:border-clay md:w-48"
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
        ) : error ? (
          <p className="py-24 text-center text-clay-deep">{error}</p>
        ) : sorted.length === 0 ? (
          <p className="py-24 text-center text-ink/50">No products found.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {sorted.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
