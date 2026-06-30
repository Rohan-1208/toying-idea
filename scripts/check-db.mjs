#!/usr/bin/env node
// Check MongoDB connectivity and list collections.
// Usage: node --env-file=.env scripts/check-db.mjs

import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("✗ MONGODB_URI is not set");
  process.exit(1);
}

try {
  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB || undefined,
    serverSelectionTimeoutMS: 10000,
  });
  const db = mongoose.connection.db;
  const cols = await db.listCollections().toArray();
  const counts = {};
  for (const c of cols) {
    counts[c.name] = await db.collection(c.name).countDocuments();
  }
  console.log("✓ Connected to", db.databaseName);
  console.log(JSON.stringify(counts, null, 2));
  await mongoose.disconnect();
} catch (err) {
  console.error("✗", err.message);
  process.exit(1);
}
