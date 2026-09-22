import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed } from "../_lib/http.js";
import { getSupabase } from "../_lib/supabase.js";
import { mapOrder, throwIf } from "../_lib/map.js";
import { verifyAdmin } from "../_lib/auth.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  verifyAdmin(req);
  const sb = getSupabase();

  const [ordersRes, productsRes, inquiriesRes, lowStockRes] = await Promise.all([
    sb.from("orders").select("*").order("created_at", { ascending: false }),
    sb.from("products").select("id, stock, low_stock_threshold, active"),
    sb.from("inquiries").select("id, status"),
    sb.from("products").select("id").eq("active", true),
  ]);
  throwIf(ordersRes.error);
  throwIf(productsRes.error);
  throwIf(inquiriesRes.error);

  const orders = (ordersRes.data || []).map(mapOrder);
  const products = productsRes.data || [];
  const inquiries = inquiriesRes.data || [];
  const byStatus: Record<string, number> = {};
  let revenue = 0;
  for (const o of orders) {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    if (o.status !== "cancelled") revenue += o.total;
  }
  const open = new Set(["new", "in-review", "quoted", "approved", "printing"]);
  const lowStock = products.filter(
    (p) => p.active !== false && Number(p.stock) <= Number(p.low_stock_threshold ?? 5)
  ).length;

  res.status(200).json({
    totalOrders: orders.length,
    totalProducts: (lowStockRes.data || []).length,
    openInquiries: inquiries.filter((i) => open.has(String(i.status))).length,
    lowStock,
    revenue,
    byStatus,
    pendingDrafts: (await sb.from("drafts").select("id", { count: "exact", head: true }).eq("status", "pending")).count || 0,
    recentOrders: orders.slice(0, 8),
  });
});
