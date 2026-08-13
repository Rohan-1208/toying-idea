import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed } from "../_lib/http.js";
import { connectDB } from "../_lib/db.js";
import { verifyAdmin } from "../_lib/auth.js";
import { Order } from "../_lib/models/Order.js";
import { Inquiry } from "../_lib/models/Inquiry.js";
import { isShopifyAdminConfigured, shopifyAdminGraphql } from "../_lib/shopify-admin.js";

async function shopifyProductCount(): Promise<number> {
  if (!isShopifyAdminConfigured()) return 0;
  try {
    const data = await shopifyAdminGraphql<{ productsCount: { count: number } }>(
      `query ProductCount { productsCount(query: "status:active") { count } }`
    );
    return data.productsCount?.count ?? 0;
  } catch {
    try {
      const data = await shopifyAdminGraphql<{
        products: { edges: Array<{ node: { id: string } }> };
      }>(`query { products(first: 250, query: "status:active") { edges { node { id } } } }`);
      return data.products?.edges?.length ?? 0;
    } catch {
      return 0;
    }
  }
}

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  verifyAdmin(req);
  await connectDB();

  const [totalOrders, totalProducts, openInquiries, statusAgg, revenueAgg, recentOrders] =
    await Promise.all([
      Order.countDocuments({}),
      shopifyProductCount(),
      Inquiry.countDocuments({ status: { $in: ["new", "in-review", "quoted", "approved", "printing"] } }),
      Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Order.find({}).sort("-createdAt").limit(8).lean(),
    ]);

  const byStatus: Record<string, number> = {};
  for (const s of statusAgg) byStatus[s._id] = s.count;

  res.status(200).json({
    totalOrders,
    totalProducts,
    openInquiries,
    // Inventory lives in Shopify — Mongo low-stock is unused.
    lowStock: 0,
    revenue: revenueAgg[0]?.total || 0,
    byStatus,
    recentOrders,
  });
});
