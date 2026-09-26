import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, readBody } from "./_lib/http.js";
import { verifyAdmin } from "./_lib/auth.js";
import { handleAgentOs } from "./_lib/agent-os.js";

export const config = { maxDuration: 60 };

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  const admin = verifyAdmin(req);
  const result = await handleAgentOs(
    { method: req.method, query: req.query, body: readBody(req) },
    admin.email,
  );
  if (req.method === "DELETE") {
    res.status(204).end();
    return;
  }
  res.status(req.method === "POST" ? 201 : 200).json(result ?? {});
});
