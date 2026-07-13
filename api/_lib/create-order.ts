import type { Types } from "mongoose";
import { Order } from "./models/Order.js";
import { Product } from "./models/Product.js";
import { recordSaleLines, restoreSaleLines } from "./inventory.js";
import { resolveVariantLabel, resolveVariantPrice } from "./product-utils.js";
import { nextOrderNumber } from "./order-number.js";
import {
  normalizeEmail,
  positiveInt,
  requireString,
  sanitizeRecord,
  validateIndianPhone,
  validateShippingAddress,
} from "./validate.js";

const SHIPPING_FLAT = 99;
const FREE_SHIPPING_MIN = 1500;

type IncomingItem = {
  productId?: string;
  slug?: string;
  qty: number;
  options?: Record<string, string>;
};

export async function createStoreOrder(body: {
  customer?: { name?: string; email?: string; phone?: string };
  shippingAddress?: Record<string, string>;
  items?: IncomingItem[];
  paymentMethod?: string;
  notes?: string;
}) {
  const name = requireString(body.customer?.name, "Customer name");
  const email = normalizeEmail(body.customer?.email);
  const phone = validateIndianPhone(body.customer?.phone, true);
  const shippingAddress = validateShippingAddress(
    sanitizeRecord(body.shippingAddress) as Record<string, string>
  );
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
    const p = products.find((pr) => String(pr._id) === i.productId || pr.slug === i.slug);
    if (!p) throw new Error("Invalid or unavailable product in cart");
    if (p.inStock === false) throw new Error(`${p.name} is out of stock`);

    const qty = positiveInt(i.qty, 1);
    const options = sanitizeRecord(i.options) as Record<string, string>;
    const variantId = options.variantId || "";
    const unitPrice = resolveVariantPrice(p, variantId);
    const variantLabel = resolveVariantLabel(p, variantId);
    const displayName = variantLabel ? `${p.name} — ${variantLabel}` : p.name;

    return {
      productId: p._id as Types.ObjectId,
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
  const stockLines = lineItems.map((li) => ({ productId: li.productId, qty: li.qty }));

  const orderNumber = await nextOrderNumber();

  // Reserve stock first (atomic per SKU, auto-rollback on partial failure).
  await recordSaleLines(stockLines, undefined, orderNumber);

  try {
    const order = await Order.create({
      orderNumber,
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

    return order;
  } catch (err) {
    await restoreSaleLines(stockLines, undefined, orderNumber);
    throw err;
  }
}
