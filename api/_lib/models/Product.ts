import mongoose, { Schema, type InferSchemaType } from "mongoose";

/** Shop catalog + inventory counts (greenfield TOYING IDEA database). */
const ProductSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    sku: { type: String, trim: true, uppercase: true, sparse: true, index: true },
    description: { type: String, default: "" },
    shortDescription: { type: String, default: "" },

    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, default: null },
    currency: { type: String, default: "INR" },

    category: { type: String, default: "toys", index: true },
    collectionName: { type: String, default: "", index: true },
    tags: { type: [String], default: [] },
    badges: { type: [String], default: [] },

    images: { type: [String], default: [] },
    thumbnail: { type: String, default: "" },

    material: { type: String, default: "PLA" },
    finishes: { type: [String], default: [] },
    colors: { type: [String], default: [] },

    stock: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    inStock: { type: Boolean, default: true, index: true },
    featured: { type: Boolean, default: false, index: true },
    rating: { type: Number, default: 5, min: 0, max: 5 },

    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, collection: "products" }
);

ProductSchema.index({ active: 1, category: 1 });
ProductSchema.index({ active: 1, collectionName: 1 });
ProductSchema.index({ name: "text", description: "text", tags: "text" });

export type ProductDoc = InferSchemaType<typeof ProductSchema>;

export const Product =
  (mongoose.models.Product as mongoose.Model<ProductDoc>) ||
  mongoose.model<ProductDoc>("Product", ProductSchema);
