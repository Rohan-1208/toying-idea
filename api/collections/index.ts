import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed } from "../_lib/http.js";
import { connectDB } from "../_lib/db.js";
import { Product } from "../_lib/models/Product.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  await connectDB();

  const [collections, categories] = await Promise.all([
    Product.distinct("collectionName", { active: true, collectionName: { $nin: ["", null] } }),
    Product.distinct("category", { active: true, category: { $nin: ["", null] } }),
  ]);

  res.status(200).json({
    collections: (collections as string[]).filter(Boolean).sort(),
    categories: (categories as string[]).filter(Boolean).sort(),
  });
});
