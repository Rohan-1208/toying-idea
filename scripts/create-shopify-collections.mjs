#!/usr/bin/env node
/**
 * Create curated Shopify collections and assign related products.
 * Does not modify product prices/titles — only collection membership + publish.
 *
 * Usage: node --env-file=.env scripts/create-shopify-collections.mjs
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

/** Curated sets — handles that exist in the store. */
const COLLECTIONS = [
  {
    title: "Home Decor",
    handle: "home-decor",
    description:
      "Desk pieces, planters, lamps, and coasters — 3D printed décor that feels at home on a shelf.",
    handles: [
      "abstract-vase",
      "forever-tulip",
      "ocean-wave-coasters",
      "snowflake-coaster-set",
      "canvas-photo-frame",
      "warm-glow-lamp",
      "geometric-planters",
      "plantosaurus-planter",
      "desk-organizer",
      "mini-organizer-shelf",
      "mini-jacket-organizer",
      "mini-message-stand",
    ],
  },
  {
    title: "Character Figures",
    handle: "character-figures",
    description:
      "Shelf-ready figures and collectibles — from fan favourites to original desk buddies.",
    handles: [
      "stitch-figure",
      "simpson",
      "angry-baby-chicken",
      "charizard-collectible",
      "pikachu-decor",
      "psyduck-figure",
      "galactic-buddy",
      "coffee-cup-buddy",
      "armored-guardian",
      "anime-stance-figure",
      "black-cat-figurine",
      "rebel-mini-figure",
      "robo-skull-collectible",
      "skeleton-buddies",
      "iron-man-helmet-piggy-bank",
      "military-mini-jeep",
      "minecraft-diamond-sword",
      "harry-potter",
    ],
  },
  {
    title: "Keychains & Charms",
    handle: "keychains-charms",
    description: "Small prints with big personality — clip on, gift, or collect.",
    handles: [
      "bike-keychain",
      "crocodile-keychain",
      "custom-name-keychain",
      "custom-spotify-keychain",
      "fox-keychain",
      "gta-vi-keychain",
      "mini-tumbler-keychain",
      "panda-hoodie-keychain",
      "pikachu-keychain",
      "pokeball-keychain",
      "puffy-letter-keychain",
      "sneaker-keychain",
      "stranger-things-keychain",
      "flexi-love-cat-keyring",
      "skull-hair-stick",
    ],
  },
  {
    title: "Festive & Seasonal",
    handle: "festive-seasonal",
    description: "Holiday sets, party pieces, and seasonal décor for the moments that matter.",
    handles: [
      "christmas-santa-decor",
      "ho-ho-ho-decor-set",
      "holiday-capybara-collection",
      "articulated-sitting-snowman",
      "2026-party-glasses",
      "love-box-surprise",
      "valentines-collection",
      "snowflake-coaster-set",
    ],
  },
  {
    title: "Custom & Personal",
    handle: "custom-personal",
    description: "Made for someone specific — names, photos, playlists, and print-your-own energy.",
    handles: [
      "custom-name-decor",
      "custom-photo-figure",
      "make-it-yours-custom",
      "custom-spotify-keychain",
      "custom-name-keychain",
      "kakashi-art-blank",
      "puffy-letter-keychain",
    ],
  },
];

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

async function allProducts() {
  const out = [];
  let cursor = null;
  for (;;) {
    const data = await gql(
      `query($cursor:String){
        products(first:100, after:$cursor){
          pageInfo{ hasNextPage endCursor }
          nodes{ id handle }
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

async function findCollection(handle) {
  const data = await gql(
    `query($q:String!){
      collections(first:1, query:$q){ nodes{ id handle title } }
    }`,
    { q: `handle:${handle}` }
  );
  return data.collections.nodes[0] || null;
}

async function main() {
  const products = await allProducts();
  const byHandle = Object.fromEntries(products.map((p) => [p.handle, p.id]));

  const pubs = await gql(`{ publications(first:20){ nodes{ id name } } }`);
  const publicationIds = pubs.publications.nodes
    .filter((p) => PUBLICATION_NAMES.has(p.name))
    .map((p) => p.id);

  const report = [];

  for (const c of COLLECTIONS) {
    const productIds = c.handles.map((h) => byHandle[h]).filter(Boolean);
    const missing = c.handles.filter((h) => !byHandle[h]);
    console.log(`\n→ ${c.title} (${productIds.length} products)`);
    if (missing.length) console.log("  missing handles:", missing.join(", "));

    let collection = await findCollection(c.handle);
    if (!collection) {
      const created = await gql(
        `mutation($input: CollectionInput!){
          collectionCreate(input:$input){
            collection{ id handle title }
            userErrors{ field message }
          }
        }`,
        {
          input: {
            title: c.title,
            handle: c.handle,
            descriptionHtml: `<p>${c.description}</p>`,
          },
        }
      );
      if (created.collectionCreate.userErrors?.length) {
        console.error("  create FAIL", created.collectionCreate.userErrors);
        report.push({ handle: c.handle, error: created.collectionCreate.userErrors });
        continue;
      }
      collection = created.collectionCreate.collection;
      console.log("  created", collection.id);
    } else {
      console.log("  exists", collection.id);
      await gql(
        `mutation($input: CollectionInput!){
          collectionUpdate(input:$input){
            collection{ id }
            userErrors{ message }
          }
        }`,
        {
          input: {
            id: collection.id,
            title: c.title,
            descriptionHtml: `<p>${c.description}</p>`,
          },
        }
      );
    }

    if (productIds.length) {
      // Replace membership: remove all then add curated set is heavy;
      // collectionAddProducts is idempotent for already-included products.
      const added = await gql(
        `mutation($id:ID!, $productIds:[ID!]!){
          collectionAddProducts(id:$id, productIds:$productIds){
            userErrors{ message }
            collection{ id productsCount{ count } }
          }
        }`,
        { id: collection.id, productIds }
      );
      if (added.collectionAddProducts.userErrors?.length) {
        console.error("  add FAIL", added.collectionAddProducts.userErrors);
      } else {
        console.log(
          "  productsCount",
          added.collectionAddProducts.collection?.productsCount?.count
        );
      }
    }

    if (publicationIds.length) {
      const pub = await gql(
        `mutation($id:ID!, $input:[PublicationInput!]!){
          publishablePublish(id:$id, input:$input){
            userErrors{ message }
          }
        }`,
        {
          id: collection.id,
          input: publicationIds.map((publicationId) => ({ publicationId })),
        }
      );
      if (pub.publishablePublish.userErrors?.length) {
        console.error("  publish FAIL", pub.publishablePublish.userErrors);
      } else {
        console.log("  published to sales channels");
      }
    }

    report.push({
      handle: c.handle,
      title: c.title,
      id: collection.id,
      productCount: productIds.length,
      missing,
    });
  }

  const out = path.join(process.cwd(), "data", "collections-report.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), report }, null, 2));
  console.log(`\nReport: ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
