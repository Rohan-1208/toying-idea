import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed, readBody } from "./_lib/http.js";
import { connectDB } from "./_lib/db.js";
import { Review } from "./_lib/models/Review.js";
import { verifyAdmin } from "./_lib/auth.js";
import { requireString } from "./_lib/validate.js";

async function reviewSummary(slug: string) {
  const [stats] = await Review.aggregate([
    { $match: { slug: slug.toLowerCase(), status: "approved" } },
    { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const average = stats?.count ? Math.round(stats.average * 10) / 10 : 5;
  const count = stats?.count || 0;
  return { average, count };
}

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  await connectDB();
  const slug = ((req.query.slug as string) || "").trim().toLowerCase();

  if (req.method === "GET") {
    if (!slug) throw new Error("Product slug is required");
    const items = await Review.find({ slug, status: "approved" })
      .sort("-createdAt")
      .limit(30)
      .lean();
    const summary = await reviewSummary(slug);
    res.status(200).json({ items, summary });
    return;
  }

  if (req.method === "POST") {
    const body = readBody<{
      slug?: string;
      authorName?: string;
      rating?: number;
      title?: string;
      body?: string;
    }>(req);

    const productSlug = requireString(body.slug || slug, "Product slug").toLowerCase();
    const authorName = requireString(body.authorName, "Your name");
    const reviewBody = requireString(body.body, "Review text");
    const rating = Math.min(5, Math.max(1, Math.round(Number(body.rating) || 0)));
    if (!rating) throw new Error("Rating must be between 1 and 5");

    // Products live in Shopify — reviews are keyed by Shopify handle/slug only.
    const review = await Review.create({
      slug: productSlug,
      authorName,
      rating,
      title: body.title?.trim().slice(0, 120) || "",
      body: reviewBody,
      status: "approved",
    });

    const summary = await reviewSummary(productSlug);
    res.status(201).json({ review, summary });
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
    const review = await Review.findByIdAndUpdate(id, { status: body.status }, { new: true }).lean();
    if (!review) throw new Error("Review not found");
    const summary = review.slug ? await reviewSummary(review.slug) : { average: 5, count: 0 };
    res.status(200).json({ review, summary });
    return;
  }

  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
});
