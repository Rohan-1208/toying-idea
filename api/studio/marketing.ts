import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed, readBody } from "../_lib/http.js";
import { verifyAdmin } from "../_lib/auth.js";
import { getSupabase } from "../_lib/supabase.js";
import { throwIf } from "../_lib/map.js";
import { MARKETING_SYSTEM } from "../_lib/brand.js";
import { openaiImages, openaiJson } from "../_lib/openai.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  verifyAdmin(req);
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

  const sb = getSupabase();
  const { data, error } = await sb
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
});
