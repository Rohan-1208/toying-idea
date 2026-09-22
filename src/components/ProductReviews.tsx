import { useEffect, useState, type FormEvent } from "react";
import { StarRating } from "./StarRating";
import { api } from "../lib/api";
import type { Review } from "../lib/types";
import { Button, Input, Textarea } from "./ui";

export function ProductReviews({
  slug,
  productName,
  rating,
  reviewCount,
}: {
  slug?: string;
  productName: string;
  rating?: number;
  reviewCount?: number;
}) {
  const [items, setItems] = useState<Review[]>([]);
  const [average, setAverage] = useState(rating ?? 0);
  const [count, setCount] = useState(reviewCount ?? 0);
  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [stars, setStars] = useState(5);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!slug) return;
    api.reviews
      .list(slug)
      .then((res) => {
        setItems(res.items);
        setAverage(res.summary.average);
        setCount(res.summary.count);
      })
      .catch(() => {
        setItems([]);
      });
  }, [slug]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    setError("");
    setSaving(true);
    try {
      const res = await api.reviews.create({ slug, authorName, rating: stars, body });
      setItems((prev) => [res.review, ...prev]);
      setAverage(res.summary.average);
      setCount(res.summary.count);
      setAuthorName("");
      setBody("");
      setStars(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save review");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto mt-16 max-w-7xl border-t border-ink/10 px-5 pt-12 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-ink">Customer reviews</h2>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {count > 0 ? (
              <>
                <StarRating value={average} />
                <span className="text-sm text-ink/60">
                  {average.toFixed(1)} · {count} review{count === 1 ? "" : "s"}
                </span>
              </>
            ) : (
              <span className="text-sm text-ink/55">No published reviews yet for {productName}.</span>
            )}
          </div>
        </div>
      </div>

      <ul className="mt-6 space-y-3">
        {items.map((r) => (
          <li key={r._id} className="rounded-2xl border border-ink/10 bg-cream-100/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-ink">{r.authorName}</p>
              <StarRating value={r.rating} />
            </div>
            {r.title ? <p className="mt-1 text-sm font-semibold text-ink">{r.title}</p> : null}
            <p className="mt-1 text-sm text-ink/70">{r.body}</p>
          </li>
        ))}
      </ul>

      {slug ? (
        <form onSubmit={onSubmit} className="mt-8 max-w-xl space-y-3 rounded-2xl border border-ink/10 bg-white/70 p-5">
          <p className="font-display text-lg font-bold text-ink">Leave a review</p>
          <Input label="Your name" value={authorName} onChange={(e) => setAuthorName(e.target.value)} required />
          <label className="block text-sm font-medium text-ink/70">
            Rating
            <select
              className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white/70 px-4 py-2.5"
              value={stars}
              onChange={(e) => setStars(Number(e.target.value))}
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} star{n === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </label>
          <Textarea label="Review" rows={4} value={body} onChange={(e) => setBody(e.target.value)} required />
          {error && <p className="text-sm text-clay-deep">{error}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Publish review"}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
