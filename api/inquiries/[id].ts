import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed, readBody } from "../_lib/http.js";
import { connectDB } from "../_lib/db.js";
import { Inquiry } from "../_lib/models/Inquiry.js";
import { verifyAdmin } from "../_lib/auth.js";
import { parseInquiryStatus } from "../_lib/inquiries.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  await connectDB();
  verifyAdmin(req);
  const id = (req.query.id as string) || "";
  if (!id) throw new Error("Inquiry id is required");

  if (req.method === "PUT" || req.method === "PATCH") {
    const body = readBody<{
      status?: string;
      quote?: { amount?: number; currency?: string; note?: string; validUntil?: string };
    }>(req);

    const update: Record<string, unknown> = {};
    if (body.status) update.status = parseInquiryStatus(body.status);

    if (body.quote) {
      update.quote = {
        amount: body.quote.amount,
        currency: body.quote.currency || "INR",
        note: body.quote.note || "",
        validUntil: body.quote.validUntil ? new Date(body.quote.validUntil) : null,
      };
      if (!body.status) update.status = "quoted";
    }

    const inquiry = await Inquiry.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!inquiry) throw new Error("Inquiry not found");
    res.status(200).json({ inquiry });
    return;
  }

  if (req.method === "DELETE") {
    const inquiry = await Inquiry.findByIdAndDelete(id).lean();
    if (!inquiry) throw new Error("Inquiry not found");
    res.status(200).json({ ok: true });
    return;
  }

  return methodNotAllowed(res, ["PUT", "PATCH", "DELETE"]);
});
