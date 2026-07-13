#!/usr/bin/env node
/**
 * Export GridFS images from MongoDB to local files for upload to Google Drive.
 *
 * Usage:
 *   node --env-file=.env scripts/export-gridfs-images.mjs
 *
 * Steps after export:
 *   1. Upload files in ./image-export/ to a Google Drive folder (share: anyone with link)
 *   2. Copy each file's share link into image-url-map.json (see template below)
 *   3. Run: node --env-file=.env scripts/apply-image-urls.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { GridFSBucket, ObjectId } from "mongodb";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "image-export");
const MAP_FILE = path.join(OUT_DIR, "image-url-map.template.json");

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("✗ MONGODB_URI is not set");
  process.exit(1);
}

await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || undefined });
const db = mongoose.connection.db;
const bucket = new GridFSBucket(db, { bucketName: "fs" });

await mkdir(OUT_DIR, { recursive: true });

const files = await db.collection("fs.files").find({}).toArray();
const mapping = {};

console.log(`Found ${files.length} GridFS files`);

for (const file of files) {
  const id = String(file._id);
  const filename = file.filename || `${id}.jpg`;
  const outPath = path.join(OUT_DIR, `${id}-${filename}`);
  const downloadStream = bucket.openDownloadStream(new ObjectId(id));
  const writeStream = createWriteStream(outPath);
  await pipeline(downloadStream, writeStream);

  mapping[`/api/uploads/${id}`] = {
    localFile: path.basename(outPath),
    googleDriveShareUrl: "PASTE_GOOGLE_DRIVE_SHARE_LINK_HERE",
    note: "After uploading to Drive, paste the share link above and run apply-image-urls.mjs",
  };
  console.log(`  ✓ ${filename} → ${path.basename(outPath)}`);
}

await writeFile(MAP_FILE, JSON.stringify(mapping, null, 2));

const gridfsStats = await db.collection("fs.files").aggregate([
  { $group: { _id: null, count: { $sum: 1 }, bytes: { $sum: "$length" } } },
]).toArray();

console.log("\n--- DB impact ---");
console.log(`GridFS files: ${gridfsStats[0]?.count || 0}`);
console.log(`GridFS size:  ${((gridfsStats[0]?.bytes || 0) / 1024 / 1024).toFixed(1)} MB`);
console.log("\nMoving images to Google Drive will remove this from MongoDB.");
console.log(`\nNext: edit ${MAP_FILE} with Drive links, then run apply-image-urls.mjs`);

await mongoose.disconnect();
