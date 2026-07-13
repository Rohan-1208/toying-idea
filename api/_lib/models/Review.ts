import mongoose, { Schema, type InferSchemaType } from "mongoose";

const ReviewSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", index: true },
    slug: { type: String, required: true, lowercase: true, trim: true, index: true },
    authorName: { type: String, required: true, trim: true, maxlength: 80 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, default: "", trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "approved", index: true },
    verifiedPurchase: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "reviews" }
);

ReviewSchema.index({ slug: 1, status: 1, createdAt: -1 });

export type ReviewDoc = InferSchemaType<typeof ReviewSchema>;

export const Review =
  (mongoose.models.Review as mongoose.Model<ReviewDoc>) ||
  mongoose.model<ReviewDoc>("Review", ReviewSchema);
