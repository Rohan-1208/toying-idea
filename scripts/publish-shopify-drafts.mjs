#!/usr/bin/env node
/**
 * Publish all DRAFT Shopify products to ACTIVE (pricing left for Admin).
 * Auth: SHOPIFY_ADMIN_TOKEN or Shopify CLI store session.
 *
 * Usage: node --env-file=.env scripts/publish-shopify-drafts.mjs
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
  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    for (const [key, val] of Object.entries(cfg)) {
      if (!key.includes(storeDomain)) continue;
      for (const session of Object.values(val?.sessionsByUserId || {})) {
        if (session?.accessToken) return String(session.accessToken);
      }
    }
  } catch {
    return "";
  }
  return "";
}

const token = process.env.SHOPIFY_ADMIN_TOKEN || loadCliToken(domain);
if (!domain || !token) {
  console.error("Missing Shopify auth");
  process.exit(1);
}

async function adminGraphql(query, variables = {}) {
  const res = await fetch(`https://${domain}/admin/api/${apiVersion}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors?.length) {
    throw new Error(JSON.stringify(json.errors || json, null, 2));
  }
  return json.data;
}

async function main() {
  const drafts = [];
  let cursor = null;
  for (;;) {
    const data = await adminGraphql(
      `query ($cursor: String) {
        products(first: 50, after: $cursor, query: "status:draft") {
          pageInfo { hasNextPage endCursor }
          nodes { id handle title }
        }
      }`,
      { cursor }
    );
    drafts.push(...data.products.nodes);
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }

  console.log(`Publishing ${drafts.length} drafts → ACTIVE`);
  let ok = 0;
  let fail = 0;
  for (const p of drafts) {
    try {
      const data = await adminGraphql(
        `mutation ($productId: ID!, $status: ProductStatus!) {
          productChangeStatus(productId: $productId, status: $status) {
            product { id handle status }
            userErrors { field message }
          }
        }`,
        { productId: p.id, status: "ACTIVE" }
      );
      const errs = data.productChangeStatus.userErrors;
      if (errs?.length) {
        console.error(`FAIL ${p.handle}:`, errs.map((e) => e.message).join("; "));
        fail++;
      } else {
        console.log(`OK ${p.handle}`);
        ok++;
      }
    } catch (err) {
      console.error(`FAIL ${p.handle}:`, String(err.message).slice(0, 200));
      fail++;
    }
  }
  console.log(`\nDone. published=${ok} failed=${fail}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
