import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed, readBody } from "./_lib/http.js";
import { findShopifyOrderForTracking } from "./_lib/shopify-track.js";
import { isShopifyAdminConfigured } from "./_lib/shopify-admin.js";

/**
 * Public order tracking against Shopify Admin API.
 * GET/POST /api/track?order=TI1005&email=you@email.com
 */
export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return methodNotAllowed(res, ["GET", "POST"]);
  }

  if (!isShopifyAdminConfigured()) {
    throw new Error(
      "Order tracking is not configured. Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN on Vercel (Production), then redeploy."
    );
  }

  const body =
    req.method === "POST"
      ? readBody<{ order?: string; orderNumber?: string; email?: string }>(req)
      : {};

  const orderNumber =
    (typeof req.query.order === "string" && req.query.order) ||
    (typeof req.query.orderNumber === "string" && req.query.orderNumber) ||
    body.order ||
    body.orderNumber ||
    "";
  const email =
    (typeof req.query.email === "string" && req.query.email) || body.email || "";

  const order = await findShopifyOrderForTracking(orderNumber, email);
  res.status(200).json({ order });
});
