#!/usr/bin/env node
/**
 * Helper: print Shopify CLI auth command after you set SHOPIFY_STORE_DOMAIN.
 *
 * Usage:
 *   node --env-file=.env scripts/connect-shopify.mjs
 *   npx shopify store auth --store YOUR.myshopify.com --scopes ...
 */
const domain = (process.env.SHOPIFY_STORE_DOMAIN || process.env.VITE_SHOPIFY_STORE_DOMAIN || "")
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");

const scopes = [
  "read_products,write_products",
  "read_inventory,write_inventory,read_locations,read_files,write_files",
  "read_orders,write_orders,read_fulfillments,write_fulfillments",
  "read_customers,write_customers",
  "read_discounts,write_discounts,read_draft_orders,write_draft_orders",
  "read_themes,write_themes,read_content,write_content,read_online_store_pages",
  "read_reports",
].join(",");

if (!domain) {
  console.log(`
Missing store domain.

1. Paste your store URL here as SHOPIFY_STORE_DOMAIN in .env, e.g.:
     SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
2. Re-run: npm run shopify:connect
3. Or run auth directly:

npx shopify store auth --store your-store.myshopify.com --scopes "${scopes}"
`);
  process.exit(1);
}

const store = domain.includes(".") ? domain : `${domain}.myshopify.com`;
console.log(`
┌──────────────────────────────────────────────┐
│  Ready to connect: ${store.padEnd(24)} │
└──────────────────────────────────────────────┘

Run this command (opens browser for Install):

  npx shopify store auth --store ${store} --scopes "${scopes}"

Then create a custom app Storefront API token and set:

  VITE_SHOPIFY_STORE_DOMAIN=${store}
  VITE_SHOPIFY_STOREFRONT_TOKEN=...
  SHOPIFY_ADMIN_TOKEN=shpat_...   # for import script
`);
