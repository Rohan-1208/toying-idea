import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { formatINR } from "../lib/format";
import { Button } from "../components/ui";
import { PageHeader } from "../components/Layout";

export default function Cart() {
  const { lines, setQty, remove, subtotal } = useCart();
  const shipping = subtotal >= 1500 || subtotal === 0 ? 0 : 99;

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-32 text-center">
        <h1 className="font-display text-4xl font-bold text-ink">Your cart is empty</h1>
        <p className="mt-3 text-ink/60">Find something delightful to print.</p>
        <Button to="/shop" size="lg" className="mt-8">Browse the collection</Button>
      </div>
    );
  }

  return (
    <div className="pb-16">
      <PageHeader eyebrow="Cart" title="Your cart" />
      <div className="mx-auto mt-6 grid max-w-7xl gap-10 px-5 md:grid-cols-[1.7fr_1fr] md:px-8">
        <div className="divide-y divide-ink/10">
          {lines.map((l) => (
            <div key={l.slug} className="flex gap-4 py-5">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-cream-200">
                {l.image ? (
                  <img src={l.image} alt={l.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-clay-light to-clay font-display text-2xl font-bold text-cream-50">
                    {l.name[0]}
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col">
                <div className="flex justify-between gap-3">
                  <Link to={`/product/${l.slug}`} className="font-medium text-ink hover:text-clay">
                    {l.name}
                  </Link>
                  <span className="font-display font-bold text-ink">{formatINR(l.price * l.qty)}</span>
                </div>
                {l.options && Object.values(l.options).some(Boolean) && (
                  <p className="text-sm text-ink/50">{Object.values(l.options).filter(Boolean).join(" · ")}</p>
                )}
                <div className="mt-auto flex items-center justify-between">
                  <div className="flex items-center rounded-full border border-ink/15">
                    <button onClick={() => setQty(l.slug, l.qty - 1)} className="px-3 py-1.5 text-ink/60 hover:text-ink">−</button>
                    <span className="w-8 text-center text-sm font-semibold">{l.qty}</span>
                    <button onClick={() => setQty(l.slug, l.qty + 1)} className="px-3 py-1.5 text-ink/60 hover:text-ink">+</button>
                  </div>
                  <button onClick={() => remove(l.slug)} className="text-sm text-ink/50 hover:text-clay">Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <aside className="h-fit rounded-3xl border border-ink/10 bg-cream-100 p-6 md:sticky md:top-24">
          <h3 className="font-display text-xl font-bold text-ink">Summary</h3>
          <div className="mt-4 space-y-2.5 text-sm">
            <div className="flex justify-between text-ink/70">
              <span>Subtotal</span>
              <span className="font-medium text-ink">{formatINR(subtotal)}</span>
            </div>
            <div className="flex justify-between text-ink/70">
              <span>Shipping</span>
              <span className="font-medium text-ink">{shipping === 0 ? "Free" : formatINR(shipping)}</span>
            </div>
            <div className="mt-3 flex justify-between border-t border-ink/10 pt-3">
              <span className="font-semibold text-ink">Total</span>
              <span className="font-display text-xl font-bold text-ink">{formatINR(subtotal + shipping)}</span>
            </div>
          </div>
          <Button to="/checkout" size="lg" className="mt-6 w-full">Proceed to checkout</Button>
          <Link to="/shop" className="mt-3 block text-center text-sm text-ink/50 hover:text-clay">
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
