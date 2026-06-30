import mongoose, { Schema, type InferSchemaType } from "mongoose";

export const INVENTORY_REASONS = [
  "restock",
  "sale",
  "cancel",
  "adjustment",
  "return",
] as const;

/** Audit log for product stock changes. */
const InventoryMovementSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    slug: { type: String, required: true, index: true },
    sku: { type: String, default: "" },

    delta: { type: Number, required: true },
    stockAfter: { type: Number, required: true, min: 0 },

    reason: { type: String, enum: INVENTORY_REASONS, required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", index: true },
    orderNumber: { type: String, default: "" },

    note: { type: String, default: "" },
    actor: { type: String, default: "system" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "inventory_movements" }
);

InventoryMovementSchema.index({ createdAt: -1 });

export type InventoryMovementDoc = InferSchemaType<typeof InventoryMovementSchema>;

export const InventoryMovement =
  (mongoose.models.InventoryMovement as mongoose.Model<InventoryMovementDoc>) ||
  mongoose.model<InventoryMovementDoc>("InventoryMovement", InventoryMovementSchema);
