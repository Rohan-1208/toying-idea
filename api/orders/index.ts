import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed, readBody } from "../_lib/http.js";
import { connectDB } from "../_lib/db.js";
import { Order, generateOrderNumber, ORDER_STATUSES } from "../_lib/models/Order.js";
import { Product } from "../_lib/models/Product.js";
import { verifyAdmin } from "../_lib/auth.js";
import { recordSaleLines } from "../_lib/inventory.js";
import { normalizeEmail, positiveInt, requireString, sanitizeRecord } from "../_lib/validate.js";
import { sendOrderConfirmationEmail } from "../_lib/mail.js";

type IncomingItem = { productId?: string; slug?: string; qty: number; options?: unknown };

const SHIPPING_FLAT = 99;
const FREE_SHIPPING_MIN = 1500;

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  await connectDB();

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

      return {
        productId: p._id,
        slug: p.slug,
        sku: p.sku || "",
        name: p.name,
        price: p.price,
        qty,
        image: p.thumbnail || p.images?.[0] || "",
        options: sanitizeRecord(i.options),
      };
    });

    const subtotal = lineItems.reduce((s, li) => s + li.price * li.qty, 0);
    const shipping = subtotal >= FREE_SHIPPING_MIN || subtotal === 0 ? 0 : SHIPPING_FLAT;
    const total = subtotal + shipping;

    const order = await Order.create({
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
    });

    await recordSaleLines(
      lineItems.map((li) => ({ productId: li.productId, qty: li.qty })),
      order._id,
      order.orderNumber
    );

    // Send confirmation email asynchronously (do not block client response)
    sendOrderConfirmationEmail(order).catch((err) =>
      console.error("Failed to send order confirmation email:", err)
    );

    res.status(201).json({ order });
    return;
  }

  return methodNotAllowed(res, ["GET", "POST"]);
});
