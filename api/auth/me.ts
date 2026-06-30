import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed } from "../_lib/http.js";
import { verifyAdmin } from "../_lib/auth.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const claims = verifyAdmin(req);
  res.status(200).json({ admin: { email: claims.email, role: claims.role } });
});
