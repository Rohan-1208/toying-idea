#!/usr/bin/env node
// Generate a bcrypt hash for ADMIN_PASSWORD_HASH.
// Usage: node scripts/hash-admin.mjs "your-secure-password"

import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-admin.mjs <password>");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log("\nAdd to .env / Vercel env:\n");
console.log(`ADMIN_PASSWORD_HASH="${hash}"`);
console.log("\nThen remove ADMIN_PASSWORD from production.\n");
