import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { formatINR } from "../lib/format";

export function CartDrawer() {
  const { lines, isOpen, setOpen, setQty, remove, subtotal, count } = useCart();

  return (
    <>
      {/* backdrop */}
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm transition-opacity ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-cream shadow-2xl transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-ink/10 px-6 py-5">
          <h3 className="font-display text-xl font-bold text-ink">
            Your cart {count > 0 && <span className="text-ink/40">({count})</span>}
          </h3>
          <button onClick={() => setOpen(false)} className="text-ink/50 hover:text-ink" aria-label="Close">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-ink/50">Your cart is empty.</p>
            <Link
              to="/shop"
              onClick={() => setOpen(false)}
              className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream-50"
            >
              Browse the collection
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {lines.map((l) => (
                <div key={l.slug} className="flex gap-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-cream-200">
                    {l.image ? (
                      <img src={l.image} alt={l.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-clay-light to-clay text-cream-50 font-display font-bold">
                        {l.name[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <div className="flex justify-between gap-2">
                      <Link to={`/product/${l.slug}`} onClick={() => setOpen(false)} className="font-medium text-ink hover:text-clay">
                        {l.name}
                      </Link>
                      <button onClick={() => remove(l.slug)} className="text-ink/40 hover:text-clay" aria-label="Remove">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6l-1 14H6L5 6m5 0V4h4v2" />
                        </svg>
                      </button>
                    </div>
                    {l.options && Object.keys(l.options).length > 0 && (
                      <p className="text-xs text-ink/50">
                        {Object.values(l.options).filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center rounded-full border border-ink/15">
                        <button onClick={() => setQty(l.slug, l.qty - 1)} className="px-3 py-1 text-ink/60 hover:text-ink">−</button>
                        <span className="w-6 text-center text-sm font-semibold">{l.qty}</span>
                        <button onClick={() => setQty(l.slug, l.qty + 1)} className="px-3 py-1 text-ink/60 hover:text-ink">+</button>
                      </div>
                      <span className="font-semibold text-ink">{formatINR(l.price * l.qty)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-ink/10 px-6 py-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-ink/60">Subtotal</span>
                <span className="font-display text-xl font-bold text-ink">{formatINR(subtotal)}</span>
              </div>
              <p className="mb-4 text-xs text-ink/50">
                {subtotal >= 1500 ? "Free shipping unlocked." : "Free shipping over ₹1,500."}
              </p>
              <Link
                to="/checkout"
                onClick={() => setOpen(false)}
                className="block w-full rounded-full bg-clay py-3.5 text-center text-sm font-semibold text-white transition-colors hover:bg-clay-deep"
              >
                Checkout
              </Link>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
