import mongoose, { Schema, type InferSchemaType } from "mongoose";

const OrderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    slug: String,
    sku: String,
    name: { type: String, required: true },
    price: { type: Number, required: true },
    qty: { type: Number, required: true, min: 1 },
    image: String,
    options: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const StatusEventSchema = new Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const TrackingSchema = new Schema(
  {
    carrier: { type: String, default: "" },
    number: { type: String, default: "" },
    url: { type: String, default: "" },
    estimatedDelivery: { type: Date, default: null },
  },
  { _id: false }
);

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "printing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

const OrderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },

    customer: {
      name: { type: String, required: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      phone: { type: String, default: "" },
    },

    shippingAddress: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: "India" },
    },

    items: { type: [OrderItemSchema], default: [] },

    subtotal: { type: Number, required: true },
    shipping: { type: Number, default: 0 },
    total: { type: Number, required: true },
    currency: { type: String, default: "INR" },

    status: { type: String, enum: ORDER_STATUSES, default: "pending" },
    paymentStatus: { type: String, enum: ["unpaid", "paid", "refunded"], default: "unpaid" },
    paymentMethod: { type: String, default: "cod" },

    tracking: { type: TrackingSchema, default: () => ({}) },
    statusHistory: { type: [StatusEventSchema], default: [] },

    notes: { type: String, default: "" },
  },
  { timestamps: true, collection: "orders" }
);

OrderSchema.index({ "customer.email": 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ createdAt: -1 });

export type OrderDoc = InferSchemaType<typeof OrderSchema>;

export const Order =
  (mongoose.models.Order as mongoose.Model<OrderDoc>) ||
  mongoose.model<OrderDoc>("Order", OrderSchema);

export function generateOrderNumber(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate()
  ).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TI-${ymd}-${rand}`;
}
