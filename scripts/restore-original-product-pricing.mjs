#!/usr/bin/env node
/**
 * Restore pricing/variants on original products that the media import overwrote.
 * Does NOT touch media or newly created Instagram products.
 *
 * Usage: node --env-file=.env scripts/restore-original-product-pricing.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const domain = (process.env.SHOPIFY_STORE_DOMAIN || process.env.VITE_SHOPIFY_STORE_DOMAIN || "")
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");
const apiVersion = process.env.SHOPIFY_API_VERSION || "2025-01";

function loadCliToken(storeDomain) {
  const cfgPath = path.join(
    os.homedir(),
    "Library/Preferences/shopify-cli-store-nodejs/config.json"
  );
  if (!fs.existsSync(cfgPath)) return "";
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  for (const [key, val] of Object.entries(cfg)) {
    if (!key.includes(storeDomain)) continue;
    for (const session of Object.values(val?.sessionsByUserId || {})) {
      if (session?.accessToken) return String(session.accessToken);
    }
  }
  return "";
}

const token = process.env.SHOPIFY_ADMIN_TOKEN || loadCliToken(domain);

async function gql(query, variables = {}) {
  const res = await fetch(`https://${domain}/admin/api/${apiVersion}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(JSON.stringify(json.errors, null, 2));
  return json.data;
}

/** Original catalog products overwritten by media import — restore from live site source of truth. */
const RESTORES = [
  {
    handle: "stitch-figure",
    title: "STITCH FIGURE",
    status: "ACTIVE",
    optionName: "Option",
    variants: [{ name: "PLA / Matte / Small", price: "200" }],
  },
  {
    handle: "flexi-dragon",
    title: "FLEXI DRAGON",
    status: "DRAFT", // was draft before import accidentally published it
    optionName: "Color",
    variants: [
      { name: "Tricolor", price: "800" },
      { name: "Black", price: "600" },
      { name: "Blue", price: "600" },
      { name: "Pink", price: "600" },
      { name: "Red", price: "600" },
      { name: "Green", price: "600" },
    ],
  },
  {
    handle: "f1-collection",
    title: "F1 COLLECTION",
    status: "ACTIVE",
    optionName: "Option",
    variants: [
      { name: "Whole Collection", price: "3500" },
      { name: "Map 2026", price: "1500" },
      { name: "Coasters (set of 6)", price: "1000" },
      { name: "Keyring", price: "200" },
      { name: "F1 SIGN", price: "600" },
      { name: "DND SIGN (set of 2)", price: "500" },
    ],
  },
];

async function findByHandle(handle) {
  const data = await gql(
    `query($q:String!){ products(first:1, query:$q){ nodes{ id handle } } }`,
    { q: `handle:${handle}` }
  );
  return data.products.nodes[0] || null;
}

async function main() {
  for (const r of RESTORES) {
    const existing = await findByHandle(r.handle);
    if (!existing) {
      console.log(`missing ${r.handle}`);
      continue;
    }
    const input = {
      id: existing.id,
      title: r.title,
      status: r.status,
      productOptions: [
        {
          name: r.optionName,
          values: r.variants.map((v) => ({ name: v.name })),
        },
      ],
      variants: r.variants.map((v) => ({
        price: v.price,
        optionValues: [{ optionName: r.optionName, name: v.name }],
        inventoryPolicy: "DENY",
      })),
    };
    console.log(`→ restore ${r.handle}`);
    const data = await gql(
      `mutation($input: ProductSetInput!, $synchronous: Boolean!) {
        productSet(synchronous: $synchronous, input: $input) {
          product {
            id handle status title
            variants(first: 20) { nodes { title price } }
          }
          userErrors { field message }
        }
      }`,
      { input, synchronous: true }
    );
    const errs = data.productSet.userErrors;
    if (errs?.length) {
      console.error("  FAIL", errs.map((e) => e.message).join("; "));
      continue;
    }
    const p = data.productSet.product;
    console.log(
      `  OK status=${p.status}`,
      p.variants.nodes.map((v) => `${v.title}=${v.price}`).join(", ")
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
