import { promises as dns } from "node:dns";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed } from "./_lib/http.js";
import { formatUnknownError, getSupabase, supabaseConfig } from "./_lib/supabase.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if ((req.query.resource as string) === "uploads" || (req.url || "").includes("/uploads/")) {
    res.status(410).json({
      error: "GridFS uploads are retired. Images are stored in Supabase Storage (product-images bucket).",
    });
    return;
  }

  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  const cfg = supabaseConfig();
  const hasUrl = Boolean(cfg.url);
  const hasKey = Boolean(cfg.key);
  let db: "connected" | "error" | "not_configured" = hasUrl && hasKey ? "error" : "not_configured";
  let dbError: string | undefined;
  let dnsAddress: string | null = null;
  let dnsError: string | undefined;

  if (cfg.host) {
    try {
      const looked = await dns.lookup(cfg.host, { family: 4 });
      dnsAddress = looked.address;
    } catch (err) {
      dnsError = formatUnknownError(err);
    }
  }

  if (hasUrl && hasKey) {
    try {
      if (!cfg.urlOk) {
        throw new Error(
          `SUPABASE_URL must be https://YOURPROJECT.supabase.co (got ${cfg.host || "invalid"}). Copy it from the green Connect button, not the dashboard link.`
        );
      }
      if (cfg.keyKind === "publishable") {
        throw new Error("Use a secret key (sb_secret_…) or Legacy service_role (eyJ…), not the publishable key.");
      }
      if (dnsError) {
        throw new Error(
          `Cannot resolve ${cfg.host} (${dnsError}). Open Supabase → Connect and paste that Project URL into Vercel SUPABASE_URL, then redeploy.`
        );
      }
      const sb = getSupabase();
      const { error } = await sb.from("products").select("id").limit(1);
      if (error) throw new Error(error.message);
      db = "connected";
    } catch (err) {
      dbError = formatUnknownError(err);
    }
  }

  res.status(db === "connected" ? 200 : 503).json({
    ok: db === "connected",
    service: "toying-idea-api",
    db,
    provider: "supabase",
    urlHost: cfg.host || null,
    urlOk: cfg.urlOk,
    keyKind: cfg.keyKind,
    dnsAddress,
    ...(dnsError ? { dnsError } : {}),
    ...(dbError ? { dbError } : {}),
    timestamp: new Date().toISOString(),
  });
});
