import type { VercelRequest, VercelResponse } from "@vercel/node";
import mongoose from "mongoose";
import { withApi, methodNotAllowed, readBody } from "./_lib/http.js";
import { connectDB } from "./_lib/db.js";
import { Product } from "./_lib/models/Product.js";
import { verifyAdmin, isAdminRequest } from "./_lib/auth.js";
import { slugify } from "./_lib/slug.js";
import { categoryFilter } from "./_lib/product-utils.js";
import { positiveInt, requireString } from "./_lib/validate.js";

function findQuery(id: string) {
  return mongoose.isValidObjectId(id) ? { _id: id } : { slug: id.toLowerCase() };
}

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  await connectDB();
  const id = req.query.id as string;

  // Case 1: Route with product ID/slug parameter (e.g. /api/products/:id)
  if (id) {
    if (req.method === "GET") {
      const filter = { ...findQuery(id) } as Record<string, unknown>;
      if (!isAdminRequest(req)) filter.active = true;

      const product = await Product.findOne(filter).lean();
      if (!product) throw new Error("Product not found");
      res.status(200).json({ product });
      return;
    }

    if (req.method === "PUT" || req.method === "PATCH") {
      verifyAdmin(req);
      const body = readBody<Record<string, unknown>>(req);
      delete body._id;
      const product = await Product.findOneAndUpdate(findQuery(id), body, {
        new: true,
        runValidators: true,
      }).lean();
      if (!product) throw new Error("Product not found");
      res.status(200).json({ product });
      return;
    }

    if (req.method === "DELETE") {
      verifyAdmin(req);
      const product = await Product.findOneAndDelete(findQuery(id)).lean();
      if (!product) throw new Error("Product not found");
      res.status(200).json({ ok: true });
      return;
    }

    return methodNotAllowed(res, ["GET", "PUT", "PATCH", "DELETE"]);
  }

  // Case 2: Base route (e.g. /api/products)
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
    if (!all) filter.active = true;
    if (category) Object.assign(filter, categoryFilter(category));
    if (collection) filter.collectionName = collection;
    if (tag) filter.tags = tag;
    if (badge) filter.badges = badge;
    if (featured === "1" || featured === "true") filter.featured = true;

    const lim = Math.min(parseInt(limit, 10) || 60, 200);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * lim;
    const sortField = sort || "-createdAt";

    let items;
    let total;

    if (q?.trim()) {
      const textFilter = { ...filter, $text: { $search: q.trim() } };
      [items, total] = await Promise.all([
        Product.find(textFilter, { score: { $meta: "textScore" } })
          .sort({ score: { $meta: "textScore" } })
          .skip(skip)
          .limit(lim)
          .lean(),
        Product.countDocuments(textFilter),
      ]);
    } else {
      [items, total] = await Promise.all([
        Product.find(filter).sort(sortField).skip(skip).limit(lim).lean(),
        Product.countDocuments(filter),
      ]);
    }

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
