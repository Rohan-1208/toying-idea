#!/usr/bin/env node
/**
 * Replace /api/uploads/{id} URLs in products with Google Drive (or any) image URLs.
 *
 * Usage:
 *   node --env-file=.env scripts/apply-image-urls.mjs [path-to-map.json]
 *
 * Optional flags:
 *   --set-f1-bundle   Set pricingMode=bundle on f1-collection
 *   --dry-run         Print changes without writing
 */

import { readFile } from "node:fs/promises";
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
const dryRun = process.argv.includes("--dry-run");
const setF1Bundle = process.argv.includes("--set-f1-bundle");

if (!uri) {
  console.error("✗ MONGODB_URI is not set");
  process.exit(1);
}

const mapPath = process.argv.find((a) => a.endsWith(".json"));

let urlMap = {};
if (mapPath) {
  let raw;
  try {
    raw = JSON.parse(await readFile(mapPath, "utf8"));
  } catch {
    console.error(`✗ Could not read map file: ${mapPath}`);
    process.exit(1);
  }

  for (const [from, to] of Object.entries(raw)) {
    if (typeof to === "string") {
      urlMap[from] = to;
    } else if (to && typeof to === "object" && to.googleDriveShareUrl && !to.googleDriveShareUrl.includes("PASTE")) {
      urlMap[from] = to.googleDriveShareUrl;
    }
  }

  if (!Object.keys(urlMap).length) {
    console.error("✗ No valid URL mappings found. Paste Google Drive share links into the map file.");
    process.exit(1);
  }
} else if (!setF1Bundle) {
  console.error("✗ Provide an image map JSON file, or use --set-f1-bundle (prefer: npm run set:bundle-pricing).");
  process.exit(1);
}

function toDriveThumbnail(url) {
  const m = url.match(/\/file\/d\/([^/]+)/) || url.match(/[?&]id=([^&]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1600`;
  return url;
}

await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || undefined, serverSelectionTimeoutMS: 15000 });
const products = mongoose.connection.collection("products");

let updated = 0;
if (Object.keys(urlMap).length) {
  const cursor = products.find({
    $or: [
      { images: { $regex: "^/api/uploads/" } },
      { thumbnail: { $regex: "^/api/uploads/" } },
    ],
  });

  while (await cursor.hasNext()) {
    const p = await cursor.next();
    const swap = (url) => (url && urlMap[url] ? toDriveThumbnail(urlMap[url]) : url);

    const newImages = (p.images || []).map(swap);
    const newThumb = swap(p.thumbnail);
    const changed =
      JSON.stringify(newImages) !== JSON.stringify(p.images || []) || newThumb !== p.thumbnail;

    const update = { images: newImages, thumbnail: newThumb };
    if (setF1Bundle && p.slug === "f1-collection") update.pricingMode = "bundle";

    if (changed || update.pricingMode) {
      console.log(`${dryRun ? "[dry-run] " : ""}Update ${p.slug}`);
      if (!dryRun) await products.updateOne({ _id: p._id }, { $set: update });
      updated++;
    }
  }
}

if (setF1Bundle) {
  const f1 = await products.findOne({ slug: "f1-collection" });
  if (f1 && f1.pricingMode !== "bundle") {
    console.log(`${dryRun ? "[dry-run] " : ""}Set f1-collection pricingMode=bundle`);
    if (!dryRun) await products.updateOne({ slug: "f1-collection" }, { $set: { pricingMode: "bundle" } });
    updated++;
  }
}

console.log(`\n✓ ${updated} product(s) ${dryRun ? "would be " : ""}updated`);

await mongoose.disconnect();
