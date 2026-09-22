import { getSupabase } from "./supabase.js";
import { mapOrder, mapProduct, throwIf } from "./map.js";
import { nextOrderNumber } from "./order-number.js";
import { recordSaleLines, restoreSaleLines } from "./inventory.js";
import { resolveVariantLabel, resolveVariantPrice } from "./product-utils.js";
import { sendOrderConfirmationEmail } from "./mail.js";
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
  const paymentMethod = (body.paymentMethod?.trim() || "cod").toLowerCase();
  const notes = body.notes?.trim() || "";
  if (paymentMethod !== "cod") throw new Error("Only cash on delivery is available right now");
  if (!items?.length) throw new Error("Order must contain at least one item");

  const sb = getSupabase();
  const ids = items.map((i) => i.productId).filter(Boolean) as string[];
  const slugs = items.map((i) => i.slug).filter(Boolean) as string[];

  const products: ReturnType<typeof mapProduct>[] = [];
  if (ids.length) {
    const { data, error: idErr } = await sb.from("products").select("*").eq("active", true).in("id", ids);
    throwIf(idErr);
    products.push(...(data || []).map(mapProduct));
  }
  if (slugs.length) {
    const { data, error: slugErr } = await sb.from("products").select("*").eq("active", true).in("slug", slugs);
    throwIf(slugErr);
    for (const row of data || []) {
      const mapped = mapProduct(row);
      if (!products.some((p) => p._id === mapped._id)) products.push(mapped);
    }
  }

  const lineItems = items.map((i) => {
    const p = products.find((pr) => pr._id === i.productId || pr.slug === i.slug);
    if (!p || !p._id) throw new Error("Invalid or unavailable product in cart");
    if (p.inStock === false) throw new Error(`${p.name} is out of stock`);
    const qty = positiveInt(i.qty, 1);
    const options = sanitizeRecord(i.options) as Record<string, string>;
    const variantId = options.variantId || "";
    const unitPrice = resolveVariantPrice(p, variantId);
    const variantLabel = resolveVariantLabel(p, variantId);
    return {
      productId: p._id,
      slug: p.slug,
      sku: p.sku || "",
      name: variantLabel ? `${p.name} — ${variantLabel}` : p.name,
      price: unitPrice,
      qty,
      image: p.thumbnail || p.images?.[0] || "",
      options,
    };
  });

  const subtotal = lineItems.reduce((s, li) => s + li.price * li.qty, 0);
  const shipping = subtotal >= FREE_SHIPPING_MIN || subtotal === 0 ? 0 : SHIPPING_FLAT;
  const total = subtotal + shipping;
  const orderNumber = await nextOrderNumber();
  const now = new Date().toISOString();

  await recordSaleLines(
    lineItems.map((li) => ({ productId: li.productId, qty: li.qty })),
    undefined,
    orderNumber
  );

  const { data: created, error: insErr } = await sb
    .from("orders")
    .insert({
      order_number: orderNumber,
      customer: { name, email, phone },
      shipping_address: shippingAddress,
      items: lineItems,
      subtotal,
      shipping,
      total,
      currency: "INR",
      payment_method: "cod",
      payment_status: "unpaid",
      status: "pending",
      notes,
      status_history: [{ status: "pending", note: "COD order placed", at: now }],
    })
    .select("*")
    .single();

  if (insErr) {
    await restoreSaleLines(lineItems, orderNumber);
    throw new Error(insErr.message);
  }

  const qty = lineItems.reduce((s, li) => s + li.qty, 0);
  await sb.from("print_jobs").insert({
    order_id: created.id,
    order_number: orderNumber,
    sku: lineItems.map((l) => l.sku).filter(Boolean).join(", "),
    qty,
    status: "queued",
    notes: lineItems.map((l) => l.name).join("; "),
  });

  const order = mapOrder(created);
  sendOrderConfirmationEmail(order).catch((err) =>
    console.error("Failed to send order confirmation email:", err)
  );
  return order;
}
