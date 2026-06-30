import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed, readBody } from "../_lib/http.js";
import { checkAdminCredentials, signAdminToken } from "../_lib/auth.js";
import { normalizeEmail, requireString } from "../_lib/validate.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  const body = readBody<{ email?: string; password?: string }>(req);
  const email = normalizeEmail(body.email);
  const password = requireString(body.password, "Password");

  if (!checkAdminCredentials(email, password)) {
    throw new Error("Unauthorized: invalid credentials");
  }

  const token = signAdminToken(email);
  res.status(200).json({ token, admin: { email, role: "admin" } });
});
