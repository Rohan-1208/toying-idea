import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed, readBody } from "./_lib/http.js";
import { getSupabase } from "./_lib/supabase.js";
import { mapReview, throwIf } from "./_lib/map.js";
import { verifyAdmin } from "./_lib/auth.js";
import { requireString } from "./_lib/validate.js";

async function reviewSummary(slug: string) {
  const sb = getSupabase();
  const { data, error } = await sb.from("reviews").select("rating").eq("slug", slug.toLowerCase()).eq("status", "approved");
  throwIf(error);
  const ratings = (data || []).map((r) => Number(r.rating));
  const count = ratings.length;
  const average = count ? Math.round((ratings.reduce((s, n) => s + n, 0) / count) * 10) / 10 : 5;
  return { average, count };
}

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  const sb = getSupabase();
  const slug = ((req.query.slug as string) || "").trim().toLowerCase();

  if (req.method === "GET") {
    if (!slug) throw new Error("Product slug is required");
    const { data, error } = await sb
      .from("reviews")
      .select("*")
      .eq("slug", slug)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(30);
    throwIf(error);
    res.status(200).json({ items: (data || []).map(mapReview), summary: await reviewSummary(slug) });
    return;
  }

  if (req.method === "POST") {
    const body = readBody<{ slug?: string; authorName?: string; rating?: number; title?: string; body?: string }>(req);
    const productSlug = requireString(body.slug || slug, "Product slug").toLowerCase();
    const authorName = requireString(body.authorName, "Your name");
    const reviewBody = requireString(body.body, "Review text");
    const rating = Math.min(5, Math.max(1, Math.round(Number(body.rating) || 0)));
    if (!rating) throw new Error("Rating must be between 1 and 5");
    const { data, error } = await sb
      .from("reviews")
      .insert({
        slug: productSlug,
        author_name: authorName,
        rating,
        title: body.title?.trim().slice(0, 120) || "",
        body: reviewBody,
        status: "approved",
      })
      .select("*")
      .single();
    throwIf(error);
    res.status(201).json({ review: mapReview(data), summary: await reviewSummary(productSlug) });
    return;
  }

  if (req.method === "PATCH") {
    verifyAdmin(req);
    const id = req.query.id as string;
    if (!id) throw new Error("Review id is required");
    const body = readBody<{ status?: string }>(req);
    if (!body.status || !["approved", "rejected", "pending"].includes(body.status)) {
      throw new Error("Invalid status");
    }
    const { data, error } = await sb.from("reviews").update({ status: body.status }).eq("id", id).select("*").maybeSingle();
    throwIf(error);
    if (!data) throw new Error("Review not found");
    res.status(200).json({ review: mapReview(data), summary: await reviewSummary(data.slug) });
    return;
  }

  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
});
