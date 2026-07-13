import type { VercelRequest, VercelResponse } from "@vercel/node";
import mongoose from "mongoose";
import { withApi, methodNotAllowed, readBody } from "./_lib/http.js";
import { connectDB } from "./_lib/db.js";
import { Order, generateOrderNumber, ORDER_STATUSES } from "./_lib/models/Order.js";
import { Product } from "./_lib/models/Product.js";
import { verifyAdmin, isAdminRequest } from "./_lib/auth.js";
import { recordSaleLines, restoreCancelledOrder } from "./_lib/inventory.js";
import { resolveVariantLabel, resolveVariantPrice } from "./_lib/product-utils.js";
import { normalizeEmail, positiveInt, requireString, sanitizeRecord } from "./_lib/validate.js";
import { sendOrderConfirmationEmail, sendOrderStatusUpdateEmail } from "./_lib/mail.js";

type IncomingItem = {
  productId?: string;
  slug?: string;
  qty: number;
  price?: number;
  options?: Record<string, string>;
};

const SHIPPING_FLAT = 99;
const FREE_SHIPPING_MIN = 1500;

function findQuery(id: string) {
  return mongoose.isValidObjectId(id) ? { _id: id } : { orderNumber: id.toUpperCase() };
}

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  await connectDB();
  const id = req.query.id as string;

  // Case 1: Route with order ID/number parameter (e.g. /api/orders/:id)
  if (id) {
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
  }

  // Case 2: Base route (e.g. /api/orders)
  if (req.method === "GET") {
    verifyAdmin(req);
    const { status, q, limit = "100", page = "1" } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (q) {
      filter.$or = [
        { orderNumber: { $regex: q, $options: "i" } },
        { "customer.email": { $regex: q, $options: "i" } },
        { "customer.name": { $regex: q, $options: "i" } },
      ];
    }
    const lim = Math.min(parseInt(limit, 10) || 100, 300);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * lim;
    const [items, total] = await Promise.all([
      Order.find(filter).sort("-createdAt").skip(skip).limit(lim).lean(),
      Order.countDocuments(filter),
    ]);
    res.status(200).json({ items, total });
    return;
  }

  if (req.method === "POST") {
    const body = readBody<{
      customer?: { name?: string; email?: string; phone?: string };
      shippingAddress?: Record<string, string>;
      items?: IncomingItem[];
      paymentMethod?: string;
      notes?: string;
    }>(req);

    const name = requireString(body.customer?.name, "Customer name");
    const email = normalizeEmail(body.customer?.email);
    const phone = body.customer?.phone?.trim() || "";
    const shippingAddress = sanitizeRecord(body.shippingAddress) as Record<string, string>;
    const items = body.items;
    const paymentMethod = body.paymentMethod?.trim() || "cod";
    const notes = body.notes?.trim() || "";

    if (!items?.length) throw new Error("Order must contain at least one item");

    const ids = items.map((i) => i.productId).filter(Boolean) as string[];
    const slugs = items.map((i) => i.slug).filter(Boolean) as string[];
    const products = await Product.find({
      active: true,
      $or: [{ _id: { $in: ids } }, { slug: { $in: slugs } }],
    }).lean();

    const lineItems = items.map((i) => {
      const p = products.find(
        (pr) => String(pr._id) === i.productId || pr.slug === i.slug
      );
      if (!p) throw new Error("Invalid or unavailable product in cart");
      if (p.inStock === false) throw new Error(`${p.name} is out of stock`);

      const qty = positiveInt(i.qty, 1);
      if (typeof p.stock === "number" && p.stock < qty) {
        throw new Error(`Only ${p.stock} left in stock for ${p.name}`);
      }

      const options = sanitizeRecord(i.options) as Record<string, string>;
      const variantId = options.variantId || "";
      const unitPrice = resolveVariantPrice(p, variantId);
      const variantLabel = resolveVariantLabel(p, variantId);
      const displayName = variantLabel ? `${p.name} — ${variantLabel}` : p.name;

      return {
        productId: p._id,
        slug: p.slug,
        sku: p.sku || "",
        name: displayName,
        price: unitPrice,
        qty,
        image: p.thumbnail || p.images?.[0] || "",
        options,
      };
    });

    const subtotal = lineItems.reduce((s, li) => s + li.price * li.qty, 0);
    const shipping = subtotal >= FREE_SHIPPING_MIN || subtotal === 0 ? 0 : SHIPPING_FLAT;
    const total = subtotal + shipping;

    const session = await mongoose.startSession();
    let order;
    try {
      await session.withTransaction(async () => {
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            const [created] = await Order.create(
              [
                {
                  orderNumber: generateOrderNumber(),
                  customer: { name, email, phone },
                  shippingAddress,
                  items: lineItems,
                  subtotal,
                  shipping,
                  total,
                  paymentMethod,
                  paymentStatus: paymentMethod === "cod" ? "unpaid" : "paid",
                  notes,
                  statusHistory: [{ status: "pending", note: "Order placed", at: new Date() }],
                },
              ],
              { session }
            );
            order = created;
            break;
          } catch (err) {
            const code = (err as { code?: number }).code;
            if (code !== 11000 || attempt === 4) throw err;
          }
        }

        await recordSaleLines(
          lineItems.map((li) => ({ productId: li.productId, qty: li.qty })),
          order!._id,
          order!.orderNumber,
          session
        );
      });
    } finally {
      await session.endSession();
    }

    // Send confirmation email asynchronously (do not block client response)
    sendOrderConfirmationEmail(order!).catch((err) =>
      console.error("Failed to send order confirmation email:", err)
    );

    res.status(201).json({ order });
    return;
  }

  return methodNotAllowed(res, ["GET", "POST"]);
});
