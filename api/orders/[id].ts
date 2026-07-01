import type { VercelRequest, VercelResponse } from "@vercel/node";
import mongoose from "mongoose";
import { withApi, methodNotAllowed, readBody } from "../_lib/http.js";
import { connectDB } from "../_lib/db.js";
import { Order, ORDER_STATUSES } from "../_lib/models/Order.js";
import { verifyAdmin, isAdminRequest } from "../_lib/auth.js";
import { restoreCancelledOrder } from "../_lib/inventory.js";
import { sendOrderStatusUpdateEmail } from "../_lib/mail.js";

function findQuery(id: string) {
  return mongoose.isValidObjectId(id) ? { _id: id } : { orderNumber: id.toUpperCase() };
}

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  await connectDB();
  const id = (req.query.id as string) || "";
  if (!id) throw new Error("Order id is required");

  if (req.method === "GET") {
    const emailRaw = (req.query.email as string) || "";
    const isAdmin = isAdminRequest(req);
    const order = await Order.findOne(findQuery(id)).lean();
    if (!order) throw new Error("Order not found");
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
      tracking?: {
        carrier?: string;
        number?: string;
        url?: string;
        estimatedDelivery?: string;
      };
      statusNote?: string;
    }>(req);

    const existing = await Order.findOne(findQuery(id));
    if (!existing) throw new Error("Order not found");

    if (body.status && !ORDER_STATUSES.includes(body.status as (typeof ORDER_STATUSES)[number])) {
      throw new Error("Invalid status");
    }

    const prevStatus = existing.status;
    const setFields: Record<string, unknown> = {};
    const pushHistory = {
      status: body.status!,
      note: body.statusNote || `Status updated to ${body.status}`,
      at: new Date(),
    };

    if (body.status) setFields.status = body.status;
    if (body.paymentStatus) setFields.paymentStatus = body.paymentStatus;
    if (typeof body.notes === "string") setFields.notes = body.notes;

    if (body.tracking) {
      setFields.tracking = {
        carrier: body.tracking.carrier || "",
        number: body.tracking.number || "",
        url: body.tracking.url || "",
        estimatedDelivery: body.tracking.estimatedDelivery
          ? new Date(body.tracking.estimatedDelivery)
          : null,
      };
    }

    const mongoUpdate: Record<string, unknown> = { $set: setFields };
    if (body.status) mongoUpdate.$push = { statusHistory: pushHistory };

    const order = await Order.findOneAndUpdate(findQuery(id), mongoUpdate, { new: true }).lean();
    if (!order) throw new Error("Order not found");

    if (body.status === "cancelled" && prevStatus !== "cancelled") {
      await restoreCancelledOrder(existing.items, existing._id, existing.orderNumber);
    }

    // Trigger status update email if the status actually changed
    if (body.status && body.status !== prevStatus) {
      sendOrderStatusUpdateEmail(order, body.statusNote).catch((err) =>
        console.error("Failed to send order status update email:", err)
      );
    }

    res.status(200).json({ order });
    return;
  }

  return methodNotAllowed(res, ["GET", "PUT", "PATCH"]);
});
