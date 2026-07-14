#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";

const STORE = process.env.SHOPIFY_STORE_DOMAIN || "vercel-store-dec63599.myshopify.com";
const LOCATION = process.env.SHOPIFY_LOCATION_ID || "gid://shopify/Location/86484549767";
const QTY = Number(process.env.SHOPIFY_DEFAULT_STOCK || 100);

function exec(query, variables = {}) {
  const args = [
    "shopify",
    "store",
    "execute",
    "--store",
    STORE,
    "--allow-mutations",
    "--query",
    query,
    "--variables",
    JSON.stringify(variables),
  ];
  const res = spawnSync("npx", args, {
    encoding: "utf8",
    env: {
      ...process.env,
      NO_COLOR: "1",
      FORCE_COLOR: "0",
      SHOPIFY_CLI_AGENT_INFO: "n:composer|v:1.0.0|p:cursor",
      SHOPIFY_CLI_AGENT_IDS: "s:shopify-migration|r:inv-final|i:1",
    },
    maxBuffer: 20 * 1024 * 1024,
  });
  const out = `${res.stdout || ""}\n${res.stderr || ""}`.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
  if (res.status !== 0) throw new Error(out.slice(0, 900));
  const i = out.lastIndexOf("\n{");
  const j = out.lastIndexOf("}");
  return JSON.parse(out.slice(i + 1, j + 1));
}

const SET = `mutation inventorySetQuantities($input: InventorySetQuantitiesInput!, $idempotencyKey: String!) {
  inventorySetQuantities(input: $input) @idempotent(key: $idempotencyKey) {
    userErrors { message field }
  }
}`;

const list = exec(`query { products(first: 50) { nodes { handle variants(first: 50) { nodes { title inventoryItem { id } } } } } }`);
let ok = 0;
let fail = 0;

for (const p of list.products.nodes) {
  for (const v of p.variants.nodes) {
    const id = v.inventoryItem?.id;
    if (!id) continue;
    process.stdout.write(`${p.handle}/${v.title} `);
    try {
      const r = exec(SET, {
        idempotencyKey: crypto.randomUUID(),
        input: {
          name: "available",
          reason: "correction",
          quantities: [
            {
              inventoryItemId: id,
              locationId: LOCATION,
              quantity: QTY,
              changeFromQuantity: 0,
            },
          ],
        },
      });
      const errs = r.inventorySetQuantities?.userErrors || [];
      if (errs.length) {
        console.log(errs.map((e) => e.message).join(";"));
        fail += 1;
      } else {
        console.log("ok");
        ok += 1;
      }
    } catch (e) {
      console.log("FAIL", String(e.message).replace(/\s+/g, " ").slice(0, 160));
      fail += 1;
    }
  }
}

console.log(JSON.stringify({ ok, fail }));
