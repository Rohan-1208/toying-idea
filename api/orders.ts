import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed, readBody } from "./_lib/http.js";
import { getSupabase } from "./_lib/supabase.js";
import { mapOrder, throwIf } from "./_lib/map.js";
import { verifyAdmin, isAdminRequest } from "./_lib/auth.js";
import { ORDER_STATUSES } from "./_lib/constants.js";
import { restoreCancelledOrder } from "./_lib/inventory.js";
import { sendOrderStatusUpdateEmail } from "./_lib/mail.js";
import { createStoreOrder } from "./_lib/create-order.js";

function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  const sb = getSupabase();
  const id = req.query.id as string;

  if (id) {
    const finder = isUuid(id)
      ? sb.from("orders").select("*").eq("id", id)
      : sb.from("orders").select("*").eq("order_number", id.toUpperCase());

    if (req.method === "GET") {
      const emailRaw = (req.query.email as string) || "";
      const isAdmin = isAdminRequest(req);
      const { data, error } = await finder.maybeSingle();
      throwIf(error);
      if (!data) throw new Error("Order not found");
      const order = mapOrder(data);
      if (!isAdmin) {
        const orderEmail = order.customer?.email?.toLowerCase() || "";
        const email = emailRaw.trim().toLowerCase();
        if (!email || email !== orderEmail) {
          throw new Error("Unauthorized: email does not match this order");
        }
      }
      res.status(200).json({ order });
      return;
    }

    if (req.method === "PUT" || req.method === "PATCH") {
      verifyAdmin(req);
      const body = readBody<{
        status?: string;
        paymentStatus?: string;
        notes?: string;
        tracking?: { carrier?: string; number?: string; url?: string; estimatedDelivery?: string };
        statusNote?: string;
      }>(req);

      const { data: existing, error: exErr } = await finder.maybeSingle();
      throwIf(exErr);
      if (!existing) throw new Error("Order not found");
      const prev = mapOrder(existing);

      if (body.status && !ORDER_STATUSES.includes(body.status as (typeof ORDER_STATUSES)[number])) {
        throw new Error("Invalid status");
      }

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.status) patch.status = body.status;
      if (body.paymentStatus) patch.payment_status = body.paymentStatus;
      if (typeof body.notes === "string") patch.notes = body.notes;
      if (body.tracking) patch.tracking = body.tracking;
      if (body.status) {
        const history = [...(prev.statusHistory || []), {
          status: body.status,
          note: body.statusNote || `Status updated to ${body.status}`,
          at: new Date().toISOString(),
        }];
        patch.status_history = history;
      }

      const { data, error } = await sb.from("orders").update(patch).eq("id", existing.id).select("*").single();
      throwIf(error);
      const order = mapOrder(data);

      if (body.status === "cancelled" && prev.status !== "cancelled") {
        await restoreCancelledOrder(prev.items, prev.orderNumber);
      }
      if (body.status && body.status !== prev.status) {
        if (body.status === "printing" || body.status === "confirmed") {
          await sb.from("print_jobs").update({
            status: body.status === "printing" ? "printing" : "queued",
            updated_at: new Date().toISOString(),
          }).eq("order_id", existing.id);
        }
        sendOrderStatusUpdateEmail(order, body.statusNote).catch((err) =>
          console.error("Failed to send order status update email:", err)
        );
      }
      res.status(200).json({ order });
      return;
    }

    return methodNotAllowed(res, ["GET", "PUT", "PATCH"]);
  }

  if (req.method === "GET") {
    verifyAdmin(req);
    const { status, q, limit = "100", page = "1" } = req.query as Record<string, string>;
    let query = sb.from("orders").select("*", { count: "exact" }).order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    if (q) {
      query = query.or(`order_number.ilike.%${q}%,customer->>email.ilike.%${q}%,customer->>name.ilike.%${q}%`);
    }
    const lim = Math.min(parseInt(limit, 10) || 100, 300);
    const pg = Math.max(parseInt(page, 10) || 1, 1);
    const from = (pg - 1) * lim;
    const { data, error, count } = await query.range(from, from + lim - 1);
    throwIf(error);
    res.status(200).json({ items: (data || []).map(mapOrder), total: count ?? 0 });
    return;
  }

  if (req.method === "POST") {
    const body = readBody<Parameters<typeof createStoreOrder>[0]>(req);
    const order = await createStoreOrder({ ...body, paymentMethod: "cod" });
    res.status(201).json({ order });
    return;
  }

  return methodNotAllowed(res, ["GET", "POST"]);
});
