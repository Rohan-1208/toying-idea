#!/usr/bin/env node
/**
 * Import catalog into Shopify via Admin GraphQL.
 *
 * Required env:
 *   SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
 *   SHOPIFY_ADMIN_TOKEN=shpat_...
 *
 * Optional source (first available wins):
 *   CATALOG_API_URL=https://toying-idea.vercel.app/api/products
 *   MONGODB_URI=... (legacy)
 *   Or falls back to src/data/products.json
 *
 * Usage:
 *   node --env-file=.env scripts/import-shopify-products.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const domain = (process.env.SHOPIFY_STORE_DOMAIN || process.env.VITE_SHOPIFY_STORE_DOMAIN || "")
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");
const token = process.env.SHOPIFY_ADMIN_TOKEN || "";
const apiVersion = process.env.SHOPIFY_API_VERSION || "2025-01";

if (!domain || !token) {
  console.error(
    "Missing SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN.\n" +
      "Create a custom app in Shopify Admin → Settings → Apps → Develop apps,\n" +
      "enable Admin API scopes: write_products, write_inventory, write_files, read_locations,\n" +
      "install the app, then paste the Admin API access token into .env."
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

async function loadProducts() {
  const apiUrl = process.env.CATALOG_API_URL || "https://toying-idea.vercel.app/api/products";
  try {
    const res = await fetch(apiUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.items?.length) {
        console.log(`Loaded ${data.items.length} products from ${apiUrl}`);
        return data.items;
      }
    }
  } catch (err) {
    console.warn("Catalog API unavailable:", err.message);
  }

  if (process.env.MONGODB_URI) {
    try {
      const mongoose = await import("mongoose");
      await mongoose.default.connect(process.env.MONGODB_URI, {
        dbName: process.env.MONGODB_DB || "toying_idea",
        serverSelectionTimeoutMS: 8000,
      });
      const items = await mongoose.default.connection.db.collection("products").find({}).toArray();
      await mongoose.default.disconnect();
      if (items.length) {
        console.log(`Loaded ${items.length} products from MongoDB`);
        return items;
      }
    } catch (err) {
      console.warn("MongoDB unavailable:", err.message);
    }
  }

  const samplePath = path.join(root, "src/data/products.json");
  const items = JSON.parse(fs.readFileSync(samplePath, "utf8"));
  console.log(`Loaded ${items.length} products from products.json fallback`);
  return items;
}

function money(amount) {
  return String(Math.round(Number(amount) || 0));
}

function productInput(p) {
  const isBundle = p.pricingMode === "bundle";
  const tags = new Set([...(p.tags || []), ...(p.badges || [])]);
  if (p.featured) tags.add("featured");
  if (isBundle) tags.add("bundle");
  if (p.collectionName) tags.add(`collection:${p.collectionName}`);
  if (p.category) tags.add(`category:${p.category}`);

  const variants =
    !isBundle && p.variants?.length
      ? p.variants.map((v) => ({
          price: money(v.price?.amount ?? p.price),
          compareAtPrice: p.compareAtPrice ? money(p.compareAtPrice) : undefined,
          sku: v.id || p.sku || undefined,
          inventoryPolicy: "DENY",
          optionValues: [{ optionName: "Option", name: v.label || "Default" }],
        }))
      : [
          {
            price: money(p.price),
            compareAtPrice: p.compareAtPrice ? money(p.compareAtPrice) : undefined,
            sku: p.sku || p.slug,
            inventoryPolicy: "DENY",
            optionValues: [{ optionName: "Title", name: "Default Title" }],
          },
        ];

  // For bundles with "includes" variants, encode them as description bullets instead of priced options.
  let descriptionHtml = `<p>${p.description || p.shortDescription || ""}</p>`;
  if (isBundle && p.variants?.length) {
    const includes = p.variants
      .map((v) => v.label)
      .filter((l) => l && !/^whole collection$/i.test(String(l)));
    if (includes.length) {
      descriptionHtml += `<h3>Includes</h3><ul>${includes.map((l) => `<li>${l}</li>`).join("")}</ul>`;
    }
  }

  return {
    title: p.name,
    handle: p.slug,
    descriptionHtml,
    productType: p.category || p.collectionName || "Toys",
    vendor: "Toying Idea",
    tags: [...tags],
    status: "ACTIVE",
    productOptions:
      !isBundle && p.variants?.length
        ? [{ name: "Option", values: p.variants.map((v) => ({ name: v.label || "Default" })) }]
        : [{ name: "Title", values: [{ name: "Default Title" }] }],
    variants,
  };
}

const CREATE_PRODUCT = `
  mutation productSet($input: ProductSetInput!, $synchronous: Boolean!) {
    productSet(synchronous: $synchronous, input: $input) {
      product {
        id
        handle
        title
        variants(first: 20) {
          nodes { id title inventoryItem { id } }
        }
      }
      userErrors { field message }
    }
  }
`;

const GET_LOCATION = `
  query {
    locations(first: 1) {
      nodes { id name }
    }
  }
`;

const ACTIVATE_INVENTORY = `
  mutation Activate($inventoryItemId: ID!, $locationId: ID!, $available: Int) {
    inventoryActivate(inventoryItemId: $inventoryItemId, locationId: $locationId, available: $available) {
      inventoryLevel { id }
      userErrors { field message }
    }
  }
`;

const CREATE_COLLECTION = `
  mutation collectionCreate($input: CollectionInput!) {
    collectionCreate(input: $input) {
      collection { id title handle }
      userErrors { field message }
    }
  }
`;

async function ensureCollections(names) {
  for (const title of names) {
    if (!title) continue;
    const handle = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    try {
      const data = await adminGraphql(CREATE_COLLECTION, {
        input: { title, handle },
      });
      const errs = data.collectionCreate.userErrors;
      if (errs?.length) {
        console.log(`Collection "${title}":`, errs.map((e) => e.message).join("; "));
      } else {
        console.log(`Created collection: ${title}`);
      }
    } catch (err) {
      console.warn(`Collection "${title}" skipped:`, err.message);
    }
  }
}

async function main() {
  const products = await loadProducts();
  const locationData = await adminGraphql(GET_LOCATION);
  const locationId = locationData.locations.nodes[0]?.id;
  if (!locationId) throw new Error("No Shopify location found — set one in Admin → Settings → Locations");

  const collections = [...new Set(products.map((p) => p.collectionName).filter(Boolean))];
  await ensureCollections(collections);

  for (const p of products) {
    const input = productInput(p);
    console.log(`\n→ Creating ${input.title} (${input.handle})`);
    const data = await adminGraphql(CREATE_PRODUCT, { input, synchronous: true });
    const errs = data.productSet.userErrors;
    if (errs?.length) {
      console.error("  ERROR:", errs.map((e) => e.message).join("; "));
      continue;
    }
    const product = data.productSet.product;
    console.log(`  OK ${product.id}`);

    const stock = typeof p.stock === "number" ? p.stock : 25;
    for (const v of product.variants.nodes) {
      const itemId = v.inventoryItem?.id;
      if (!itemId) continue;
      try {
        const inv = await adminGraphql(ACTIVATE_INVENTORY, {
          inventoryItemId: itemId,
          locationId,
          available: stock,
        });
        if (inv.inventoryActivate.userErrors?.length) {
          console.warn("  inventory:", inv.inventoryActivate.userErrors.map((e) => e.message).join("; "));
        } else {
          console.log(`  stock ${stock} on ${v.title}`);
        }
      } catch (err) {
        console.warn("  inventory skip:", err.message);
      }
    }
  }

  console.log("\nDone. Assign products to collections in Shopify Admin if needed.");
  console.log("Then create a Storefront API token and set VITE_SHOPIFY_STOREFRONT_TOKEN.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
