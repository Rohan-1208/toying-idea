import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed, readBody } from "../_lib/http.js";
import { connectDB } from "../_lib/db.js";
import { Product } from "../_lib/models/Product.js";
import { verifyAdmin } from "../_lib/auth.js";
import { slugify } from "../_lib/slug.js";
import { positiveInt, requireString } from "../_lib/validate.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  await connectDB();

  if (req.method === "GET") {
    const {
      q,
      category,
      collection,
      tag,
      badge,
      featured,
      sort = "-createdAt",
      limit = "60",
      page = "1",
      all,
    } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};
    // Admin can request inactive too via ?all=1
    if (!all) filter.active = true;
    if (category) filter.category = category;
    if (collection) filter.collectionName = collection;
    if (tag) filter.tags = tag;
    if (badge) filter.badges = badge;
    if (featured === "1" || featured === "true") filter.featured = true;
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { tags: { $regex: q, $options: "i" } },
      ];
    }

    const lim = Math.min(parseInt(limit, 10) || 60, 200);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * lim;

    const [items, total] = await Promise.all([
      Product.find(filter).sort(sort).skip(skip).limit(lim).lean(),
      Product.countDocuments(filter),
    ]);

    res.status(200).json({ items, total, page: Number(page), limit: lim });
    return;
  }

  if (req.method === "POST") {
    verifyAdmin(req);
    const body = readBody<Record<string, unknown>>(req);
    const name = requireString(body.name, "Product name");
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) throw new Error("Product price is required");

    const slug = body.slug ? slugify(String(body.slug)) : slugify(name);
    const exists = await Product.findOne({ slug }).lean();
    const finalSlug = exists ? `${slug}-${Date.now().toString().slice(-4)}` : slug;

    const stock = body.stock != null ? positiveInt(body.stock, 0) : 100;

    const created = await Product.create({
      ...body,
      name,
      price,
      slug: finalSlug,
      sku: body.sku ? String(body.sku).toUpperCase() : finalSlug.toUpperCase().replace(/-/g, "_"),
      stock,
      lowStockThreshold: body.lowStockThreshold != null ? positiveInt(body.lowStockThreshold, 5) : 5,
      inStock: stock > 0,
    });
    res.status(201).json({ product: created });
    return;
  }

  return methodNotAllowed(res, ["GET", "POST"]);
});
