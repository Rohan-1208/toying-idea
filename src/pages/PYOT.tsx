import { useState } from "react";
import { api } from "../lib/api";
import { Button, Input, Textarea, Select, Eyebrow } from "../components/ui";

const STEPS = [
  { n: "01", title: "Upload", body: "Share your STL / OBJ / STEP files or a link to your model and reference images." },
  { n: "02", title: "Choose", body: "Pick material, finish, color and scale. We'll advise on printability." },
  { n: "03", title: "Quote", body: "Get a transparent quote and timeline. Approve and we start printing." },
  { n: "04", title: "Receive", body: "Your custom toy is printed, finished, and shipped to your door." },
];

export default function PYOT() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    fileLinks: "",
    fileNames: "",
    material: "PLA",
    finish: "Matte",
    color: "",
    quantity: "1",
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
        type: "pyot",
        name: form.name,
        email: form.email,
        phone: form.phone,
        message: form.message,
        details: {
          fileLinks: form.fileLinks,
          fileNames: form.fileNames,
          material: form.material,
          finish: form.finish,
          color: form.color,
          quantity: form.quantity,
        },
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
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-clay to-clay-deep">
        <div className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
          <Eyebrow className="text-cream-50/90">The Workshop</Eyebrow>
          <h1 className="mt-4 max-w-3xl font-display text-5xl font-bold leading-[0.95] tracking-tightish text-cream-50 md:text-7xl">
            Print Your Own Toy.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-cream-50/85">
            Upload your model, pick a material and finish, and we'll build it layer by
            precise layer — from one-offs to small-batch drops.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-7xl px-5 py-16 md:px-8">
        <div className="grid gap-6 md:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-3xl border border-ink/10 bg-cream-100 p-6">
              <span className="font-display text-3xl font-bold text-clay/40">{s.n}</span>
              <h3 className="mt-3 font-display text-xl font-bold text-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/60">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Form */}
      <section className="mx-auto max-w-3xl px-5 md:px-8">
        <div className="rounded-3xl border border-ink/10 bg-white/60 p-6 md:p-10">
          {done ? (
            <div className="py-10 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-teal/15 text-teal-deep">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h3 className="mt-5 font-display text-2xl font-bold text-ink">Request received!</h3>
              <p className="mt-2 text-ink/60">We'll review your model and reply with a quote within 1–2 business days.</p>
              <Button to="/shop" className="mt-6">Browse the collection</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <h2 className="font-display text-2xl font-bold text-ink">Start your custom build</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
                <Input label="Email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
              </div>
              <Input label="Phone (optional)" value={form.phone} onChange={(e) => set("phone", e.target.value)} />

              <Input
                label="Model file link (Drive / WeTransfer / Dropbox)"
                placeholder="https://…"
                value={form.fileLinks}
                onChange={(e) => set("fileLinks", e.target.value)}
              />
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink/70">Or attach files (names captured — we'll request the files by email)</span>
                <input
                  type="file"
                  multiple
                  accept=".stl,.obj,.step,.stp,.3mf,.zip,image/*"
                  onChange={(e) =>
                    set("fileNames", Array.from(e.target.files || []).map((f) => f.name).join(", "))
                  }
                  className="block w-full text-sm text-ink/70 file:mr-4 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-semibold file:text-cream-50 hover:file:bg-ink/90"
                />
                {form.fileNames && <p className="mt-1 text-xs text-ink/50">{form.fileNames}</p>}
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <Select label="Material" value={form.material} onChange={(e) => set("material", e.target.value)}>
                  {["PLA", "PLA+", "PETG", "ABS", "Resin", "TPU (flexible)"].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </Select>
                <Select label="Finish" value={form.finish} onChange={(e) => set("finish", e.target.value)}>
                  {["Matte", "Silk", "Glossy", "Metallic", "Hand-painted"].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </Select>
                <Input label="Quantity" type="number" min={1} value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
              </div>
              <Input label="Preferred color(s)" value={form.color} onChange={(e) => set("color", e.target.value)} />
              <Textarea label="Anything else?" rows={4} value={form.message} onChange={(e) => set("message", e.target.value)} />

              {error && <p className="rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay-deep">{error}</p>}

              <Button size="lg" className="w-full" disabled={submitting}>
                {submitting ? "Submitting…" : "Request a quote"}
              </Button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
