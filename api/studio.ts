import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed, readBody } from "./_lib/http.js";
import { verifyAdmin } from "./_lib/auth.js";
import { getSupabase } from "./_lib/supabase.js";
import { mapInquiry, productToRow, throwIf } from "./_lib/map.js";
import { BRAND, CATALOG_SYSTEM, INBOX_SYSTEM, MARKETING_SYSTEM } from "./_lib/brand.js";
import { openaiImages, openaiJson, uploadImageBytes } from "./_lib/openai.js";
import { sendEmail } from "./_lib/mail.js";
import { slugify } from "./_lib/slug.js";

function resource(req: VercelRequest): string {
  const q = req.query.resource;
  if (typeof q === "string" && q) return q;
  const path = (req.url || "").split("?")[0];
  const match = path.match(/\/api\/studio\/([^/?]+)/);
  return match?.[1] || "";
}

async function approveCatalog(payload: Record<string, unknown>) {
  const sb = getSupabase();
  const name = String(payload.name || "Untitled");
  const images = [...((payload.photos as string[]) || []), ...((payload.generated as string[]) || [])];
  const row = productToRow({
    name,
    slug: slugify(name),
    tagline: payload.tagline,
    description: payload.description,
    price: Number(payload.price) || 0,
    currency: "INR",
    category: payload.category || "collectibles",
    categories: [String(payload.category || "collectibles")],
    collection_name: payload.category || "character-figures",
    badges: payload.badges || ["Collector"],
    images,
    thumbnail: images[0] || "",
    material: "PLA",
    stock: 8,
    inStock: true,
    active: true,
    variants: [
      {
        id: "v-default",
        label: "PLA / Matte / Standard",
        material: "PLA",
        finish: "Matte",
        size: "Small",
        inStock: true,
        price: { currency: "INR", amount: Number(payload.price) || 0 },
      },
    ],
  });
  const { data, error } = await sb.from("products").insert(row).select("id, slug").single();
  throwIf(error);
  return data;
}

async function handleUpload(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const body = readBody<{ filename?: string; contentType?: string; data?: string }>(req);
  if (!body.data) throw new Error("Image data is required");
  const buf = Buffer.from(body.data.replace(/^data:[^;]+;base64,/, ""), "base64");
  if (!buf.length) throw new Error("Invalid image data");
  const url = await uploadImageBytes(buf, body.filename || "upload.png", body.contentType || "image/png");
  res.status(201).json({ url });
}

async function handleCatalog(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const body = readBody<{ photos?: string[]; notes?: string; extraImages?: number }>(req);
  const photos = body.photos || [];
  if (!photos.length) throw new Error("Upload at least one product photo");

  let listing = {
    name: "Untitled collectible",
    tagline: "A PLA collectible from Toying Idea.",
    description: "Printed in biodegradable PLA. Built to collect — custom colours on request.",
    priceINR: 799,
    category: "character-figures",
    badges: ["Collector"],
  };
  try {
    listing = await openaiJson<typeof listing>(
      CATALOG_SYSTEM,
      `Notes from the studio: ${body.notes || "none"}. Photo count: ${photos.length}.`
    );
  } catch (err) {
    if (process.env.OPENAI_API_KEY) throw err;
  }

  let generated: string[] = [];
  try {
    generated = await openaiImages(
      `Product photography of a small collectible 3D-printed PLA toy: ${listing.name}. ${listing.tagline}. Clean cream backdrop, studio light, no text, no watermark.`,
      body.extraImages ?? 2
    );
  } catch (err) {
    if (process.env.OPENAI_API_KEY) console.error(err);
  }

  const payload = {
    photos,
    generated,
    name: listing.name,
    tagline: listing.tagline,
    description: listing.description,
    price: listing.priceINR,
    category: listing.category,
    badges: listing.badges,
    currency: "INR",
    material: "PLA",
  };

  const { data, error } = await getSupabase()
    .from("drafts")
    .insert({ agent: "catalog", status: "pending", title: listing.name, payload })
    .select("*")
    .single();
  throwIf(error);
  res.status(201).json({ draft: { ...data, _id: data.id } });
}

async function handleDrafts(req: VercelRequest, res: VercelResponse) {
  const sb = getSupabase();
  const id = req.query.id as string | undefined;

  if (req.method === "GET") {
    const status = (req.query.status as string) || "pending";
    let q = sb.from("drafts").select("*").order("created_at", { ascending: false });
    if (status !== "all") q = q.eq("status", status);
    const { data, error } = await q.limit(100);
    throwIf(error);
    res.status(200).json({ items: (data || []).map((d) => ({ ...d, _id: d.id })) });
    return;
  }

  if (req.method === "PATCH" && id) {
    const body = readBody<{ payload?: Record<string, unknown>; title?: string }>(req);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.payload) patch.payload = body.payload;
    if (body.title) patch.title = body.title;
    const { data, error } = await sb.from("drafts").update(patch).eq("id", id).select("*").maybeSingle();
    throwIf(error);
    if (!data) throw new Error("Draft not found");
    res.status(200).json({ draft: { ...data, _id: data.id } });
    return;
  }

  if (req.method === "POST" && id && req.query.action === "approve") {
    const { data: draft, error } = await sb.from("drafts").select("*").eq("id", id).maybeSingle();
    throwIf(error);
    if (!draft) throw new Error("Draft not found");
    if (draft.status !== "pending") throw new Error("Draft is not pending");

    let result: unknown = null;
    if (draft.agent === "catalog") {
      result = await approveCatalog(draft.payload as Record<string, unknown>);
    }
    if (draft.agent === "website") {
      const p = draft.payload as Record<string, unknown>;
      const ticket = await sb
        .from("website_tickets")
        .insert({
          title: String(p.title || draft.title),
          brief: String(p.brief || ""),
          files: String(p.files || ""),
          acceptance: String(p.acceptance || ""),
          priority: String(p.priority || "normal"),
          status: "open",
        })
        .select("*")
        .single();
      throwIf(ticket.error);
      result = ticket.data;
    }

    const { data: updated, error: upErr } = await sb
      .from("drafts")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    throwIf(upErr);
    res.status(200).json({ draft: { ...updated, _id: updated.id }, result });
    return;
  }

  if (req.method === "POST" && id && req.query.action === "reject") {
    const { data, error } = await sb
      .from("drafts")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    throwIf(error);
    if (!data) throw new Error("Draft not found");
    res.status(200).json({ draft: { ...data, _id: data.id } });
    return;
  }

  return methodNotAllowed(res, ["GET", "PATCH", "POST"]);
}

async function handlePrintJobs(req: VercelRequest, res: VercelResponse) {
  const sb = getSupabase();
  const id = req.query.id as string | undefined;

  if (req.method === "GET") {
    const { data, error } = await sb.from("print_jobs").select("*").order("created_at", { ascending: false }).limit(200);
    throwIf(error);
    res.status(200).json({ items: data || [] });
    return;
  }

  if (req.method === "PATCH" && id) {
    const body = readBody<{ status?: string; printer?: string; dueAt?: string; notes?: string }>(req);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status) patch.status = body.status;
    if (body.printer != null) patch.printer = body.printer;
    if (body.dueAt) patch.due_at = body.dueAt;
    if (body.notes != null) patch.notes = body.notes;
    const { data, error } = await sb.from("print_jobs").update(patch).eq("id", id).select("*").maybeSingle();
    throwIf(error);
    if (!data) throw new Error("Print job not found");
    if ((body.status === "printing" || body.status === "done") && data.order_id) {
      await sb
        .from("orders")
        .update({
          status: body.status === "done" ? "confirmed" : "printing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.order_id);
    }
    res.status(200).json({ job: data });
    return;
  }

  return methodNotAllowed(res, ["GET", "PATCH"]);
}

async function handleInbox(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const body = readBody<{ inquiryId?: string; action?: "draft" | "send"; draftId?: string }>(req);
  const sb = getSupabase();

  if (body.action === "send" && body.draftId) {
    const { data: draft, error } = await sb.from("drafts").select("*").eq("id", body.draftId).maybeSingle();
    throwIf(error);
    if (!draft) throw new Error("Draft not found");
    const payload = draft.payload as {
      to?: string;
      subject?: string;
      body?: string;
      inquiryId?: string;
      quoteINR?: number;
    };
    if (!payload.to || !payload.body) throw new Error("Draft is missing a recipient or body");
    await sendEmail(
      payload.to,
      payload.subject || "Toying Idea",
      payload.body.replace(/\n/g, "<br/>"),
      "inbox",
      "inquiry-reply"
    );
    if (payload.inquiryId) {
      await sb
        .from("inquiries")
        .update({
          status: payload.quoteINR ? "quoted" : "in-review",
          quote: payload.quoteINR ? { amount: payload.quoteINR, currency: "INR" } : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payload.inquiryId);
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
}

async function handleMarketing(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const body = readBody<{ productName?: string; trend?: string; extraImages?: number }>(req);
  const productName = body.productName || "Toying Idea collectible";
  const trend = body.trend || "collectible 3D-printed toys";

  let pack = {
    caption: `${productName} — toys built to collect. Printed in PLA in Patiala.`,
    hashtags: ["toyingidea", "3dprintedtoys", "pla", "collectibles"],
    reelShots: ["Close-up of layer lines", "Hand rotating the piece", "Shelf of the collection"],
    altText: productName,
  };
  try {
    pack = await openaiJson<typeof pack>(MARKETING_SYSTEM, `Product: ${productName}. Trend: ${trend}.`);
  } catch (err) {
    if (process.env.OPENAI_API_KEY) throw err;
  }

  let stills: string[] = [];
  try {
    stills = await openaiImages(
      `Instagram still of ${productName}, 3D-printed PLA collectible toy, cream studio backdrop, ${trend}, no text.`,
      body.extraImages ?? 2
    );
  } catch (err) {
    console.error(err);
  }

  const { data, error } = await getSupabase()
    .from("drafts")
    .insert({
      agent: "marketing",
      status: "pending",
      title: `Social pack — ${productName}`,
      payload: { ...pack, stills, productName, trend },
    })
    .select("*")
    .single();
  throwIf(error);
  res.status(201).json({ draft: { ...data, _id: data.id } });
}

async function handleWebsite(req: VercelRequest, res: VercelResponse) {
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
      .insert({ agent: "website", status: "pending", title: ticket.title, payload: ticket })
      .select("*")
      .single();
    throwIf(error);
    res.status(201).json({ draft: { ...data, _id: data.id } });
    return;
  }

  return methodNotAllowed(res, ["GET", "POST"]);
}

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  verifyAdmin(req);
  switch (resource(req)) {
    case "upload":
      return handleUpload(req, res);
    case "catalog":
      return handleCatalog(req, res);
    case "drafts":
      return handleDrafts(req, res);
    case "print-jobs":
      return handlePrintJobs(req, res);
    case "inbox":
      return handleInbox(req, res);
    case "marketing":
      return handleMarketing(req, res);
    case "website":
      return handleWebsite(req, res);
    default:
      throw new Error("Unknown studio resource");
  }
});
