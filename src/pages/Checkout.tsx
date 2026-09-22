import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { api } from "../lib/api";
import { formatINR } from "../lib/format";
import { INDIAN_STATES, validateCheckoutForm, type CheckoutFormData } from "../lib/checkout-form";
import { Button, Input, Select, Spinner, Textarea } from "../components/ui";
import { PageHeader } from "../components/Layout";

const EMPTY: CheckoutFormData = {
  name: "",
  email: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
  paymentMethod: "cod",
  notes: "",
};

export default function Checkout() {
  const { lines, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState<CheckoutFormData>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const shipping = subtotal >= 1500 || subtotal === 0 ? 0 : 99;
  const total = subtotal + shipping;

  const set = (key: keyof CheckoutFormData) => (e: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const invalid = validateCheckoutForm(form);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSubmitting(true);
    try {
      const { order } = await api.orders.create({
        customer: { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() },
        shippingAddress: {
          line1: form.line1.trim(),
          line2: form.line2.trim(),
          city: form.city.trim(),
          state: form.state,
          pincode: form.pincode.trim(),
          country: "India",
        },
        items: lines.map((l) => ({
          productId: l.productId,
          slug: l.slug,
          qty: l.qty,
          options: l.options,
        })),
        paymentMethod: "cod",
        notes: form.notes.trim(),
      });
      clear();
      navigate(
        `/order-confirmed?order=${encodeURIComponent(order.orderNumber)}&email=${encodeURIComponent(form.email.trim())}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place order. Please try again.");
      setSubmitting(false);
    }
  };

  if (!lines.length && !submitting) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">Your cart is empty</h1>
        <p className="mt-3 text-ink/60">Add something from the shop to continue.</p>
        <Button to="/shop" className="mt-8">
          Browse shop
        </Button>
      </div>
    );
  }

  return (
    <div className="pb-28 md:pb-16">
      <PageHeader
        eyebrow="Checkout"
        title="Cash on delivery"
        subtitle="Pay when your print arrives. Shipping is ₹99, free over ₹1,500."
      />

      <form onSubmit={onSubmit} className="mx-auto grid max-w-5xl gap-8 px-5 md:grid-cols-[1.2fr_0.8fr] md:px-8">
        <section className="space-y-4 rounded-3xl border border-ink/10 bg-cream-100/80 p-6">
          <h2 className="font-display text-lg font-bold text-ink">Delivery details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full name" value={form.name} onChange={set("name")} autoComplete="name" required />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={set("email")}
              autoComplete="email"
              required
            />
            <Input
              label="Mobile"
              type="tel"
              value={form.phone}
              onChange={set("phone")}
              autoComplete="tel"
              placeholder="10-digit Indian number"
              required
            />
            <Input
              label="PIN code"
              value={form.pincode}
              onChange={set("pincode")}
              autoComplete="postal-code"
              required
            />
          </div>
          <Input label="Address line 1" value={form.line1} onChange={set("line1")} autoComplete="address-line1" required />
          <Input label="Address line 2 (optional)" value={form.line2} onChange={set("line2")} autoComplete="address-line2" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="City" value={form.city} onChange={set("city")} autoComplete="address-level2" required />
            <Select label="State" value={form.state} onChange={set("state")} required>
              <option value="">Select state</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <Textarea label="Notes (optional)" rows={3} value={form.notes} onChange={set("notes")} />
          <p className="rounded-xl bg-ink/5 px-4 py-3 text-sm text-ink/65">
            Payment: <strong>Cash on delivery</strong>. Pay the courier when your print arrives.
          </p>
        </section>

        <aside className="h-fit rounded-3xl border border-ink/10 bg-white/70 p-6 shadow-sm">
          <h2 className="font-display text-lg font-bold text-ink">Order summary</h2>
          <ul className="mt-4 divide-y divide-ink/10">
            {lines.map((l) => (
              <li key={l.key} className="flex gap-4 py-3">
                {l.image ? (
                  <img src={l.image} alt="" className="h-14 w-14 rounded-xl object-cover" />
                ) : (
                  <div className="h-14 w-14 rounded-xl bg-cream-200" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{l.name}</p>
                  <p className="text-sm text-ink/50">Qty {l.qty}</p>
                </div>
                <p className="font-medium text-ink">{formatINR(l.price * l.qty)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between text-ink/70">
              <span>Subtotal</span>
              <span>{formatINR(subtotal)}</span>
            </div>
            <div className="flex justify-between text-ink/70">
              <span>Shipping</span>
              <span>{shipping === 0 ? "Free" : formatINR(shipping)}</span>
            </div>
            <div className="flex justify-between border-t border-ink/10 pt-3 font-display text-lg font-bold text-ink">
              <span>Total (COD)</span>
              <span>{formatINR(total)}</span>
            </div>
          </div>

          {error && <p className="mt-4 rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay-deep">{error}</p>}

          <Button className="mt-6 w-full" disabled={submitting || !lines.length} type="submit">
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="h-4 w-4" /> Placing order…
              </span>
            ) : (
              "Place COD order"
            )}
          </Button>

          <p className="mt-3 text-center text-xs text-ink/45">
            <Link to="/cart" className="underline hover:text-ink">
              Edit cart
            </Link>
          </p>
        </aside>
      </form>
    </div>
  );
}
