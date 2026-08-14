#!/usr/bin/env node
/**
 * Post-import cleanup: restore ACTIVE on overwritten products, delete draft duplicates,
 * append media onto existing Hogwarts / Bart products.
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

const domain = (process.env.SHOPIFY_STORE_DOMAIN || process.env.VITE_SHOPIFY_STORE_DOMAIN || "")
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");
const apiVersion = process.env.SHOPIFY_API_VERSION || "2025-01";

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

function ensureJpeg(absPath) {
  fs.mkdirSync(convertDir, { recursive: true });
  const ext = path.extname(absPath).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)) return absPath;
  const out = path.join(
    convertDir,
    path.basename(absPath, ext).replace(/[^a-zA-Z0-9_-]/g, "_") + ".jpg"
  );
  if (!fs.existsSync(out)) {
    execFileSync("sips", ["-s", "format", "jpeg", absPath, "--out", out], {
      stdio: ["ignore", "ignore", "pipe"],
    });
  }
  return out;
}

async function stagedUpload(filePath) {
  const filename = path.basename(filePath);
  const mimeType = "image/jpeg";
  const fileSize = String(fs.statSync(filePath).size);
  const data = await gql(
    `mutation($input:[StagedUploadInput!]!){
      stagedUploadsCreate(input:$input){
        stagedTargets{ url resourceUrl parameters{ name value } }
        userErrors{ message }
      }
    }`,
    {
      input: [
        { filename, mimeType, httpMethod: "POST", resource: "IMAGE", fileSize },
      ],
    }
  );
  if (data.stagedUploadsCreate.userErrors?.length) {
    throw new Error(data.stagedUploadsCreate.userErrors.map((e) => e.message).join("; "));
  }
  const target = data.stagedUploadsCreate.stagedTargets[0];
  const form = new FormData();
  for (const p of target.parameters) form.append(p.name, p.value);
  form.append("file", new Blob([fs.readFileSync(filePath)], { type: mimeType }), filename);
  const up = await fetch(target.url, { method: "POST", body: form });
  if (!up.ok) throw new Error(`upload failed ${up.status}`);
  return target.resourceUrl;
}

async function main() {
  for (const handle of ["flexi-dragon", "stitch-figure", "f1-collection"]) {
    const found = await gql(
      `query($q:String!){ products(first:1, query:$q){ nodes{ id handle status } } }`,
      { q: `handle:${handle}` }
    );
    const p = found.products.nodes[0];
    if (!p) continue;
    const data = await gql(
      `mutation($input: ProductInput!){
        productUpdate(input:$input){ product{ id handle status } userErrors{ message } }
      }`,
      { input: { id: p.id, status: "ACTIVE" } }
    );
    console.log("restore ACTIVE", data.productUpdate.product, data.productUpdate.userErrors);
  }

  for (const id of [
    "gid://shopify/Product/8732939878535",
    "gid://shopify/Product/8732937355399",
  ]) {
    const data = await gql(
      `mutation($id:ID!){ productDelete(input:{id:$id}){ deletedProductId userErrors{ message } } }`,
      { id }
    );
    console.log("deleted", data.productDelete);
  }

  const catalog = JSON.parse(
    fs.readFileSync(path.join(root, "data/media-catalog.json"), "utf8")
  );
  const byHandle = Object.fromEntries(catalog.products.map((p) => [p.handle, p]));

  async function append(targetHandle, sourceHandles) {
    const found = await gql(
      `query($q:String!){ products(first:1, query:$q){ nodes{ id title } } }`,
      { q: `handle:${targetHandle}` }
    );
    const product = found.products.nodes[0];
    if (!product) return;
    const images = [
      ...new Set(sourceHandles.flatMap((h) => byHandle[h]?.images || [])),
    ].slice(0, 5);
    const media = [];
    for (const rel of images) {
      const abs = path.join(mediaRoot, rel);
      if (!fs.existsSync(abs)) continue;
      const prepared = ensureJpeg(abs);
      media.push({
        originalSource: await stagedUpload(prepared),
        alt: product.title,
        mediaContentType: "IMAGE",
      });
      console.log("  staged", path.basename(prepared));
    }
    if (!media.length) return;
    const data = await gql(
      `mutation($productId:ID!, $media:[CreateMediaInput!]!){
        productCreateMedia(productId:$productId, media:$media){
          media{ id } userErrors{ message }
        }
      }`,
      { productId: product.id, media }
    );
    console.log(
      "append",
      targetHandle,
      data.productCreateMedia.userErrors,
      data.productCreateMedia.media?.length
    );
  }

  await append("harry-potter", ["hogwarts-castle", "harry-potter"]);
  await append("simpson", ["bart-simpson", "simpson"]);
  console.log("cleanup done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
