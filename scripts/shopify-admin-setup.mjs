#!/usr/bin/env node
/**
 * Prints (and optionally applies) Shopify Admin setup checklist for India launch.
 *
 * Env:
 *   SHOPIFY_STORE_DOMAIN
 *   SHOPIFY_ADMIN_TOKEN (optional — enables read checks)
 *
 * Usage:
 *   node --env-file=.env scripts/shopify-admin-setup.mjs
 */
const domain = (process.env.SHOPIFY_STORE_DOMAIN || process.env.VITE_SHOPIFY_STORE_DOMAIN || "")
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");
const token = process.env.SHOPIFY_ADMIN_TOKEN || "";
const apiVersion = process.env.SHOPIFY_API_VERSION || "2025-01";

const checklist = [
  ["Currency", "Settings → Markets / Store details → set currency to INR"],
  ["Location", "Settings → Locations → set India warehouse / ship-from address"],
  ["Shipping", "Settings → Shipping → add India zone; free over ₹1500, else ₹99 (or carrier rates)"],
  ["Payments", "Settings → Payments → enable COD + Razorpay / Shopify Payments if available"],
  ["Checkout", "Settings → Checkout → require phone; customer contact via email"],
  ["Notifications", "Settings → Notifications → enable Order confirmation & Shipping update"],
  ["Brand", "Settings → Brand / Online Store → logo, colors (optional — headless uses your React site)"],
  ["Headless channel", "Sales channels → add Headless / custom app with Storefront API"],
  ["Storefront token", "Custom app → Storefront API → products, collections, cart scopes → copy token"],
  ["Reviews app", "Apps → Shopify Product Reviews or Judge.me"],
  ["Delivery app", "Later: Shiprocket / Delhivery / EasyShip for India couriers"],
];

console.log("\n=== Toying Idea — Shopify Admin setup ===\n");
if (domain) console.log(`Store: ${domain}\n`);
else console.log("Store domain not set yet (SHOPIFY_STORE_DOMAIN).\n");

for (const [title, how] of checklist) {
  console.log(`☐  ${title}`);
  console.log(`   ${how}\n`);
}

if (!token || !domain) {
  console.log("Next: add SHOPIFY_STORE_DOMAIN + SHOPIFY_ADMIN_TOKEN to .env, then re-run for live checks.");
  console.log("Create token: Admin → Settings → Apps and sales channels → Develop apps → Create app.");
  process.exit(0);
}

async function adminGraphql(query) {
  const res = await fetch(`https://${domain}/admin/api/${apiVersion}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (!res.ok || json.errors?.length) throw new Error(JSON.stringify(json.errors || json));
  return json.data;
}

try {
  const data = await adminGraphql(`{
    shop { name currencyCode myshopifyDomain email primaryDomain { url } }
    locations(first: 5) { nodes { name address { country } } }
    productsCount { count }
  }`);
  console.log("── Live shop check ──");
  console.log(`Name:     ${data.shop.name}`);
  console.log(`Domain:   ${data.shop.myshopifyDomain}`);
  console.log(`Currency: ${data.shop.currencyCode}${data.shop.currencyCode === "INR" ? " ✓" : "  ← switch to INR"}`);
  console.log(`Email:    ${data.shop.email}`);
  console.log(`Products: ${data.productsCount.count}`);
  for (const loc of data.locations.nodes) {
    console.log(`Location: ${loc.name} (${loc.address?.country || "—"})`);
  }
  console.log("\nPayments, shipping profiles, and notification templates must be finished in Admin UI.");
} catch (err) {
  console.error("Could not query shop:", err.message);
  process.exit(1);
}
