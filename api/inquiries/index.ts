import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed, readBody } from "../_lib/http.js";
import { getSupabase } from "../_lib/supabase.js";
import { mapInquiry, throwIf } from "../_lib/map.js";
import { verifyAdmin } from "../_lib/auth.js";
import { buildInquiryPayload } from "../_lib/inquiries.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  const sb = getSupabase();

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
