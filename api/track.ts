import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed, readBody } from "./_lib/http.js";
import { getSupabase } from "./_lib/supabase.js";
import { mapOrder, throwIf } from "./_lib/map.js";

const STEP: Record<string, "placed" | "confirmed" | "printing" | "shipped" | "delivered" | "cancelled"> = {
  pending: "placed",
  confirmed: "confirmed",
  printing: "printing",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
};

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return methodNotAllowed(res, ["GET", "POST"]);
  }

  const body =
    req.method === "POST"
      ? readBody<{ order?: string; orderNumber?: string; email?: string }>(req)
      : {};

  const orderNumber = String(
    req.query.order || req.query.orderNumber || body.order || body.orderNumber || ""
  )
    .toUpperCase()
    .replace(/\s+/g, "");
  const email = String(req.query.email || body.email || "")
    .trim()
    .toLowerCase();
  if (!orderNumber || !email) throw new Error("Order number and email are required");

  const sb = getSupabase();
  const { data, error } = await sb.from("orders").select("*").eq("order_number", orderNumber).maybeSingle();
  throwIf(error);
  if (!data) throw new Error("Order not found");
  const order = mapOrder(data);
  if ((order.customer.email || "").toLowerCase() !== email) throw new Error("Order not found");

  res.status(200).json({
    order: {
      orderNumber: order.orderNumber,
      email: order.customer.email,
      financialStatus: order.paymentStatus === "paid" ? "paid" : "pending",
      fulfillmentStatus: order.status,
      processedAt: order.createdAt,
      items: order.items.map((i) => ({ title: i.name, quantity: i.qty })),
      fulfillments: order.tracking?.number
        ? [
            {
              status: order.status,
              carrier: order.tracking.carrier,
              number: order.tracking.number,
              url: order.tracking.url,
              createdAt: order.updatedAt,
            },
          ]
        : [],
      step: STEP[order.status] || "placed",
      paymentMethod: order.paymentMethod || "cod",
    },
  });
});
