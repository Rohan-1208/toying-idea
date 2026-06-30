import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed } from "./_lib/http.js";
import { connectDB } from "./_lib/db.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  const hasUri = Boolean(process.env.MONGODB_URI);
  let db: "connected" | "error" | "not_configured" = hasUri ? "error" : "not_configured";
  let dbError: string | undefined;

  if (hasUri) {
    try {
      const conn = await connectDB();
      await conn.connection.db?.admin().ping();
      db = "connected";
    } catch (err) {
      dbError = err instanceof Error ? err.message : "Database connection failed";
    }
  }

  res.status(db === "connected" ? 200 : 503).json({
    ok: db === "connected",
    service: "toying-idea-api",
    db,
    dbName: process.env.MONGODB_DB || null,
    ...(dbError ? { dbError } : {}),
    timestamp: new Date().toISOString(),
  });
});
