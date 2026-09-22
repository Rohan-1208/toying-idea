import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed, readBody } from "../_lib/http.js";
import { verifyAdmin } from "../_lib/auth.js";
import { getSupabase } from "../_lib/supabase.js";
import { throwIf } from "../_lib/map.js";
import { slugify } from "../_lib/slug.js";
import { productToRow } from "../_lib/map.js";

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

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  verifyAdmin(req);
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
});
