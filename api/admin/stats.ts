import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed } from "../_lib/http.js";
import { connectDB } from "../_lib/db.js";
import { verifyAdmin } from "../_lib/auth.js";
import { Order } from "../_lib/models/Order.js";
import { Product } from "../_lib/models/Product.js";
import { Inquiry } from "../_lib/models/Inquiry.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  verifyAdmin(req);
  await connectDB();

  const [totalOrders, totalProducts, openInquiries, lowStock, statusAgg, revenueAgg, recentOrders] =
    await Promise.all([
      Order.countDocuments({}),
      Product.countDocuments({ active: true }),
      Inquiry.countDocuments({ status: { $in: ["new", "in-review", "quoted", "approved", "printing"] } }),
      Product.countDocuments({
        active: true,
        $expr: { $lte: ["$stock", "$lowStockThreshold"] },
      }),
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
    lowStock,
    revenue: revenueAgg[0]?.total || 0,
    byStatus,
    recentOrders,
  });
});
