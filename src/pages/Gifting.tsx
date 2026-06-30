import { useState } from "react";
import { api } from "../lib/api";
import { Button, Input, Textarea, Select, Eyebrow } from "../components/ui";

const PERKS = [
  { title: "Occasion-ready", body: "Premium notes, gift wrap and presentation tuned for the moment." },
  { title: "Brand options", body: "Add your logo, colors and custom packaging for corporate gifting." },
  { title: "Scale ranges", body: "From a single thoughtful piece to B2B bulk orders." },
];

export default function Gifting() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    occasion: "",
    quantity: "",
    budget: "",
    message: "",
  });
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name || !form.email) {
      setError("Please add your name and email.");
      return;
    }
    setSubmitting(true);
    try {
      await api.inquiries.create({
        type: "gifting",
        name: form.name,
        email: form.email,
        phone: form.phone,
        message: form.message,
        details: { occasion: form.occasion, quantity: form.quantity, budget: form.budget },
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-20">
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-deep to-teal">
        <div className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
          <Eyebrow className="text-cream-50/90">Customized Gifting</Eyebrow>
          <h1 className="mt-4 max-w-3xl font-display text-5xl font-bold leading-[0.95] tracking-tightish text-cream-50 md:text-7xl">
            Gifts they'll keep.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-cream-50/85">
            Occasion-ready gifting with premium notes, brand options and scale ranges for
            B2B. Make it personal, make it collectible.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 md:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {PERKS.map((p) => (
            <div key={p.title} className="rounded-3xl border border-ink/10 bg-cream-100 p-6">
              <h3 className="font-display text-xl font-bold text-ink">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/60">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 md:px-8">
        <div className="rounded-3xl border border-ink/10 bg-white/60 p-6 md:p-10">
          {done ? (
            <div className="py-10 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-teal/15 text-teal-deep">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h3 className="mt-5 font-display text-2xl font-bold text-ink">Inquiry sent!</h3>
              <p className="mt-2 text-ink/60">Our gifting team will reach out shortly with options.</p>
              <Button to="/shop" className="mt-6">Shop giftables</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <h2 className="font-display text-2xl font-bold text-ink">Start a gifting inquiry</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
                <Input label="Email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Phone (optional)" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                <Select label="Occasion" value={form.occasion} onChange={(e) => set("occasion", e.target.value)}>
                  <option value="">Select…</option>
                  {["Birthday", "Wedding", "Corporate", "Festival", "Anniversary", "Other"].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Approx. quantity" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
                <Input label="Budget per piece (₹)" value={form.budget} onChange={(e) => set("budget", e.target.value)} />
              </div>
              <Textarea label="Tell us about the gift" rows={4} value={form.message} onChange={(e) => set("message", e.target.value)} />

              {error && <p className="rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay-deep">{error}</p>}

              <Button size="lg" className="w-full" disabled={submitting}>
                {submitting ? "Submitting…" : "Start inquiry"}
              </Button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
