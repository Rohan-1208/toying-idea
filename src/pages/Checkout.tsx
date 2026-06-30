import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { api } from "../lib/api";
import { formatINR } from "../lib/format";
import { Button, Input, Select } from "../components/ui";
import { PageHeader } from "../components/Layout";

export default function Checkout() {
  const { lines, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
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
  });

  const shipping = subtotal >= 1500 || subtotal === 0 ? 0 : 99;
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (lines.length === 0 && !submitting) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-32 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">Nothing to check out</h1>
        <Button to="/shop" className="mt-6">Browse the collection</Button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name || !form.email) {
      setError("Please fill in your name and email.");
      return;
    }
    setSubmitting(true);
    try {
      const { order } = await api.orders.create({
        customer: { name: form.name, email: form.email, phone: form.phone },
        shippingAddress: {
          line1: form.line1,
          line2: form.line2,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          country: "India",
        },
        items: lines.map((l) => ({
          productId: l.productId,
          slug: l.slug,
          qty: l.qty,
          options: l.options,
        })),
        paymentMethod: form.paymentMethod,
        notes: form.notes,
      });
      clear();
      navigate("/order-confirmed", { state: { order } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place order. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-16">
      <PageHeader eyebrow="Checkout" title="Almost yours" />
      <form onSubmit={submit} className="mx-auto mt-6 grid max-w-7xl gap-10 px-5 md:grid-cols-[1.6fr_1fr] md:px-8">
        <div className="space-y-8">
          <section>
            <h3 className="mb-4 font-display text-lg font-bold text-ink">Contact</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Full name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
              <Input label="Email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
              <Input label="Phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} className="sm:col-span-2" />
            </div>
          </section>

          <section>
            <h3 className="mb-4 font-display text-lg font-bold text-ink">Shipping address</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Address line 1" value={form.line1} onChange={(e) => set("line1", e.target.value)} className="sm:col-span-2" />
              <Input label="Address line 2" value={form.line2} onChange={(e) => set("line2", e.target.value)} className="sm:col-span-2" />
              <Input label="City" value={form.city} onChange={(e) => set("city", e.target.value)} />
              <Input label="State" value={form.state} onChange={(e) => set("state", e.target.value)} />
              <Input label="PIN code" value={form.pincode} onChange={(e) => set("pincode", e.target.value)} />
            </div>
          </section>

          <section>
            <h3 className="mb-4 font-display text-lg font-bold text-ink">Payment</h3>
            <Select label="Payment method" value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)}>
              <option value="cod">Cash on delivery</option>
              <option value="upi">UPI (we'll send a request)</option>
              <option value="bank">Bank transfer</option>
            </Select>
            <p className="mt-2 text-xs text-ink/50">
              Online payments are processed manually for now. We'll confirm payment details by email.
            </p>
          </section>
        </div>

        <aside className="h-fit rounded-3xl border border-ink/10 bg-cream-100 p-6 md:sticky md:top-24">
          <h3 className="font-display text-xl font-bold text-ink">Order summary</h3>
          <div className="mt-4 space-y-3">
            {lines.map((l) => (
              <div key={l.slug} className="flex justify-between text-sm">
                <span className="text-ink/70">
                  {l.name} <span className="text-ink/40">× {l.qty}</span>
                </span>
                <span className="font-medium text-ink">{formatINR(l.price * l.qty)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2 border-t border-ink/10 pt-4 text-sm">
            <div className="flex justify-between text-ink/70">
              <span>Subtotal</span>
              <span>{formatINR(subtotal)}</span>
            </div>
            <div className="flex justify-between text-ink/70">
              <span>Shipping</span>
              <span>{shipping === 0 ? "Free" : formatINR(shipping)}</span>
            </div>
            <div className="flex justify-between border-t border-ink/10 pt-2">
              <span className="font-semibold text-ink">Total</span>
              <span className="font-display text-xl font-bold text-ink">{formatINR(subtotal + shipping)}</span>
            </div>
          </div>

          {error && <p className="mt-4 rounded-xl bg-clay/10 px-3 py-2 text-sm text-clay-deep">{error}</p>}

          <Button size="lg" className="mt-5 w-full" disabled={submitting}>
            {submitting ? "Placing order…" : "Place order"}
          </Button>
          <p className="mt-3 text-center text-xs text-ink/45">
            You'll receive an order number to track your build.
          </p>
        </aside>
      </form>
    </div>
  );
}
