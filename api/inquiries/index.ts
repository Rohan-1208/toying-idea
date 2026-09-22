import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed, readBody } from "../_lib/http.js";
import { getSupabase } from "../_lib/supabase.js";
import { mapInquiry, throwIf } from "../_lib/map.js";
import { verifyAdmin } from "../_lib/auth.js";
import { buildInquiryPayload, parseInquiryStatus } from "../_lib/inquiries.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  const sb = getSupabase();
  const id = (req.query.id as string) || "";

  if (id) {
    verifyAdmin(req);
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
  }

  if (req.method === "GET") {
    verifyAdmin(req);
    const { type, status, limit = "300" } = req.query as Record<string, string>;
    let query = sb.from("inquiries").select("*").order("created_at", { ascending: false });
    if (type) query = query.eq("type", type);
    if (status) query = query.eq("status", status);
    const lim = Math.min(parseInt(limit, 10) || 300, 500);
    const { data, error } = await query.limit(lim);
    throwIf(error);
    res.status(200).json({ items: (data || []).map(mapInquiry) });
    return;
  }

  if (req.method === "POST") {
    const body = readBody<Record<string, unknown>>(req);
    const payload = buildInquiryPayload(body);
    const { data, error } = await sb
      .from("inquiries")
      .insert({
        type: payload.type,
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        message: payload.message,
        pyot: payload.pyot || null,
        gifting: payload.gifting || null,
        contact: payload.contact || null,
        details: payload.details || {},
        status: "new",
      })
      .select("*")
      .single();
    throwIf(error);
    res.status(201).json({ inquiry: mapInquiry(data) });
    return;
  }

  return methodNotAllowed(res, ["GET", "POST"]);
});
