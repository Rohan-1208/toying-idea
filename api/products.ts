import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed, readBody } from "./_lib/http.js";
import { getSupabase } from "./_lib/supabase.js";
import { mapProduct, productToRow, throwIf } from "./_lib/map.js";
import { verifyAdmin, isAdminRequest } from "./_lib/auth.js";
import { slugify } from "./_lib/slug.js";
import { requireString } from "./_lib/validate.js";

function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  const sb = getSupabase();
  const id = req.query.id as string;

  if (id) {
    const finder = isUuid(id) ? sb.from("products").select("*").eq("id", id) : sb.from("products").select("*").eq("slug", id.toLowerCase());

    if (req.method === "GET") {
      let q = finder;
      if (!isAdminRequest(req)) q = q.eq("active", true);
      const { data, error } = await q.maybeSingle();
      throwIf(error);
      if (!data) throw new Error("Product not found");
      res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
      res.status(200).json({ product: mapProduct(data) });
      return;
    }

    if (req.method === "PUT" || req.method === "PATCH") {
      verifyAdmin(req);
      const body = readBody<Record<string, unknown>>(req);
      delete body._id;
      delete body.id;
      const row = productToRow(body);
      const { data, error } = await (isUuid(id)
        ? sb.from("products").update(row).eq("id", id)
        : sb.from("products").update(row).eq("slug", id.toLowerCase())
      )
        .select("*")
        .maybeSingle();
      throwIf(error);
      if (!data) throw new Error("Product not found");
      res.status(200).json({ product: mapProduct(data) });
      return;
    }

    if (req.method === "DELETE") {
      verifyAdmin(req);
      const { data, error } = await (isUuid(id)
        ? sb.from("products").delete().eq("id", id)
        : sb.from("products").delete().eq("slug", id.toLowerCase())
      )
        .select("id")
        .maybeSingle();
      throwIf(error);
      if (!data) throw new Error("Product not found");
      res.status(200).json({ ok: true });
      return;
    }

    return methodNotAllowed(res, ["GET", "PUT", "PATCH", "DELETE"]);
  }

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
      all,
    } = req.query as Record<string, string>;

    const admin = isAdminRequest(req) && all === "1";
    let query = sb.from("products").select("*", { count: "exact" });
    if (!admin) query = query.eq("active", true);
    if (category) query = query.or(`category.eq.${category},categories.cs.{${category}}`);
    if (collection) query = query.eq("collection_name", collection);
    if (tag) query = query.contains("tags", [tag]);
    if (badge) query = query.contains("badges", [badge]);
    if (featured === "1" || featured === "true") query = query.eq("featured", true);
    if (q?.trim()) query = query.or(`name.ilike.%${q.trim()}%,tagline.ilike.%${q.trim()}%,description.ilike.%${q.trim()}%`);

    const lim = Math.min(parseInt(limit, 10) || 48, 100);
    const page = Math.max(parseInt((req.query.page as string) || "1", 10) || 1, 1);
    const from = (page - 1) * lim;
    const to = from + lim - 1;

    const sortMap: Record<string, { col: string; asc: boolean }> = {
      "-createdAt": { col: "created_at", asc: false },
      createdAt: { col: "created_at", asc: true },
      price: { col: "price", asc: true },
      "-price": { col: "price", asc: false },
      name: { col: "name", asc: true },
    };
    const s = sortMap[sort] || sortMap["-createdAt"];
    query = query.order(s.col, { ascending: s.asc }).range(from, to);

    const { data, error, count } = await query;
    throwIf(error);
    const items = (data || []).map(mapProduct);
    if (!admin) {
      res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
    }
    res.status(200).json({ items, total: count ?? items.length, page, limit: lim });
    return;
  }

  if (req.method === "POST") {
    verifyAdmin(req);
    const body = readBody<Record<string, unknown>>(req);
    const name = requireString(body.name, "Product name");
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) throw new Error("Product price is required");
    const slug = body.slug ? slugify(String(body.slug)) : slugify(name);
    const row = productToRow({
      ...body,
      name,
      price,
      slug,
      sku: body.sku ? String(body.sku).toUpperCase() : slug.toUpperCase().replace(/-/g, "_"),
      inStock: body.inStock ?? true,
      active: body.active ?? true,
      stock: body.stock ?? 10,
    });
    const { data, error } = await sb.from("products").insert(row).select("*").single();
    if (error?.message?.includes("duplicate")) {
      row.slug = `${slug}-${Date.now().toString().slice(-4)}`;
      const retry = await sb.from("products").insert(row).select("*").single();
      throwIf(retry.error);
      res.status(201).json({ product: mapProduct(retry.data!) });
      return;
    }
    throwIf(error);
    res.status(201).json({ product: mapProduct(data!) });
    return;
  }

  return methodNotAllowed(res, ["GET", "POST"]);
});
