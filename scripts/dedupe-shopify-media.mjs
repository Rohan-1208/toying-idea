#!/usr/bin/env node
/**
 * Remove duplicate images on Shopify products (same file bytes, different media IDs).
 * Keeps the first occurrence; deletes later duplicates.
 *
 * Usage: node --env-file=.env scripts/dedupe-shopify-media.mjs
 *        DRY_RUN=1 node --env-file=.env scripts/dedupe-shopify-media.mjs
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const domain = (process.env.SHOPIFY_STORE_DOMAIN || process.env.VITE_SHOPIFY_STORE_DOMAIN || "")
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");
const apiVersion = process.env.SHOPIFY_API_VERSION || "2025-01";
const dryRun = process.env.DRY_RUN === "1";

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

async function listProducts() {
  const out = [];
  let cursor = null;
  for (;;) {
    const data = await gql(
      `query ($cursor: String) {
        products(first: 50, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            handle
            title
            media(first: 30) {
              nodes {
                id
                mediaContentType
                ... on MediaImage {
                  image { url width height }
                }
              }
            }
          }
        }
      }`,
      { cursor }
    );
    out.push(...data.products.nodes);
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }
  return out;
}

async function hashUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function main() {
  const products = await listProducts();
  console.log(`Scanning ${products.length} products${dryRun ? " (DRY_RUN)" : ""}`);

  let productsTouched = 0;
  let deleted = 0;
  const report = [];

  for (const p of products) {
    const images = p.media.nodes.filter((m) => m.mediaContentType === "IMAGE" && m.image?.url);
    if (images.length < 2) continue;

    const byHash = new Map(); // hash -> first media id
    const toDelete = [];

    for (const m of images) {
      try {
        const hash = await hashUrl(m.image.url);
        if (byHash.has(hash)) {
          toDelete.push({ id: m.id, hash, keep: byHash.get(hash), reason: "duplicate" });
        } else {
          byHash.set(hash, m.id);
        }
      } catch (err) {
        // Broken CDN URLs — remove so they don't show as blank slots
        toDelete.push({ id: m.id, hash: null, keep: null, reason: `broken:${String(err.message).slice(0, 80)}` });
        console.warn(`  broken ${p.handle} ${m.id}: ${String(err.message).slice(0, 120)}`);
      }
    }

    if (!toDelete.length) continue;
    productsTouched++;
    console.log(
      `\n→ ${p.handle}: remove ${toDelete.length} duplicate(s) of ${images.length} images`
    );
    report.push({
      handle: p.handle,
      id: p.id,
      before: images.length,
      remove: toDelete.map((d) => d.id),
    });

    if (dryRun) continue;

    const data = await gql(
      `mutation ($productId: ID!, $mediaIds: [ID!]!) {
        productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
          deletedMediaIds
          userErrors { field message }
        }
      }`,
      { productId: p.id, mediaIds: toDelete.map((d) => d.id) }
    );
    const errs = data.productDeleteMedia.userErrors;
    if (errs?.length) {
      console.error("  FAIL", errs.map((e) => e.message).join("; "));
      continue;
    }
    const n = data.productDeleteMedia.deletedMediaIds?.length || 0;
    deleted += n;
    console.log(`  deleted ${n}`);
  }

  const outPath = path.join(process.cwd(), "data", "media-dedupe-report.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ dryRun, productsTouched, deleted, report }, null, 2));
  console.log(`\nDone. products=${productsTouched} deleted=${deleted}`);
  console.log(`Report: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
