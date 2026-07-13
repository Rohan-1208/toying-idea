#!/usr/bin/env node
/** Seed sample product reviews. Usage: node --env-file=.env scripts/seed-reviews.mjs */

import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "toying_idea";

const SAMPLES = [
  {
    slug: "f1-collection",
    reviews: [
      { authorName: "Arjun M.", rating: 5, title: "Desk setup complete", body: "The F1 track map and coasters look incredible on my desk. Print quality is sharp and the matte finish feels premium." },
      { authorName: "Priya K.", rating: 5, title: "Perfect gift for an F1 fan", body: "Bought the whole collection as a birthday gift. Packaging was neat and every piece had clean details." },
      { authorName: "Rahul S.", rating: 4, title: "Worth it", body: "Keyring and sign are fun additions. Took about a week to arrive but quality exceeded expectations." },
    ],
  },
  {
    slug: "flexi-dragon",
    reviews: [
      { authorName: "Neha T.", rating: 5, title: "So satisfying to fidget", body: "The articulation is smooth and the tricolor PLA pops. My kid and I both love it." },
      { authorName: "Vikram D.", rating: 5, title: "Great desk toy", body: "Bought the black version — looks sleek and moves fluidly without squeaking." },
    ],
  },
  {
    slug: "caterpillar",
    reviews: [
      { authorName: "Ananya R.", rating: 5, title: "Cute and wiggly", body: "Perfect size for my nephew. The segments move really well — great print for the price." },
    ],
  },
  {
    slug: "valentines-collection",
    reviews: [
      { authorName: "Isha P.", rating: 5, title: "Lovely set", body: "Gave this to my partner on Valentine's — the full set felt thoughtful and well made." },
    ],
  },
];

if (!uri) {
  console.error("✗ MONGODB_URI is not set");
  process.exit(1);
}

const ReviewSchema = new mongoose.Schema(
  {
    productId: mongoose.Schema.Types.ObjectId,
    slug: String,
    authorName: String,
    rating: Number,
    title: String,
    body: String,
    status: { type: String, default: "approved" },
  },
  { timestamps: true, collection: "reviews" }
);

const ProductSchema = new mongoose.Schema({}, { strict: false, collection: "products" });
const Review = mongoose.models.Review || mongoose.model("Review", ReviewSchema);
const Product = mongoose.models.Product || mongoose.model("Product", ProductSchema);

await mongoose.connect(uri, { dbName });

let created = 0;
for (const group of SAMPLES) {
  const product = await Product.findOne({ slug: group.slug }).lean();
  if (!product) {
    console.log(`Skip ${group.slug} (not found)`);
    continue;
  }

  const existing = await Review.countDocuments({ slug: group.slug });
  if (existing > 0) {
    console.log(`Skip ${group.slug} (${existing} reviews exist)`);
    continue;
  }

  for (const r of group.reviews) {
    await Review.create({ ...r, slug: group.slug, productId: product._id, status: "approved" });
    created++;
  }

  const stats = await Review.aggregate([
    { $match: { slug: group.slug, status: "approved" } },
    { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const average = Math.round((stats[0]?.average || 5) * 10) / 10;
  const count = stats[0]?.count || 0;
  await Product.updateOne({ slug: group.slug }, { $set: { rating: average, reviewCount: count } });
  console.log(`✓ ${group.slug}: ${count} reviews, avg ${average}`);
}

console.log(`\n✓ Seeded ${created} reviews`);
await mongoose.disconnect();
