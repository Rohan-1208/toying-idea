#!/usr/bin/env node
/**
 * Publish ACTIVE products to Online Store + headless sales channels.
 * (productSet status:ACTIVE does not publish to channels by itself.)
 *
 * Usage: node --env-file=.env scripts/publish-shopify-channels.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const domain = (process.env.SHOPIFY_STORE_DOMAIN || process.env.VITE_SHOPIFY_STORE_DOMAIN || "")
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");
const apiVersion = process.env.SHOPIFY_API_VERSION || "2025-01";

const PUBLICATION_NAMES = new Set([
  "Online Store",
  "Vercel Storefronts",
  "Toying Idea Headless",
]);

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
if (!domain || !token) {
  console.error("Missing Shopify auth");
  process.exit(1);
}

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

async function main() {
  const pubsData = await gql(`{ publications(first: 20) { nodes { id name } } }`);
  const publicationIds = pubsData.publications.nodes
    .filter((p) => PUBLICATION_NAMES.has(p.name))
    .map((p) => p.id);
  console.log(
    "Publishing to:",
    pubsData.publications.nodes.filter((p) => PUBLICATION_NAMES.has(p.name)).map((p) => p.name)
  );

  const products = [];
  let cursor = null;
  for (;;) {
    const data = await gql(
      `query ($cursor: String) {
        products(first: 50, after: $cursor, query: "status:active") {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            handle
            resourcePublications(first: 20) {
              nodes { isPublished publication { id name } }
            }
          }
        }
      }`,
      { cursor }
    );
    products.push(...data.products.nodes);
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }

  let published = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of products) {
    const publishedNames = new Set(
      p.resourcePublications.nodes
        .filter((n) => n.isPublished)
        .map((n) => n.publication.name)
    );
    const missing = [...PUBLICATION_NAMES].filter((n) => !publishedNames.has(n));
    if (!missing.length) {
      skipped++;
      continue;
    }

    const input = publicationIds.map((publicationId) => ({ publicationId }));
    try {
      const data = await gql(
        `mutation ($id: ID!, $input: [PublicationInput!]!) {
          publishablePublish(id: $id, input: $input) {
            userErrors { field message }
          }
        }`,
        { id: p.id, input }
      );
      const errs = data.publishablePublish.userErrors;
      if (errs?.length) {
        console.error(`FAIL ${p.handle}:`, errs.map((e) => e.message).join("; "));
        failed++;
      } else {
        console.log(`OK ${p.handle} → ${missing.join(", ")}`);
        published++;
      }
    } catch (err) {
      console.error(`FAIL ${p.handle}:`, String(err.message).slice(0, 200));
      failed++;
    }
  }

  console.log(`\nDone. published=${published} already-ok=${skipped} failed=${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
