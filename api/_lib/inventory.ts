import type { ClientSession, Types } from "mongoose";
import { Product } from "./models/Product.js";
import { InventoryMovement, type INVENTORY_REASONS } from "./models/InventoryMovement.js";

type Reason = (typeof INVENTORY_REASONS)[number];

export async function adjustStock(opts: {
  productId: Types.ObjectId | string;
  delta: number;
  reason: Reason;
  orderId?: Types.ObjectId | string;
  orderNumber?: string;
  note?: string;
  actor?: string;
  session?: ClientSession;
}) {
  const { productId, delta, reason, orderId, orderNumber, note = "", actor = "system", session } = opts;
  const qty = Math.abs(delta);
  const isSale = delta < 0;

  const filter: Record<string, unknown> = { _id: productId };
  if (isSale) filter.stock = { $gte: qty };

  const product = await Product.findOneAndUpdate(
    filter,
    isSale
      ? [
          {
            $set: {
              stock: { $subtract: ["$stock", qty] },
              inStock: { $gt: [{ $subtract: ["$stock", qty] }, 0] },
            },
          },
        ]
      : {
          $inc: { stock: qty },
          $set: { inStock: true },
        },
    { new: true, session }
  );

  if (!product) {
    if (isSale) throw new Error("Insufficient stock for one or more items");
    throw new Error("Product not found");
  }

  await InventoryMovement.create(
    [
      {
        productId: product._id,
        slug: product.slug,
        sku: product.sku || "",
        delta,
        stockAfter: product.stock ?? 0,
        reason,
        orderId: orderId || undefined,
        orderNumber: orderNumber || "",
        note,
        actor,
      },
    ],
    { session }
  );

  return product;
}

export async function recordSaleLines(
  lines: { productId: Types.ObjectId | string; qty: number }[],
  orderId?: Types.ObjectId | string,
  orderNumber?: string,
  session?: ClientSession
) {
  const completed: { productId: Types.ObjectId | string; qty: number }[] = [];
  try {
    for (const li of lines) {
      await adjustStock({
        productId: li.productId,
        delta: -li.qty,
        reason: "sale",
        orderId,
        orderNumber: orderNumber || "",
        actor: "checkout",
        session,
      });
      completed.push(li);
    }
  } catch (err) {
    await restoreSaleLines(completed, orderId, orderNumber);
    throw err;
  }
}

/** Restore stock after a failed checkout (reverse sale lines). */
export async function restoreSaleLines(
  lines: { productId: Types.ObjectId | string; qty: number }[],
  orderId?: Types.ObjectId | string,
  orderNumber?: string,
  session?: ClientSession
) {
  for (const li of lines) {
    await adjustStock({
      productId: li.productId,
      delta: li.qty,
      reason: "cancel",
      orderId,
      orderNumber: orderNumber || "",
      note: "Checkout rollback",
      actor: "checkout-rollback",
      session,
    });
  }
}

export async function restoreCancelledOrder(
  lines: { productId?: Types.ObjectId | string | null; qty: number }[],
  orderId: Types.ObjectId | string,
  orderNumber: string,
  session?: ClientSession
) {
  for (const li of lines) {
    if (!li.productId) continue;
    await adjustStock({
      productId: li.productId,
      delta: li.qty,
      reason: "cancel",
      orderId,
      orderNumber,
      actor: "order-cancel",
      session,
    });
  }
}
