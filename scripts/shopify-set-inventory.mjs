#!/usr/bin/env node
/**
 * Activate tracking and set available qty for all variants.
 * Usage: node --env-file=.env scripts/shopify-set-inventory.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STORE = process.env.SHOPIFY_STORE_DOMAIN || "vercel-store-dec63599.myshopify.com";
const LOCATION = process.env.SHOPIFY_LOCATION_ID || "gid://shopify/Location/86484549767";
const QTY = Number(process.env.SHOPIFY_DEFAULT_STOCK || 100);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function exec(query, variables) {
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
  if (variables !== undefined) args.push("--variables", JSON.stringify(variables));
  const res = spawnSync("npx", args, {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      NO_COLOR: "1",
      FORCE_COLOR: "0",
      SHOPIFY_CLI_AGENT_INFO: "n:composer|v:1.0.0|p:cursor",
      SHOPIFY_CLI_AGENT_IDS: "s:shopify-migration|r:inv|i:1",
    },
    maxBuffer: 20 * 1024 * 1024,
  });
  const out = `${res.stdout || ""}\n${res.stderr || ""}`.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
  if (res.status !== 0) throw new Error(out.slice(0, 1500));
  const start = out.lastIndexOf("\n{");
  const jsonText = (start >= 0 ? out.slice(start + 1) : out.slice(out.indexOf("{"))).trim();
  return JSON.parse(jsonText.slice(0, jsonText.lastIndexOf("}") + 1));
}

const LIST = `query {
  products(first: 50) {
    nodes {
      handle
      variants(first: 50) {
        nodes {
          id
          title
          inventoryItem { id tracked }
        }
      }
    }
  }
}`;

const TRACK = `mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
  inventoryItemUpdate(id: $id, input: $input) {
    inventoryItem { id tracked }
    userErrors { message }
  }
}`;

const ACTIVATE = `mutation inventoryActivate($inventoryItemId: ID!, $locationId: ID!, $available: Int) {
  inventoryActivate(inventoryItemId: $inventoryItemId, locationId: $locationId, available: $available) {
    userErrors { message code }
  }
}`;

const SET = `mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
  inventorySetQuantities(input: $input) {
    userErrors { message code field }
  }
}`;

function main() {
  const data = exec(LIST);
  const items = [];
  for (const p of data.products.nodes) {
    for (const v of p.variants.nodes) {
      if (v.inventoryItem?.id) items.push({ handle: p.handle, title: v.title, ...v.inventoryItem });
    }
  }
  console.log(`Updating ${items.length} inventory items → ${QTY} at ${LOCATION}`);

  for (const item of items) {
    process.stdout.write(`${item.handle} / ${item.title} ... `);
    try {
      if (!item.tracked) {
        const t = exec(TRACK, { id: item.id, input: { tracked: true } });
        if (t.inventoryItemUpdate?.userErrors?.length) {
          console.log("track err", t.inventoryItemUpdate.userErrors.map((e) => e.message).join("; "));
          continue;
        }
      }
      const act = exec(ACTIVATE, {
        inventoryItemId: item.id,
        locationId: LOCATION,
        available: QTY,
      });
      if (act.inventoryActivate?.userErrors?.length) {
        const set = exec(SET, {
          input: {
            name: "available",
            reason: "correction",
            ignoreCompareQuantity: true,
            quantities: [
              {
                inventoryItemId: item.id,
                locationId: LOCATION,
                quantity: QTY,
              },
            ],
          },
        });
        if (set.inventorySetQuantities?.userErrors?.length) {
          console.log("set err", set.inventorySetQuantities.userErrors.map((e) => e.message).join("; "));
        } else {
          console.log("set ok");
        }
      } else {
        console.log("activated");
      }
    } catch (err) {
      console.log("FAIL", String(err.message).slice(0, 200));
    }
  }
  console.log("Done.");
}

main();
