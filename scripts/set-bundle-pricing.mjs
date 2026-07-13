#!/usr/bin/env node
/**
 * Audit and set bundle pricing on collection products.
 *
 * Usage:
 *   node --env-file=.env scripts/set-bundle-pricing.mjs [--dry-run]
 *
 * Bundle = one price for the whole collection; variant labels become "includes" list.
 */

import mongoose from "mongoose";

const dryRun = process.argv.includes("--dry-run");
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "toying_idea";

if (!uri) {
  console.error("✗ MONGODB_URI is not set");
  process.exit(1);
}

/** Slugs that should use bundle pricing */
const BUNDLE_SLUGS = new Set(["f1-collection", "valentines-collection"]);

function shouldBeBundle(p) {
  if (BUNDLE_SLUGS.has(p.slug)) return true;
  if (/collection$/i.test(p.slug) && (p.variants || []).length > 1) return true;
  return false;
}

await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 15000 });
const products = mongoose.connection.collection("products");

const all = await products.find({}).toArray();
const collections = [...new Set(all.map((p) => p.collectionName).filter(Boolean))].sort();

console.log(`\nDatabase: ${dbName}`);
console.log(`Products: ${all.length}`);
console.log(`Collections: ${collections.join(", ") || "(none)"}\n`);

console.log("=== AUDIT ===\n");
for (const p of all) {
  const bundle = shouldBeBundle(p);
  const mode = p.pricingMode || "variant";
  const status = bundle ? (mode === "bundle" ? "✓ bundle" : "→ needs bundle") : mode === "bundle" ? "⚠ wrongly bundle" : "✓ variant";
  const variantSummary = (p.variants || []).map((v) => `${v.label} (₹${v.price?.amount ?? "?"})`).join("; ");
  console.log(`${status.padEnd(16)} | ${p.slug}`);
  console.log(`                 | ${p.name} · ₹${p.price} · collection: ${p.collectionName || "—"}`);
  if (variantSummary) console.log(`                 | variants: ${variantSummary}`);
  console.log("");
}

const toBundle = all.filter((p) => shouldBeBundle(p) && p.pricingMode !== "bundle");
const toVariant = all.filter((p) => !shouldBeBundle(p) && p.pricingMode === "bundle");

console.log("=== UPDATES ===\n");

for (const p of toBundle) {
  console.log(`${dryRun ? "[dry-run] " : ""}Set bundle: ${p.slug} (${p.name})`);
  if (!dryRun) await products.updateOne({ _id: p._id }, { $set: { pricingMode: "bundle" } });
}

for (const p of toVariant) {
  console.log(`${dryRun ? "[dry-run] " : ""}Set variant: ${p.slug} (${p.name})`);
  if (!dryRun) await products.updateOne({ _id: p._id }, { $set: { pricingMode: "variant" } });
}

if (!toBundle.length && !toVariant.length) {
  console.log("No pricing mode changes needed.");
} else {
  console.log(`\n✓ ${toBundle.length + toVariant.length} product(s) ${dryRun ? "would be " : ""}updated`);
}

await mongoose.disconnect();
