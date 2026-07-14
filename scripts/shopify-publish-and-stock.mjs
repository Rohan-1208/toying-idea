#!/usr/bin/env node
/**
 * Publish all products to Headless + Online Store publications, then set inventory.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STORE = process.env.SHOPIFY_STORE_DOMAIN || "vercel-store-dec63599.myshopify.com";
const LOCATION = "gid://shopify/Location/86484549767";
const PUBLICATIONS = [
  "gid://shopify/Publication/200230731911", // Toying Idea Headless
  "gid://shopify/Publication/200111882375", // Vercel Storefronts
  "gid://shopify/Publication/200111784071", // Online Store
];
const QTY = 100;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function exec(query, variables) {
  const args = ["shopify", "store", "execute", "--store", STORE, "--allow-mutations", "--query", query];
  if (variables !== undefined) args.push("--variables", JSON.stringify(variables));
  const res = spawnSync("npx", args, {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      NO_COLOR: "1",
      FORCE_COLOR: "0",
      SHOPIFY_CLI_AGENT_INFO: "n:composer|v:1.0.0|p:cursor",
      SHOPIFY_CLI_AGENT_IDS: "s:shopify-migration|r:publish|i:1",
    },
    maxBuffer: 20 * 1024 * 1024,
  });
  const out = `${res.stdout || ""}\n${res.stderr || ""}`.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
  if (res.status !== 0) throw new Error(out.slice(0, 2000));
  const start = out.lastIndexOf("\n{");
  const jsonText = (start >= 0 ? out.slice(start + 1) : out.slice(out.indexOf("{"))).trim();
  return JSON.parse(jsonText.slice(0, jsonText.lastIndexOf("}") + 1));
}

const LIST = `query {
  products(first: 50) {
    nodes {
      id
      handle
      variants(first: 50) {
        nodes { id title inventoryItem { id tracked } }
      }
    }
  }
}`;

const PUBLISH = `mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
  publishablePublish(id: $id, input: $input) {
    userErrors { field message }
    publishable { ... on Product { id handle } }
  }
}`;

const TRACK = `mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
  inventoryItemUpdate(id: $id, input: $input) {
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
    userErrors { message code }
  }
}`;

function main() {
  const data = exec(LIST);
  const products = data.products.nodes;
  console.log(`Found ${products.length} products`);

  for (const p of products) {
    process.stdout.write(`Publish ${p.handle} ... `);
    try {
      const res = exec(PUBLISH, {
        id: p.id,
        input: PUBLICATIONS.map((publicationId) => ({ publicationId })),
      });
      if (res.publishablePublish?.userErrors?.length) {
        console.log(res.publishablePublish.userErrors.map((e) => e.message).join("; "));
      } else {
        console.log("ok");
      }
    } catch (err) {
      console.log("FAIL", String(err.message).slice(0, 180));
    }
  }

  console.log("\nSetting inventory…");
  for (const p of products) {
    for (const v of p.variants.nodes) {
      const itemId = v.inventoryItem?.id;
      if (!itemId) continue;
      process.stdout.write(`  ${p.handle}/${v.title} ... `);
      try {
        if (!v.inventoryItem.tracked) {
          exec(TRACK, { id: itemId, input: { tracked: true } });
        }
        const act = exec(ACTIVATE, { inventoryItemId: itemId, locationId: LOCATION, available: QTY });
        if (act.inventoryActivate?.userErrors?.length) {
          const set = exec(SET, {
            input: {
              name: "available",
              reason: "correction",
              ignoreCompareQuantity: true,
              quantities: [{ inventoryItemId: itemId, locationId: LOCATION, quantity: QTY }],
            },
          });
          if (set.inventorySetQuantities?.userErrors?.length) {
            console.log(set.inventorySetQuantities.userErrors.map((e) => e.message).join("; "));
          } else console.log("set");
        } else console.log("activated");
      } catch (err) {
        console.log("FAIL", String(err.message).slice(0, 160));
      }
    }
  }
  console.log("Done.");
}

main();
