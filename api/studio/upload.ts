import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed, readBody } from "../_lib/http.js";
import { verifyAdmin } from "../_lib/auth.js";
import { uploadImageBytes } from "../_lib/openai.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  verifyAdmin(req);
  const body = readBody<{ filename?: string; contentType?: string; data?: string }>(req);
  if (!body.data) throw new Error("Image data is required");
  const buf = Buffer.from(body.data.replace(/^data:[^;]+;base64,/, ""), "base64");
  if (!buf.length) throw new Error("Invalid image data");
  const url = await uploadImageBytes(buf, body.filename || "upload.png", body.contentType || "image/png");
  res.status(201).json({ url });
});
