import mongoose, { Schema } from "mongoose";

/** Daily sequence for order numbers — avoids random collisions at scale. */
const CounterSchema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { collection: "counters" }
);

const Counter =
  (mongoose.models.OrderCounter as mongoose.Model<{ _id: string; seq: number }>) ||
  mongoose.model("OrderCounter", CounterSchema);

export async function nextOrderNumber(): Promise<string> {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate()
  ).padStart(2, "0")}`;
  const key = `orders-${ymd}`;

  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  ).lean();

  const seq = doc?.seq ?? 1;
  return `TI-${ymd}-${String(seq).padStart(4, "0")}`;
}
