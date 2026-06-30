import type { Types } from "mongoose";
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
}) {
  const { productId, delta, reason, orderId, orderNumber, note = "", actor = "system" } = opts;

  const product = await Product.findById(productId);
  if (!product) throw new Error("Product not found");

  const nextStock = Math.max(0, (product.stock ?? 0) + delta);
  product.stock = nextStock;
  product.inStock = nextStock > 0;
  await product.save();

  await InventoryMovement.create({
    productId: product._id,
    slug: product.slug,
    sku: product.sku || "",
    delta,
    stockAfter: nextStock,
    reason,
    orderId: orderId || undefined,
    orderNumber: orderNumber || "",
    note,
    actor,
  });

  return product;
}

export async function recordSaleLines(
  lines: { productId: Types.ObjectId | string; qty: number }[],
  orderId: Types.ObjectId | string,
  orderNumber: string
) {
  await Promise.all(
    lines.map((li) =>
      adjustStock({
        productId: li.productId,
        delta: -li.qty,
        reason: "sale",
        orderId,
        orderNumber,
        actor: "checkout",
      })
    )
  );
}

export async function restoreCancelledOrder(
  lines: { productId?: Types.ObjectId | string | null; qty: number }[],
  orderId: Types.ObjectId | string,
  orderNumber: string
) {
  await Promise.all(
    lines
      .filter((li) => li.productId)
      .map((li) =>
        adjustStock({
          productId: li.productId!,
          delta: li.qty,
          reason: "cancel",
          orderId,
          orderNumber,
          actor: "order-cancel",
        })
      )
  );
}
