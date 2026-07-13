import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { Product } from "../../lib/types";
import { formatINR } from "../../lib/format";
import { ProductImage } from "../../components/ProductImage";
import { Button, Input, Textarea, Spinner } from "../../components/ui";

const empty: Partial<Product> = {
  name: "",
  price: 0,
  category: "toys",
  collectionName: "",
  description: "",
  shortDescription: "",
  material: "PLA",
  stock: 100,
  featured: false,
  active: true,
  tags: [],
  badges: [],
  images: [],
  finishes: [],
  colors: [],
};

const toList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const fromList = (a?: string[]) => (a || []).join(", ");

export default function AdminProducts() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.products
      .adminList()
      .then((res) => setItems(res.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load products"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      const payload = { ...editing, price: Number(editing.price) || 0, stock: Number(editing.stock) || 0 };
      if (editing._id) {
        await api.products.update(editing._id, payload);
      } else {
        await api.products.create(payload);
      }
      setEditing(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Product) => {
    if (!p._id) return;
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    await api.products.remove(p._id);
    load();
  };

  const set = (k: keyof Product, v: unknown) => setEditing((e) => (e ? { ...e, [k]: v } : e));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-ink">Products</h1>
        <Button onClick={() => setEditing({ ...empty })}>+ New product</Button>
      </div>

      {error && <p className="mt-4 rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay-deep">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>
      ) : items.length === 0 ? (
        <p className="py-20 text-center text-ink/40">No products yet. Create your first one.</p>
      ) : (
        <div className="mt-5 grid gap-3">
          {items.map((p) => (
            <div key={p._id || p.slug} className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-cream p-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                <ProductImage product={p} rounded="rounded-xl" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-ink">{p.name}</p>
                  {!p.active && <span className="rounded bg-ink/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink/50">Hidden</span>}
                  {p.featured && <span className="rounded bg-gold/30 px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink/70">Featured</span>}
                </div>
                <p className="truncate text-xs text-ink/50">{p.category} · {p.collectionName || "—"} · stock {p.stock ?? 0}</p>
              </div>
              <span className="font-semibold text-ink">{formatINR(p.price)}</span>
              <div className="flex gap-1">
                <button onClick={() => setEditing({ ...p, tags: p.tags, badges: p.badges })} className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-ink/5">Edit</button>
                <button onClick={() => remove(p)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-clay hover:bg-clay/5">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor drawer */}
      {editing && (
        <>
          <div className="fixed inset-0 z-50 bg-ink/30" onClick={() => setEditing(null)} />
          <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-xl overflow-y-auto bg-cream p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-ink">{editing._id ? "Edit product" : "New product"}</h2>
              <button onClick={() => setEditing(null)} className="text-ink/50 hover:text-ink">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={save} className="mt-5 space-y-4">
              <Input label="Name" value={editing.name || ""} onChange={(e) => set("name", e.target.value)} required />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Price (₹)" type="number" value={editing.price ?? 0} onChange={(e) => set("price", e.target.value)} required />
                <Input label="Compare-at price (₹)" type="number" value={editing.compareAtPrice ?? ""} onChange={(e) => set("compareAtPrice", e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Category" value={editing.category || ""} onChange={(e) => set("category", e.target.value)} />
                <Input label="Collection" value={editing.collectionName || ""} onChange={(e) => set("collectionName", e.target.value)} />
              </div>
              <Input label="Short description" value={editing.shortDescription || ""} onChange={(e) => set("shortDescription", e.target.value)} />
              <Textarea label="Description" rows={4} value={editing.description || ""} onChange={(e) => set("description", e.target.value)} />

              <Input label="Image URLs (comma separated)" value={fromList(editing.images)} onChange={(e) => set("images", toList(e.target.value))} placeholder="Google Drive share link or https://…" />
              <Input label="Thumbnail URL" value={editing.thumbnail || ""} onChange={(e) => set("thumbnail", e.target.value)} />
              <p className="-mt-2 text-xs text-ink/45">
                Paste Google Drive share links (anyone with link) or other image URLs. Drive links are auto-converted for display.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Tags (comma separated)" value={fromList(editing.tags)} onChange={(e) => set("tags", toList(e.target.value))} />
                <Input label="Badges (premium, limited, trending, fun, new)" value={fromList(editing.badges)} onChange={(e) => set("badges", toList(e.target.value))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Input label="Material" value={editing.material || ""} onChange={(e) => set("material", e.target.value)} />
                <Input label="Stock" type="number" value={editing.stock ?? 0} onChange={(e) => set("stock", e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Finishes (comma separated)" value={fromList(editing.finishes)} onChange={(e) => set("finishes", toList(e.target.value))} />
                <Input label="Colors (comma separated)" value={fromList(editing.colors)} onChange={(e) => set("colors", toList(e.target.value))} />
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm text-ink/70">
                  <input type="checkbox" checked={!!editing.featured} onChange={(e) => set("featured", e.target.checked)} />
                  Featured
                </label>
                <label className="flex items-center gap-2 text-sm text-ink/70">
                  <input type="checkbox" checked={editing.active !== false} onChange={(e) => set("active", e.target.checked)} />
                  Active (visible in shop)
                </label>
                <label className="flex items-center gap-2 text-sm text-ink/70">
                  <input
                    type="checkbox"
                    checked={editing.pricingMode === "bundle"}
                    onChange={(e) => set("pricingMode", e.target.checked ? "bundle" : "variant")}
                  />
                  Bundle pricing (one price for whole collection)
                </label>
              </div>

              {error && <p className="rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay-deep">{error}</p>}

              <div className="flex gap-3 pt-2">
                <Button className="flex-1" disabled={saving}>{saving ? "Saving…" : "Save product"}</Button>
                <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              </div>
            </form>
          </aside>
        </>
      )}
    </div>
  );
}
