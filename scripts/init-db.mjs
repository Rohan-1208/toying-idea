#!/usr/bin/env node
/**
 * Initialize MongoDB for non-catalog data (inquiries, reviews, legacy orders).
 * Product catalog lives in Shopify — this script does NOT seed products.
 *
 * 1. Set MONGODB_URI + MONGODB_DB in .env
 * 2. Run: npm run init:db
 */

import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "toying_idea";

if (!uri) {
  console.error("\n✗ MONGODB_URI is not set. Add your Atlas connection string to .env\n");
  process.exit(1);
}

const OrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true },
    customer: { name: String, email: String, phone: String },
    shippingAddress: Object,
    items: Array,
    subtotal: Number,
    shipping: Number,
    total: Number,
    currency: String,
    status: String,
    paymentStatus: String,
    paymentMethod: String,
    tracking: Object,
    statusHistory: Array,
    notes: String,
  },
  { timestamps: true, collection: "orders" }
);

const InquirySchema = new mongoose.Schema(
  {
    type: String,
    name: String,
    email: String,
    phone: String,
    message: String,
    pyot: Object,
    gifting: Object,
    contact: Object,
    details: Object,
    quote: Object,
    status: String,
  },
  { timestamps: true, collection: "inquiries" }
);

const ReviewSchema = new mongoose.Schema(
  {
    slug: { type: String, index: true },
    authorName: String,
    rating: Number,
    title: String,
    body: String,
    status: String,
  },
  { timestamps: true, collection: "reviews" }
);

ReviewSchema.index({ slug: 1, status: 1, createdAt: -1 });

const Order = mongoose.models.Order || mongoose.model("Order", OrderSchema);
const Inquiry = mongoose.models.Inquiry || mongoose.model("Inquiry", InquirySchema);
const Review = mongoose.models.Review || mongoose.model("Review", ReviewSchema);

async function main() {
  console.log(`\n→ Connecting to database "${dbName}"…`);
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 15000 });
  console.log("✓ Connected");

  console.log("→ Syncing indexes (orders, inquiries, reviews)…");
  await Promise.all([Order.syncIndexes(), Inquiry.syncIndexes(), Review.syncIndexes()]);
  console.log("✓ Indexes ready");

  const counts = {
    orders: await Order.countDocuments(),
    inquiries: await Inquiry.countDocuments(),
    reviews: await Review.countDocuments(),
  };

  console.log("\n── Database ready ──");
  console.log(JSON.stringify(counts, null, 2));
  console.log("\nNote: Product catalog is Shopify — manage products in Shopify Admin.");
  console.log("Next: npm run dev:full  →  http://localhost:3000/api/health\n");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("\n✗ init failed:", err.message);
  process.exit(1);
});
