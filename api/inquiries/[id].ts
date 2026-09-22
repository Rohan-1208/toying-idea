import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed, readBody } from "../_lib/http.js";
import { getSupabase } from "../_lib/supabase.js";
import { mapInquiry, throwIf } from "../_lib/map.js";
import { verifyAdmin } from "../_lib/auth.js";
import { parseInquiryStatus } from "../_lib/inquiries.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  verifyAdmin(req);
  const sb = getSupabase();
  const id = (req.query.id as string) || "";
  if (!id) throw new Error("Inquiry id is required");

  if (req.method === "PUT" || req.method === "PATCH") {
    const body = readBody<{
      status?: string;
      quote?: { amount?: number; currency?: string; note?: string; validUntil?: string };
    }>(req);

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status) update.status = parseInquiryStatus(body.status);
    if (body.quote) {
      update.quote = {
        amount: body.quote.amount,
        currency: body.quote.currency || "INR",
        note: body.quote.note || "",
        validUntil: body.quote.validUntil || null,
      };
      if (!body.status) update.status = "quoted";
    }

    const { data, error } = await sb.from("inquiries").update(update).eq("id", id).select("*").maybeSingle();
    throwIf(error);
    if (!data) throw new Error("Inquiry not found");
    res.status(200).json({ inquiry: mapInquiry(data) });
    return;
  }

  if (req.method === "DELETE") {
    const { data, error } = await sb.from("inquiries").delete().eq("id", id).select("id").maybeSingle();
    throwIf(error);
    if (!data) throw new Error("Inquiry not found");
    res.status(200).json({ ok: true });
    return;
  }

  return methodNotAllowed(res, ["PUT", "PATCH", "DELETE"]);
});
