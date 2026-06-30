import { useState } from "react";
import { api } from "../lib/api";
import { Button, Input, Textarea } from "../components/ui";
import { PageHeader } from "../components/Layout";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name || !form.email || !form.message) {
      setError("Please fill in all fields.");
      return;
    }
    setSubmitting(true);
    try {
      await api.inquiries.create({
        type: "contact",
        name: form.name,
        email: form.email,
        phone: form.phone,
        message: form.message,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-20">
      <PageHeader eyebrow="Say hello" title="Contact us" subtitle="Questions, collabs, wholesale — we'd love to hear from you." />

      <div className="mx-auto mt-6 grid max-w-5xl gap-10 px-5 md:grid-cols-[1fr_1.3fr] md:px-8">
        <div className="space-y-6">
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink/40">Email</h4>
            <a href="mailto:hello@toyingidea.com" className="mt-1 block text-lg font-medium text-ink hover:text-clay">
              hello@toyingidea.com
            </a>
          </div>
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink/40">Support</h4>
            <p className="mt-1 text-ink/70">Order help, custom builds, and gifting.</p>
          </div>
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink/40">Hours</h4>
            <p className="mt-1 text-ink/70">Mon–Sat, 10am – 7pm IST</p>
          </div>
        </div>

        <div className="rounded-3xl border border-ink/10 bg-white/60 p-6 md:p-8">
          {done ? (
            <div className="py-10 text-center">
              <h3 className="font-display text-2xl font-bold text-ink">Message sent!</h3>
              <p className="mt-2 text-ink/60">We'll get back to you soon.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
                <Input label="Email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
              </div>
              <Input label="Phone (optional)" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              <Textarea label="Message" rows={5} value={form.message} onChange={(e) => set("message", e.target.value)} required />
              {error && <p className="rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay-deep">{error}</p>}
              <Button size="lg" className="w-full" disabled={submitting}>
                {submitting ? "Sending…" : "Send message"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
