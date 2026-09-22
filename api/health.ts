import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed } from "./_lib/http.js";
import { getSupabase } from "./_lib/supabase.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  const hasUrl = Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const hasKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  let db: "connected" | "error" | "not_configured" = hasUrl && hasKey ? "error" : "not_configured";
  let dbError: string | undefined;

  if (hasUrl && hasKey) {
    try {
      const sb = getSupabase();
      const { error } = await sb.from("products").select("id").limit(1);
      if (error) throw new Error(error.message);
      db = "connected";
    } catch (err) {
      dbError = err instanceof Error ? err.message : "Database connection failed";
    }
  }

  res.status(db === "connected" ? 200 : 503).json({
    ok: db === "connected",
    service: "toying-idea-api",
    db,
    provider: "supabase",
    ...(dbError ? { dbError } : {}),
    timestamp: new Date().toISOString(),
  });
});
