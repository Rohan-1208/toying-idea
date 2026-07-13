import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Review } from "../lib/types";
import { StarRating, StarRatingInput } from "./StarRating";
import { Button, Input, Textarea } from "./ui";

export function ProductReviews({ slug, productName }: { slug: string; productName: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState({ average: 5, count: 0 });
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ authorName: "", rating: 5, title: "", body: "" });

  const load = () => {
    setLoading(true);
    api.reviews
      .list(slug)
      .then((res) => {
        setReviews(res.items);
        setSummary(res.summary);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [slug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.reviews.create({ slug, ...form });
      setSuccess(true);
      setOpen(false);
      setForm({ authorName: "", rating: 5, title: "", body: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto mt-16 max-w-7xl border-t border-ink/10 px-5 pt-12 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-ink">Customer reviews</h2>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <StarRating value={summary.average} />
            <span className="text-sm text-ink/60">
              {summary.average.toFixed(1)} · {summary.count} review{summary.count === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Cancel" : "Write a review"}
        </Button>
      </div>

      {success && (
        <p className="mt-4 rounded-xl bg-teal/10 px-4 py-3 text-sm text-teal-deep">
          Thanks! Your review is live.
        </p>
      )}

      {open && (
        <form onSubmit={submit} className="mt-6 max-w-xl space-y-4 rounded-2xl border border-ink/10 bg-cream-100 p-5">
          <p className="text-sm text-ink/60">Share your experience with {productName}.</p>
          <Input
            label="Your name"
            value={form.authorName}
            onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))}
            required
            autoComplete="name"
          />
          <div>
            <span className="mb-2 block text-sm font-medium text-ink/70">Rating</span>
            <StarRatingInput value={form.rating} onChange={(rating) => setForm((f) => ({ ...f, rating }))} />
          </div>
          <Input
            label="Title (optional)"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Great desk companion"
          />
          <Textarea
            label="Your review"
            rows={4}
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            required
            placeholder="What did you love about the print quality, colors, or packaging?"
          />
          {error && <p className="text-sm text-clay-deep">{error}</p>}
          <Button disabled={submitting}>{submitting ? "Submitting…" : "Submit review"}</Button>
        </form>
      )}

      <div className="mt-8 space-y-5">
        {loading ? (
          <p className="text-sm text-ink/45">Loading reviews…</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-ink/50">No reviews yet — be the first to share your thoughts.</p>
        ) : (
          reviews.map((r) => (
            <article key={r._id} className="border-b border-ink/10 pb-5 last:border-0">
              <div className="flex flex-wrap items-center gap-2">
                <StarRating value={r.rating} size="sm" />
                <span className="font-medium text-ink">{r.authorName}</span>
                {r.createdAt && (
                  <span className="text-xs text-ink/40">
                    {new Date(r.createdAt).toLocaleDateString("en-IN", {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                )}
              </div>
              {r.title && <p className="mt-1 font-medium text-ink">{r.title}</p>}
              <p className="mt-1 text-sm leading-relaxed text-ink/70">{r.body}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
