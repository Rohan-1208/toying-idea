import { getSupabase } from "./supabase.js";
import { mapProduct, throwIf } from "./map.js";
import type { Product } from "./app-types.js";

export async function adjustStock(opts: {
  productId: string;
  delta: number;
  reason: string;
  orderNumber?: string;
  note?: string;
  actor?: string;
}): Promise<Product> {
  const sb = getSupabase();
  const { data: row, error } = await sb.from("products").select("*").eq("id", opts.productId).maybeSingle();
  throwIf(error);
  if (!row) throw new Error("Product not found");

  const stock = Number(row.stock) || 0;
  const next = stock + opts.delta;
  if (next < 0) throw new Error("Insufficient stock for one or more items");

  const { data: updated, error: upErr } = await sb
    .from("products")
    .update({ stock: next, in_stock: next > 0, updated_at: new Date().toISOString() })
    .eq("id", opts.productId)
    .select("*")
    .single();
  throwIf(upErr);

  await sb.from("inventory_movements").insert({
    product_id: opts.productId,
    slug: row.slug,
    sku: row.sku || "",
    delta: opts.delta,
    stock_after: next,
    reason: opts.reason,
    order_number: opts.orderNumber || "",
    note: opts.note || "",
    actor: opts.actor || "system",
  });

  return mapProduct(updated);
}

export async function recordSaleLines(
  lines: { productId: string; qty: number }[],
  _orderId: string | undefined,
  orderNumber?: string
) {
  const completed: { productId: string; qty: number }[] = [];
  try {
    for (const li of lines) {
      await adjustStock({
        productId: li.productId,
        delta: -li.qty,
        reason: "sale",
        orderNumber,
      });
      completed.push(li);
    }
  } catch (err) {
    for (const li of completed.reverse()) {
      await adjustStock({
        productId: li.productId,
        delta: li.qty,
        reason: "restore",
        orderNumber,
        note: "Rollback after failed checkout",
      });
    }
    throw err;
  }
}

export async function restoreSaleLines(
  lines: { productId?: string; qty: number }[],
  orderNumber?: string
) {
  for (const li of lines) {
    if (!li.productId) continue;
    await adjustStock({
      productId: li.productId,
      delta: li.qty,
      reason: "restore",
      orderNumber,
      note: "Order cancelled",
    });
  }
}

export async function restoreCancelledOrder(
  items: { productId?: string; qty: number }[],
  orderNumber?: string
) {
  await restoreSaleLines(items, orderNumber);
}
