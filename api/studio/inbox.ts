import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed, readBody } from "../_lib/http.js";
import { verifyAdmin } from "../_lib/auth.js";
import { getSupabase } from "../_lib/supabase.js";
import { mapInquiry, throwIf } from "../_lib/map.js";
import { INBOX_SYSTEM } from "../_lib/brand.js";
import { openaiJson } from "../_lib/openai.js";
import { sendEmail } from "../_lib/mail.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  verifyAdmin(req);
  const body = readBody<{ inquiryId?: string; action?: "draft" | "send"; draftId?: string }>(req);
  const sb = getSupabase();

  if (body.action === "send" && body.draftId) {
    const { data: draft, error } = await sb.from("drafts").select("*").eq("id", body.draftId).maybeSingle();
    throwIf(error);
    if (!draft) throw new Error("Draft not found");
    const payload = draft.payload as { to?: string; subject?: string; body?: string; inquiryId?: string; quoteINR?: number };
    if (!payload.to || !payload.body) throw new Error("Draft is missing a recipient or body");
    await sendEmail(payload.to, payload.subject || "Toying Idea", payload.body.replace(/\n/g, "<br/>"), "inbox", "inquiry-reply");
    if (payload.inquiryId) {
      await sb.from("inquiries").update({
        status: payload.quoteINR ? "quoted" : "in-review",
        quote: payload.quoteINR ? { amount: payload.quoteINR, currency: "INR" } : undefined,
        updated_at: new Date().toISOString(),
      }).eq("id", payload.inquiryId);
    }
    const { data: updated, error: upErr } = await sb
      .from("drafts")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", body.draftId)
      .select("*")
      .single();
    throwIf(upErr);
    res.status(200).json({ draft: { ...updated, _id: updated.id } });
    return;
  }

  if (!body.inquiryId) throw new Error("inquiryId is required");
  const { data, error } = await sb.from("inquiries").select("*").eq("id", body.inquiryId).maybeSingle();
  throwIf(error);
  if (!data) throw new Error("Inquiry not found");
  const inquiry = mapInquiry(data);

  let reply = {
    subject: `Re: your ${inquiry.type} request — Toying Idea`,
    body: `Hi ${inquiry.name},\n\nThanks for writing in. We print custom PLA pieces in small batches from Patiala. Tell us colour, quantity, and deadline and we'll quote in INR.\n\n— Toying Idea`,
    suggestedStatus: "in-review" as string,
    quoteINR: null as number | null,
  };
  try {
    reply = await openaiJson<typeof reply>(
      INBOX_SYSTEM,
      JSON.stringify({
        type: inquiry.type,
        name: inquiry.name,
        message: inquiry.message,
        pyot: inquiry.pyot,
        gifting: inquiry.gifting,
      })
    );
  } catch (err) {
    if (process.env.OPENAI_API_KEY) throw err;
  }

  const { data: draft, error: dErr } = await sb
    .from("drafts")
    .insert({
      agent: "inbox",
      status: "pending",
      title: `Reply to ${inquiry.name}`,
      payload: {
        inquiryId: inquiry._id,
        to: inquiry.email,
        subject: reply.subject,
        body: reply.body,
        quoteINR: reply.quoteINR,
        suggestedStatus: reply.suggestedStatus,
      },
    })
    .select("*")
    .single();
  throwIf(dErr);
  res.status(201).json({ draft: { ...draft, _id: draft.id } });
});
