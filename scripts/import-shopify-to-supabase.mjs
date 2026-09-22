#!/usr/bin/env node
/**
 * Pull the live Shopify catalog and write supabase/import-shopify-catalog.sql
 * so it can be pasted into the Supabase SQL editor.
 *
 *   node scripts/import-shopify-to-supabase.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const STORE = (
  process.env.SHOPIFY_STORE_DOMAIN ||
  process.env.VITE_SHOPIFY_STORE_DOMAIN ||
  "vercel-store-dec63599.myshopify.com"
)
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");

const TYPE_TO_COLLECTION = {
  "home decor": "home-decor",
  "desk decor": "home-decor",
  "desk organizers": "home-decor",
  planters: "home-decor",
  lighting: "home-decor",
  "wall art": "home-decor",
  collectibles: "character-figures",
  toys: "character-figures",
  "flexi toys": "character-figures",
  sculptures: "character-figures",
  props: "character-figures",
  gifts: "character-figures",
  keychains: "keychains-charms",
  accessories: "keychains-charms",
  "pet accessories": "keychains-charms",
  seasonal: "festive-seasonal",
  custom: "custom-personal",
  diy: "custom-personal",
  racing: "home-decor",
  automotive: "home-decor",
  spiritual: "character-figures",
  puzzles: "character-figures",
  fidgets: "character-figures",
};

const COLLECTION_HANDLES = [
  "home-decor",
  "character-figures",
  "keychains-charms",
  "festive-seasonal",
  "custom-personal",
];

function stripHtml(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sqlStr(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function sqlTextArray(items) {
  if (!items?.length) return `'{}'::text[]`;
  return `ARRAY[${items.map(sqlStr).join(", ")}]::text[]`;
}

function money(value) {
  const n = Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} failed (${res.status})`);
  return res.json();
}

async function allProducts() {
  const items = [];
  for (let page = 1; page <= 20; page += 1) {
    const data = await fetchJson(`https://${STORE}/products.json?limit=250&page=${page}`);
    const batch = data.products || [];
    if (!batch.length) break;
    items.push(...batch);
    if (batch.length < 250) break;
  }
  return items;
}

async function collectionHandlesByProduct() {
  const map = new Map();
  for (const handle of COLLECTION_HANDLES) {
    const data = await fetchJson(`https://${STORE}/collections/${handle}/products.json?limit=250`);
    for (const p of data.products || []) {
      if (!map.has(p.handle)) map.set(p.handle, handle);
    }
  }
  return map;
}

function mapProduct(p, collectionByHandle) {
  const variants = p.variants || [];
  const images = (p.images || []).map((img) => img.src).filter(Boolean);
  const primary = variants[0] || {};
  const description = stripHtml(p.body_html);
  const tags = (typeof p.tags === "string" ? p.tags.split(",").map((t) => t.trim()) : p.tags || []).filter(Boolean);
  const type = String(p.product_type || "").trim();
  const collection =
    collectionByHandle.get(p.handle) || TYPE_TO_COLLECTION[type.toLowerCase()] || "character-figures";
  const badges = tags.filter((t) => ["trending", "fun", "premium", "limited", "new", "collector"].includes(t.toLowerCase()));
  const mappedVariants = variants.map((v) => {
    const label = !v.title || v.title === "Default Title" ? "PLA / Standard" : v.title;
    return {
      id: String(v.id),
      label,
      material: "PLA",
      inStock: v.available !== false,
      price: { currency: "INR", amount: money(v.price) },
    };
  });
  const inStock = variants.some((v) => v.available !== false);
  return {
    slug: p.handle,
    name: p.title,
    sku: primary.sku || p.handle.toUpperCase().replace(/-/g, "_"),
    tagline: description.split("\n")[0]?.slice(0, 140) || "",
    description,
    short_description: description.slice(0, 180),
    price: money(primary.price),
    compare_at_price: primary.compare_at_price ? money(primary.compare_at_price) : null,
    currency: "INR",
    category: type || collection,
    categories: [type, collection].filter(Boolean),
    collection_name: collection,
    tags,
    badges: badges.length ? badges : ["Collector"],
    images,
    thumbnail: images[0] || "",
    material: "PLA",
    variants: mappedVariants,
    pricing_mode: mappedVariants.length > 1 ? "variant" : "variant",
    stock: inStock ? 12 : 0,
    in_stock: inStock,
    featured: Boolean(tags.includes("featured")),
    active: true,
  };
}

function rowSql(row) {
  const categories = [...new Set(row.categories.map((c) => String(c).trim()).filter(Boolean))];
  const compare = row.compare_at_price == null ? "NULL" : String(row.compare_at_price);
  return `(
  ${sqlStr(row.slug)},
  ${sqlStr(row.name)},
  ${sqlStr(row.sku)},
  ${sqlStr(row.tagline)},
  ${sqlStr(row.description)},
  ${sqlStr(row.short_description)},
  ${row.price},
  ${compare},
  ${sqlStr(row.currency)},
  ${sqlStr(row.category)},
  ${sqlTextArray(categories)},
  ${sqlStr(row.collection_name)},
  ${sqlTextArray(row.tags)},
  ${sqlTextArray(row.badges)},
  ${sqlTextArray(row.images)},
  ${sqlStr(row.thumbnail)},
  ${sqlStr(row.material)},
  ${sqlStr(JSON.stringify(row.variants))}::jsonb,
  ${sqlStr(row.pricing_mode)},
  ${row.stock},
  ${row.in_stock},
  ${row.featured},
  ${row.active}
)`;
}

const products = await allProducts();
const collectionByHandle = await collectionHandlesByProduct();
const rows = products.map((p) => mapProduct(p, collectionByHandle));

const sql = `-- Shopify catalog import for Toying Idea (${rows.length} products from ${STORE})
-- Paste into Supabase SQL editor and Run.

insert into products (
  slug, name, sku, tagline, description, short_description, price, compare_at_price, currency,
  category, categories, collection_name, tags, badges, images, thumbnail, material, variants,
  pricing_mode, stock, in_stock, featured, active
) values
${rows.map(rowSql).join(",\n")}
on conflict (slug) do update set
  name = excluded.name,
  sku = excluded.sku,
  tagline = excluded.tagline,
  description = excluded.description,
  short_description = excluded.short_description,
  price = excluded.price,
  compare_at_price = excluded.compare_at_price,
  currency = excluded.currency,
  category = excluded.category,
  categories = excluded.categories,
  collection_name = excluded.collection_name,
  tags = excluded.tags,
  badges = excluded.badges,
  images = excluded.images,
  thumbnail = excluded.thumbnail,
  material = excluded.material,
  variants = excluded.variants,
  pricing_mode = excluded.pricing_mode,
  stock = excluded.stock,
  in_stock = excluded.in_stock,
  featured = excluded.featured,
  active = excluded.active,
  updated_at = now();
`;

const out = path.join(root, "supabase", "import-shopify-catalog.sql");
fs.writeFileSync(out, sql);
console.log(`Wrote ${rows.length} products → ${out}`);
const byCol = {};
for (const r of rows) byCol[r.collection_name] = (byCol[r.collection_name] || 0) + 1;
console.log("By collection:", byCol);
