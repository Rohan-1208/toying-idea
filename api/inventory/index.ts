import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed, readBody } from "../_lib/http.js";
import { connectDB } from "../_lib/db.js";
import { Product } from "../_lib/models/Product.js";
import { InventoryMovement } from "../_lib/models/InventoryMovement.js";
import { verifyAdmin } from "../_lib/auth.js";
import { adjustStock } from "../_lib/inventory.js";
import { positiveInt } from "../_lib/validate.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  await connectDB();
  verifyAdmin(req);

  if (req.method === "GET") {
    const [lowStock, recentMovements, summary] = await Promise.all([
      Product.find({
        active: true,
        $expr: { $lte: ["$stock", "$lowStockThreshold"] },
      })
        .sort({ stock: 1 })
        .limit(50)
        .lean(),
      InventoryMovement.find({}).sort("-createdAt").limit(30).lean(),
      Product.aggregate([
        { $match: { active: true } },
        {
          $group: {
            _id: null,
            totalSkus: { $sum: 1 },
            totalUnits: { $sum: "$stock" },
            outOfStock: {
              $sum: { $cond: [{ $lte: ["$stock", 0] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    res.status(200).json({
      summary: summary[0] || { totalSkus: 0, totalUnits: 0, outOfStock: 0 },
      lowStock,
      recentMovements,
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

    const note = body.note?.trim() || "";
    let product = null;

    if (body.productId) {
      product = await Product.findById(body.productId);
    } else if (body.slug) {
      product = await Product.findOne({ slug: body.slug.toLowerCase() });
    }
    if (!product) throw new Error("Product not found");

    let delta = 0;
    if (typeof body.stock === "number") {
      delta = body.stock - (product.stock ?? 0);
    } else {
      delta = Number(body.delta);
    }
    if (!Number.isFinite(delta) || delta === 0) {
      throw new Error("Provide a non-zero delta or target stock level");
    }

    const updated = await adjustStock({
      productId: product._id,
      delta,
      reason: "adjustment",
      note: note || "Manual stock adjustment",
      actor: "admin",
    });

    res.status(200).json({ product: updated });
    return;
  }

  return methodNotAllowed(res, ["GET", "POST"]);
});
