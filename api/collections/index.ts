import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed } from "../_lib/http.js";

/**
 * Catalog collections come from Shopify Storefront on the client.
 * This endpoint is retained only so old clients get a clear error.
 */
export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  res.status(410).json({
    error: "Collections are served from Shopify. Use the Storefront API / client collections helper.",
    collections: [],
    categories: [],
  });
});
