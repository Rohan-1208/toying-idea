import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed, readBody } from "../_lib/http.js";
import { verifyAdmin } from "../_lib/auth.js";
import { getSupabase } from "../_lib/supabase.js";
import { throwIf } from "../_lib/map.js";
import { CATALOG_SYSTEM } from "../_lib/brand.js";
import { openaiImages, openaiJson } from "../_lib/openai.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  verifyAdmin(req);
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
    if (process.env.OPENAI_API_KEY) {
      console.error(err);
    }
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

  const sb = getSupabase();
  const { data, error } = await sb
    .from("drafts")
    .insert({
      agent: "catalog",
      status: "pending",
      title: listing.name,
      payload,
    })
    .select("*")
    .single();
  throwIf(error);
  res.status(201).json({ draft: { ...data, _id: data.id } });
});
