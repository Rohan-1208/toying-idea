import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed, readBody } from "../_lib/http.js";
import { connectDB } from "../_lib/db.js";
import { Inquiry } from "../_lib/models/Inquiry.js";
import { verifyAdmin } from "../_lib/auth.js";
import { buildInquiryPayload } from "../_lib/inquiries.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  await connectDB();

  if (req.method === "GET") {
    verifyAdmin(req);
    const { type, status, limit = "300" } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    const lim = Math.min(parseInt(limit, 10) || 300, 500);
    const items = await Inquiry.find(filter).sort("-createdAt").limit(lim).lean();
    res.status(200).json({ items });
    return;
  }

  if (req.method === "POST") {
    const body = readBody<Record<string, unknown>>(req);
    const inquiry = await Inquiry.create(buildInquiryPayload(body));
    res.status(201).json({ inquiry });
    return;
  }

  return methodNotAllowed(res, ["GET", "POST"]);
});
