import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed, readBody } from "../_lib/http.js";
import { getSupabase } from "../_lib/supabase.js";
import { mapMovement, mapProduct, throwIf } from "../_lib/map.js";
import { verifyAdmin } from "../_lib/auth.js";
import { adjustStock } from "../_lib/inventory.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  verifyAdmin(req);
  const sb = getSupabase();

  if (req.method === "GET") {
    const { data: products, error } = await sb.from("products").select("*").eq("active", true);
    throwIf(error);
    const mapped = (products || []).map(mapProduct);
    const lowStock = mapped.filter((p) => (p.stock ?? 0) <= (p.lowStockThreshold ?? 5)).sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));
    const { data: movements, error: mErr } = await sb
      .from("inventory_movements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    throwIf(mErr);
    res.status(200).json({
      summary: {
        totalSkus: mapped.length,
        totalUnits: mapped.reduce((s, p) => s + (p.stock ?? 0), 0),
        outOfStock: mapped.filter((p) => !p.inStock || (p.stock ?? 0) <= 0).length,
      },
      lowStock: lowStock.slice(0, 50),
      recentMovements: (movements || []).map(mapMovement),
    });
    return;
  }

  if (req.method === "POST") {
    const body = readBody<{
      productId?: string;
      slug?: string;
      delta?: number;
      stock?: number;
      note?: string;
    }>(req);

    let productId = body.productId;
    if (!productId && body.slug) {
      const { data, error } = await sb.from("products").select("*").eq("slug", body.slug.toLowerCase()).maybeSingle();
      throwIf(error);
      if (!data) throw new Error("Product not found");
      productId = data.id;
      if (typeof body.stock === "number") {
        body.delta = body.stock - Number(data.stock);
      }
    } else if (productId && typeof body.stock === "number") {
      const { data, error } = await sb.from("products").select("stock").eq("id", productId).maybeSingle();
      throwIf(error);
      if (!data) throw new Error("Product not found");
      body.delta = body.stock - Number(data.stock);
    }

    if (!productId) throw new Error("Product not found");
    const delta = Number(body.delta);
    if (!Number.isFinite(delta) || delta === 0) throw new Error("Provide a non-zero delta or target stock level");

    const updated = await adjustStock({
      productId,
      delta,
      reason: "adjustment",
      note: body.note?.trim() || "Manual stock adjustment",
      actor: "admin",
    });
    res.status(200).json({ product: updated });
    return;
  }

  return methodNotAllowed(res, ["GET", "POST"]);
});
