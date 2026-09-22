import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed, readBody } from "../_lib/http.js";
import { verifyAdmin } from "../_lib/auth.js";
import { getSupabase } from "../_lib/supabase.js";
import { throwIf } from "../_lib/map.js";
import { BRAND } from "../_lib/brand.js";
import { openaiJson } from "../_lib/openai.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  verifyAdmin(req);
  const sb = getSupabase();

  if (req.method === "GET") {
    const { data, error } = await sb.from("website_tickets").select("*").order("created_at", { ascending: false });
    throwIf(error);
    res.status(200).json({ items: data || [] });
    return;
  }

  if (req.method === "POST") {
    const body = readBody<{ request?: string }>(req);
    if (!body.request?.trim()) throw new Error("Describe the feature or change");
    let ticket = {
      title: body.request.slice(0, 80),
      brief: body.request,
      files: "src/pages, src/components, api/",
      acceptance: "Works on storefront and admin, COD checkout unchanged.",
      priority: "normal",
    };
    try {
      ticket = await openaiJson<typeof ticket>(
        `${BRAND.voice}\nTurn a shop-owner request into an implementation ticket. Return JSON: title, brief, files, acceptance, priority (low|normal|high). Do not write code.`,
        body.request
      );
    } catch (err) {
      if (process.env.OPENAI_API_KEY) throw err;
    }

    const { data, error } = await sb
      .from("drafts")
      .insert({
        agent: "website",
        status: "pending",
        title: ticket.title,
        payload: ticket,
      })
      .select("*")
      .single();
    throwIf(error);
    res.status(201).json({ draft: { ...data, _id: data.id } });
    return;
  }

  return methodNotAllowed(res, ["GET", "POST"]);
});
