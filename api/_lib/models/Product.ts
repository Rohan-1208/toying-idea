import mongoose, { Schema, type InferSchemaType } from "mongoose";

const VariantPriceSchema = new Schema(
  {
    currency: { type: String, default: "INR" },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const ProductVariantSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    material: { type: String, default: "" },
    finish: { type: String, default: "" },
    size: { type: String, default: "" },
    inStock: { type: Boolean, default: true },
    price: { type: VariantPriceSchema, required: true },
  },
  { _id: false }
);

/** Shop catalog + inventory counts. */
const ProductSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    sku: { type: String, trim: true, uppercase: true, sparse: true, index: true },
    tagline: { type: String, default: "" },
    description: { type: String, default: "" },
    shortDescription: { type: String, default: "" },

    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, default: null },
    currency: { type: String, default: "INR" },

    category: { type: String, default: "toys", index: true },
    categories: { type: [String], default: [] },
    collectionName: { type: String, default: "", index: true },
    tags: { type: [String], default: [] },
    badges: { type: [String], default: [] },

    images: { type: [String], default: [] },
    thumbnail: { type: String, default: "" },

    material: { type: String, default: "PLA" },
    finishes: { type: [String], default: [] },
    colors: { type: [String], default: [] },
    variants: { type: [ProductVariantSchema], default: [] },
    pricingMode: { type: String, enum: ["bundle", "variant"], default: "variant" },

    stock: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    inStock: { type: Boolean, default: true, index: true },
    featured: { type: Boolean, default: false, index: true },
    featuredRank: { type: Number, default: null },
    rating: { type: Number, default: 5, min: 0, max: 5 },

    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, collection: "products" }
);

ProductSchema.index({ active: 1, category: 1 });
ProductSchema.index({ active: 1, categories: 1 });
ProductSchema.index({ active: 1, collectionName: 1 });
ProductSchema.index({ active: 1, featured: 1, featuredRank: 1 });
ProductSchema.index({ name: "text", description: "text", tagline: "text", tags: "text" });

export type ProductDoc = InferSchemaType<typeof ProductSchema>;

export const Product =
  (mongoose.models.Product as mongoose.Model<ProductDoc>) ||
  mongoose.model<ProductDoc>("Product", ProductSchema);
