#!/usr/bin/env node
/**
 * Seed Shopify catalog from live Toying Idea API using Shopify CLI auth.
 * Requires prior: shopify store auth --store vercel-store-dec63599.myshopify.com --scopes write_products,...
 *
 * Usage: node scripts/seed-shopify-via-cli.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STORE = process.env.SHOPIFY_STORE_DOMAIN || "vercel-store-dec63599.myshopify.com";
const IMAGE_BASE = process.env.PUBLIC_SITE_URL || "https://toying-idea.vercel.app";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function shopifyExecute(query, variables) {
  const args = [
    "shopify",
    "store",
    "execute",
    "--store",
    STORE,
    "--allow-mutations",
    "--query",
    query,
  ];
  if (variables !== undefined) {
    args.push("--variables", JSON.stringify(variables));
  }
  const res = spawnSync("npx", args, {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      SHOPIFY_CLI_AGENT_INFO: "n:composer|v:1.0.0|p:cursor",
      SHOPIFY_CLI_AGENT_IDS: "s:shopify-migration|r:seed|i:1",
      NO_COLOR: "1",
      FORCE_COLOR: "0",
    },
    maxBuffer: 20 * 1024 * 1024,
  });
  const out = `${res.stdout || ""}\n${res.stderr || ""}`.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
  if (res.status !== 0) throw new Error(out.slice(0, 2000) || `exit ${res.status}`);

  // Prefer the last top-level JSON object (after the CLI success banner).
  const start = out.lastIndexOf("\n{");
  const jsonText = start >= 0 ? out.slice(start + 1).trim() : out.slice(out.indexOf("{")).trim();
  const end = jsonText.lastIndexOf("}");
  if (end < 0) return { raw: out };
  try {
    return JSON.parse(jsonText.slice(0, end + 1));
  } catch {
    return { raw: out };
  }
}

function absoluteImage(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${IMAGE_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

function money(amount) {
  return String(Math.round(Number(amount) || 0));
}

function normalizeHandle(slug) {
  return String(slug || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildProductInput(p) {
  const isBundle = p.pricingMode === "bundle";
  const handle = normalizeHandle(p.slug);
  const tags = new Set([...(p.tags || []), ...(p.badges || [])]);
  if (p.featured || p.featuredRank) tags.add("featured");
  if (isBundle) tags.add("bundle");
  if (p.collectionName) tags.add(`collection:${p.collectionName}`);
  const category = p.category || p.categories?.[0];
  if (category) tags.add(`category:${category}`);

  const images = [p.thumbnail, ...(p.images || [])]
    .map(absoluteImage)
    .filter(Boolean)
    .filter((u, i, a) => a.indexOf(u) === i)
    .slice(0, 8);

  let descriptionHtml = `<p>${(p.description || p.tagline || p.shortDescription || "").replace(/</g, "&lt;")}</p>`;
  if (isBundle && p.variants?.length) {
    const includes = p.variants
      .map((v) => v.label)
      .filter((l) => l && !/whole collection|full set/i.test(String(l)));
    if (includes.length) {
      descriptionHtml += `<h3>Includes</h3><ul>${includes.map((l) => `<li>${l}</li>`).join("")}</ul>`;
    }
  }

  const useVariantOptions = !isBundle && Array.isArray(p.variants) && p.variants.length > 0;
  const variants = useVariantOptions
    ? p.variants.map((v) => ({
        price: money(v.price?.amount ?? p.price),
        sku: v.id || undefined,
        inventoryPolicy: "DENY",
        optionValues: [{ optionName: "Option", name: String(v.label || "Default").slice(0, 255) }],
      }))
    : [
        {
          price: money(p.price),
          sku: p.sku || handle,
          inventoryPolicy: "DENY",
          optionValues: [{ optionName: "Title", name: "Default Title" }],
        },
      ];

  return {
    title: p.name,
    handle,
    descriptionHtml,
    productType: category || p.collectionName || "Toys",
    vendor: "Toying Idea",
    tags: [...tags],
    status: "ACTIVE",
    files: images.map((originalSource) => ({
      originalSource,
      contentType: "IMAGE",
      alt: p.name,
    })),
    productOptions: useVariantOptions
      ? [
          {
            name: "Option",
            values: p.variants.map((v) => ({ name: String(v.label || "Default").slice(0, 255) })),
          },
        ]
      : [{ name: "Title", values: [{ name: "Default Title" }] }],
    variants,
  };
}

const PRODUCT_SET = `mutation productSet($input: ProductSetInput!, $synchronous: Boolean!) {
  productSet(synchronous: $synchronous, input: $input) {
    product {
      id handle title
      variants(first: 30) { nodes { id title inventoryItem { id } } }
    }
    userErrors { field message }
  }
}`;

const ACTIVATE = `mutation Activate($inventoryItemId: ID!, $locationId: ID!, $available: Int) {
  inventoryActivate(inventoryItemId: $inventoryItemId, locationId: $locationId, available: $available) {
    userErrors { field message }
  }
}`;

const COLLECTION_CREATE = `mutation collectionCreate($input: CollectionInput!) {
  collectionCreate(input: $input) {
    collection { id title handle }
    userErrors { field message }
  }
}`;

async function main() {
  const apiUrl = `${IMAGE_BASE}/api/products?limit=50`;
  console.log(`Fetching ${apiUrl}`);
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`Catalog fetch failed: ${res.status}`);
  const { items } = await res.json();
  console.log(`Loaded ${items.length} products`);

  const loc = shopifyExecute(`query { locations(first: 1) { nodes { id name } } }`);
  const locationId =
    loc.locations?.nodes?.[0]?.id ||
    process.env.SHOPIFY_LOCATION_ID ||
    "gid://shopify/Location/86484549767";
  console.log(`Location ${locationId}`);
  if (loc.raw) console.log("(using fallback location id; CLI JSON parse ambiguous)");

  for (const title of [...new Set(items.map((p) => p.collectionName).filter(Boolean))]) {
    const handle = normalizeHandle(title);
    console.log(`Collection ${title}`);
    try {
      const data = shopifyExecute(COLLECTION_CREATE, { input: { title, handle } });
      const errs = data.collectionCreate?.userErrors;
      if (errs?.length) console.log(" ", errs.map((e) => e.message).join("; "));
      else console.log(" ", data.collectionCreate?.collection?.id || "ok");
    } catch (err) {
      console.warn("  skip:", String(err.message).slice(0, 180));
    }
  }

  for (const p of items) {
    if (p.active === false) continue;
    const input = buildProductInput(p);
    console.log(`\n→ ${input.title} (${input.handle})`);
    let data;
    try {
      data = shopifyExecute(PRODUCT_SET, { input, synchronous: true });
    } catch (err) {
      console.error("  FAIL:", String(err.message).slice(0, 600));
      continue;
    }
    const errs = data.productSet?.userErrors;
    if (errs?.length) {
      console.error("  ERROR:", errs.map((e) => `${(e.field || []).join(".")}: ${e.message}`).join("; "));
      continue;
    }
    const product = data.productSet?.product;
    console.log(`  OK ${product?.id}`);
    const stock = typeof p.stock === "number" ? p.stock : 25;
    for (const v of product?.variants?.nodes || []) {
      if (!v.inventoryItem?.id) continue;
      try {
        const inv = shopifyExecute(ACTIVATE, {
          inventoryItemId: v.inventoryItem.id,
          locationId,
          available: stock,
        });
        if (inv.inventoryActivate?.userErrors?.length) {
          console.warn("  inv:", inv.inventoryActivate.userErrors.map((e) => e.message).join("; "));
        } else {
          console.log(`  stock ${stock} → ${v.title}`);
        }
      } catch (err) {
        console.warn("  inv skip:", String(err.message).slice(0, 160));
      }
    }
  }
  console.log("\nSeed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
