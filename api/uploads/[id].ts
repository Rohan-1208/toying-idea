import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi } from "../_lib/http.js";

export default withApi(async (_req: VercelRequest, res: VercelResponse) => {
  res.status(410).json({
    error: "GridFS uploads are retired. Images are stored in Supabase Storage (product-images bucket).",
  });
});
