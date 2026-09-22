import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed } from "../_lib/http.js";
import { getSupabase } from "../_lib/supabase.js";
import { throwIf } from "../_lib/map.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const sb = getSupabase();
  const { data, error } = await sb.from("products").select("collection_name, category, categories").eq("active", true);
  throwIf(error);
  const collections = new Set<string>();
  const categories = new Set<string>();
  for (const row of data || []) {
    if (row.collection_name) collections.add(String(row.collection_name));
    if (row.category) categories.add(String(row.category));
    for (const c of row.categories || []) categories.add(String(c));
  }
  res.status(200).json({ collections: [...collections], categories: [...categories] });
});
