import type { VercelRequest, VercelResponse } from "@vercel/node";
import mongoose from "mongoose";
import { withApi, methodNotAllowed, readBody } from "../_lib/http.js";
import { connectDB } from "../_lib/db.js";
import { Product } from "../_lib/models/Product.js";
import { verifyAdmin, isAdminRequest } from "../_lib/auth.js";

function findQuery(id: string) {
  // Accept either a Mongo ObjectId or a slug.
  return mongoose.isValidObjectId(id) ? { _id: id } : { slug: id.toLowerCase() };
}

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  await connectDB();
  const id = (req.query.id as string) || "";
  if (!id) throw new Error("Product id or slug is required");

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
});
