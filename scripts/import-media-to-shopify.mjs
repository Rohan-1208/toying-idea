#!/usr/bin/env node
/**
 * Create Shopify products from data/media-catalog.json and attach local media.
 * Existing products (matching handle) are NEVER updated — create-only.
 *
 * Auth (first available):
 *   SHOPIFY_ADMIN_TOKEN
 *   Shopify CLI store session (shopify store auth)
 *
 * Usage:
 *   node --env-file=.env scripts/import-media-to-shopify.mjs
 *   LIMIT=5 DRY_RUN=1 node --env-file=.env scripts/import-media-to-shopify.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const mediaRoot = fs.existsSync(path.join(root, "Media"))
  ? path.join(root, "Media")
  : path.join(root, "media");
const convertDir = path.join(root, ".media-convert");
const catalogPath =
  process.env.CATALOG_JSON || path.join(root, "data", "media-catalog.json");
const reportPath = path.join(root, "data", "media-import-report.json");

const domain = (process.env.SHOPIFY_STORE_DOMAIN || process.env.VITE_SHOPIFY_STORE_DOMAIN || "")
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");
const apiVersion = process.env.SHOPIFY_API_VERSION || "2025-01";
const dryRun = process.env.DRY_RUN === "1";
const limit = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
const skipVideos = process.env.SKIP_VIDEOS === "1";
const maxImagesPerProduct = Number(process.env.MAX_IMAGES || 5);

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
      const sessions = val?.sessionsByUserId || {};
      for (const session of Object.values(sessions)) {
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
  console.error(
    "Missing Shopify auth.\n" +
      "Set SHOPIFY_STORE_DOMAIN + SHOPIFY_ADMIN_TOKEN in .env,\n" +
      "or run: shopify store auth --store <domain> --scopes write_products,write_files,write_inventory,read_locations"
  );
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

function ensureJpeg(absPath) {
  fs.mkdirSync(convertDir, { recursive: true });
  const ext = path.extname(absPath).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)) return absPath;
  if (ext !== ".heic" && ext !== ".heif") {
    throw new Error(`Unsupported image type: ${ext}`);
  }
  const out = path.join(
    convertDir,
    path.basename(absPath, ext).replace(/[^a-zA-Z0-9_-]/g, "_") + ".jpg"
  );
  if (!fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(absPath).mtimeMs) {
    execFileSync("sips", ["-s", "format", "jpeg", absPath, "--out", out], {
      stdio: ["ignore", "ignore", "pipe"],
    });
  }
  return out;
}

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return (
    {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".mp4": "video/mp4",
      ".mov": "video/quicktime",
      ".webm": "video/webm",
    }[ext] || "application/octet-stream"
  );
}

async function stagedUpload(filePath, resource) {
  const filename = path.basename(filePath);
  const mimeType = mimeFor(filePath);
  const fileSize = String(fs.statSync(filePath).size);
  const data = await adminGraphql(
    `mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
      }
    }`,
    {
      input: [
        {
          filename,
          mimeType,
          httpMethod: "POST",
          resource,
          fileSize,
        },
      ],
    }
  );
  const errs = data.stagedUploadsCreate.userErrors;
  if (errs?.length) throw new Error(errs.map((e) => e.message).join("; "));
  const target = data.stagedUploadsCreate.stagedTargets[0];
  if (!target) throw new Error("No staged upload target");

  const form = new FormData();
  for (const p of target.parameters) form.append(p.name, p.value);
  const buf = fs.readFileSync(filePath);
  form.append("file", new Blob([buf], { type: mimeType }), filename);

  const up = await fetch(target.url, { method: "POST", body: form });
  if (!up.ok) {
    const text = await up.text();
    throw new Error(`Staged upload failed (${up.status}): ${text.slice(0, 300)}`);
  }
  return target.resourceUrl;
}

async function findProductByHandle(handle) {
  const data = await adminGraphql(
    `query ($q: String!) {
      products(first: 1, query: $q) {
        nodes { id handle title status }
      }
    }`,
    { q: `handle:${handle}` }
  );
  return data.products.nodes[0] || null;
}

async function createOrUpdateProduct(product, files) {
  const existing = await findProductByHandle(product.handle);
  // Never overwrite products that already exist in the store.
  if (existing?.id) {
    return { product: existing, updated: false, skippedExisting: true };
  }
  const descriptionHtml = `<p>${product.description}</p><p><em>Print-to-order · Toying Idea</em></p>`;
  const input = {
    title: product.title,
    handle: product.handle,
    descriptionHtml,
    productType: product.productType || "Collectibles",
    vendor: "Toying Idea",
    tags: product.tags || [],
    status: product.status || "DRAFT",
    productOptions: [{ name: "Title", values: [{ name: "Default Title" }] }],
    variants: [
      {
        price: String(product.price ?? 999),
        sku: product.handle,
        inventoryPolicy: "DENY",
        optionValues: [{ optionName: "Title", name: "Default Title" }],
      },
    ],
    files: files.map((f, i) => ({
      originalSource: f.url,
      contentType: f.contentType,
      alt: `${product.title} ${i + 1}`,
    })),
  };

  const data = await adminGraphql(
    `mutation productSet($input: ProductSetInput!, $synchronous: Boolean!) {
      productSet(synchronous: $synchronous, input: $input) {
        product {
          id handle title status
          media(first: 20) { nodes { id mediaContentType status } }
          variants(first: 5) { nodes { id title inventoryItem { id } } }
        }
        userErrors { field message }
      }
    }`,
    { input, synchronous: true }
  );
  const errs = data.productSet.userErrors;
  if (errs?.length) {
    throw new Error(errs.map((e) => `${(e.field || []).join(".")}: ${e.message}`).join("; "));
  }
  return { product: data.productSet.product, updated: false, skippedExisting: false };
}

async function activateInventory(productNode, qty) {
  const loc = await adminGraphql(`{ locations(first: 1) { nodes { id } } }`);
  const locationId = loc.locations.nodes[0]?.id;
  if (!locationId) return;
  for (const v of productNode.variants?.nodes || []) {
    const inventoryItemId = v.inventoryItem?.id;
    if (!inventoryItemId) continue;
    try {
      await adminGraphql(
        `mutation Activate($inventoryItemId: ID!, $locationId: ID!, $available: Int) {
          inventoryActivate(inventoryItemId: $inventoryItemId, locationId: $locationId, available: $available) {
            userErrors { field message }
          }
        }`,
        { inventoryItemId, locationId, available: qty }
      );
    } catch (err) {
      console.warn("  inventory:", err.message.slice(0, 160));
    }
  }
}

async function main() {
  if (!fs.existsSync(catalogPath)) {
    throw new Error(`Catalog not found: ${catalogPath}`);
  }
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  let products = catalog.products || [];
  if (Number.isFinite(limit)) products = products.slice(0, limit);

  console.log(`Store: ${domain}`);
  console.log(`Catalog: ${products.length} products (of ${catalog.productCount})`);
  console.log(`Media root: ${mediaRoot}`);
  if (dryRun) console.log("DRY_RUN=1 — no Shopify writes");

  // Auth check
  const shop = await adminGraphql(`{ shop { name currencyCode } }`);
  console.log(`Auth OK — ${shop.shop.name} (${shop.shop.currencyCode})`);

  const report = {
    created: [],
    updated: [],
    failed: [],
    videosManual: [],
    skippedNoImages: [],
  };

  for (const p of products) {
    console.log(`\n→ ${p.title} (${p.handle})`);

    const existing = await findProductByHandle(p.handle);
    if (existing?.id) {
      console.log(`  SKIP existing ${existing.id}`);
      report.skippedExisting = report.skippedExisting || [];
      report.skippedExisting.push({
        id: existing.id,
        handle: existing.handle,
        title: existing.title,
      });
      continue;
    }

    const imagePaths = (p.images || []).slice(0, maxImagesPerProduct);
    const videoPaths = skipVideos ? [] : p.videos || [];

    if (!imagePaths.length) {
      console.log("  skip — no images");
      report.skippedNoImages.push(p.handle);
      continue;
    }

    if (dryRun) {
      console.log(`  would upload ${imagePaths.length} images, ${videoPaths.length} videos`);
      continue;
    }

    const uploadedFiles = [];
    const failedVideos = [];

    for (const rel of imagePaths) {
      const abs = path.join(mediaRoot, rel);
      if (!fs.existsSync(abs)) {
        console.warn(`  missing image ${rel}`);
        continue;
      }
      try {
        const prepared = ensureJpeg(abs);
        const url = await stagedUpload(prepared, "IMAGE");
        uploadedFiles.push({ url, contentType: "IMAGE", source: rel });
        console.log(`  image ok ${path.basename(prepared)}`);
      } catch (err) {
        console.warn(`  image fail ${rel}: ${String(err.message).slice(0, 180)}`);
      }
    }

    for (const rel of videoPaths) {
      const abs = path.join(mediaRoot, rel);
      if (!fs.existsSync(abs)) {
        failedVideos.push({ path: rel, reason: "missing file" });
        continue;
      }
      try {
        const url = await stagedUpload(abs, "VIDEO");
        uploadedFiles.push({ url, contentType: "VIDEO", source: rel });
        console.log(`  video ok ${path.basename(abs)}`);
      } catch (err) {
        failedVideos.push({ path: rel, reason: String(err.message).slice(0, 200) });
        console.warn(`  video fail (manual attach): ${rel}`);
      }
    }

    if (!uploadedFiles.length) {
      report.failed.push({ handle: p.handle, error: "no media uploaded" });
      continue;
    }

    try {
      const { product, updated, skippedExisting } = await createOrUpdateProduct(p, uploadedFiles);
      if (skippedExisting) {
        console.log(`  SKIP existing ${product.id}`);
        report.skippedExisting = report.skippedExisting || [];
        report.skippedExisting.push({
          id: product.id,
          handle: product.handle,
          title: product.title,
        });
        continue;
      }
      console.log(`  ${updated ? "UPDATED" : "CREATED"} ${product.id}`);
      await activateInventory(product, typeof p.stock === "number" ? p.stock : 25);
      const entry = {
        id: product.id,
        handle: product.handle,
        title: product.title,
        status: product.status,
        mediaCount: product.media?.nodes?.length || uploadedFiles.length,
        imagesUploaded: uploadedFiles.filter((f) => f.contentType === "IMAGE").length,
        videosUploaded: uploadedFiles.filter((f) => f.contentType === "VIDEO").length,
      };
      if (updated) report.updated.push(entry);
      else report.created.push(entry);
      if (failedVideos.length) {
        report.videosManual.push({ handle: p.handle, videos: failedVideos });
      }
    } catch (err) {
      console.error(`  FAIL ${err.message}`);
      report.failed.push({ handle: p.handle, error: err.message });
    }
  }

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport: ${reportPath}`);
  console.log(
    `Created ${report.created.length}, updated ${report.updated.length}, skipped-existing ${
      report.skippedExisting?.length || 0
    }, failed ${report.failed.length}, videos-manual ${report.videosManual.length}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
