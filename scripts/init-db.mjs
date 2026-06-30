#!/usr/bin/env node
/**
 * Initialize a NEW Toying Idea MongoDB database (greenfield — not the old site DB).
 *
 * 1. Create Atlas cluster → Database user → Network access (your IP)
 * 2. Set MONGODB_URI + MONGODB_DB in .env
 * 3. Run: npm run init:db
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "toying_idea";

if (!uri) {
  console.error("\n✗ MONGODB_URI is not set. Add your new Atlas connection string to .env\n");
  process.exit(1);
}

// --- Schemas (mirror api/_lib/models) ---
const ProductSchema = new mongoose.Schema(
  {
    name: String,
    slug: { type: String, unique: true },
    sku: { type: String, sparse: true },
    description: String,
    shortDescription: String,
    price: Number,
    compareAtPrice: Number,
    currency: { type: String, default: "INR" },
    category: String,
    collectionName: String,
    tags: [String],
    badges: [String],
    images: [String],
    thumbnail: String,
    material: String,
    finishes: [String],
    colors: [String],
    stock: { type: Number, default: 0 },
    lowStockThreshold: { type: Number, default: 5 },
    inStock: { type: Boolean, default: true },
    featured: Boolean,
    rating: Number,
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "products" }
);

const InventoryMovementSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    slug: String,
    sku: String,
    delta: Number,
    stockAfter: Number,
    reason: String,
    orderId: mongoose.Schema.Types.ObjectId,
    orderNumber: String,
    note: String,
    actor: String,
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "inventory_movements" }
);

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

const Product = mongoose.models.Product || mongoose.model("Product", ProductSchema);
const InventoryMovement =
  mongoose.models.InventoryMovement || mongoose.model("InventoryMovement", InventoryMovementSchema);
const Order = mongoose.models.Order || mongoose.model("Order", OrderSchema);
const Inquiry = mongoose.models.Inquiry || mongoose.model("Inquiry", InquirySchema);

async function ensureIndexes() {
  await Promise.all([
    Product.syncIndexes(),
    InventoryMovement.syncIndexes(),
    Order.syncIndexes(),
    Inquiry.syncIndexes(),
  ]);
}

function skuFromSlug(slug) {
  return String(slug).toUpperCase().replace(/-/g, "_");
}

async function seedProducts() {
  const raw = await readFile(path.join(__dirname, "../src/data/products.json"), "utf-8");
  const products = JSON.parse(raw);

  let created = 0;
  let updated = 0;
  for (const p of products) {
    const stock = p.stock ?? 50;
    const doc = {
      ...p,
      sku: skuFromSlug(p.slug),
      stock,
      lowStockThreshold: Math.max(3, Math.floor(stock * 0.1)),
      inStock: stock > 0,
      active: true,
      images: p.images || [],
      thumbnail: p.thumbnail || "",
    };
    const res = await Product.updateOne({ slug: p.slug }, { $set: doc }, { upsert: true });
    if (res.upsertedCount) created++;
    else updated++;
  }
  return { created, updated, total: products.length };
}

async function main() {
  console.log(`\n→ Connecting to NEW database "${dbName}"…`);
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 15000 });
  console.log("✓ Connected");

  console.log("→ Syncing indexes…");
  await ensureIndexes();
  console.log("✓ Indexes ready");

  console.log("→ Seeding products catalog…");
  const seed = await seedProducts();
  console.log(`✓ Products: ${seed.created} created, ${seed.updated} updated (${seed.total} total)`);

  const counts = {
    products: await Product.countDocuments(),
    orders: await Order.countDocuments(),
    inquiries: await Inquiry.countDocuments(),
    inventory_movements: await InventoryMovement.countDocuments(),
  };

  console.log("\n── Database ready ──");
  console.log(JSON.stringify(counts, null, 2));
  console.log("\nCollections:");
  console.log("  products            — shop catalog + stock");
  console.log("  inventory_movements — stock audit log");
  console.log("  orders              — checkout + tracking");
  console.log("  inquiries           — PYOT, gifting, contact");
  console.log("\nNext: npm run dev:full  →  http://localhost:3000/api/health\n");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("\n✗ init failed:", err.message);
  process.exit(1);
});
