const domain = (process.env.SHOPIFY_STORE_DOMAIN || process.env.VITE_SHOPIFY_STORE_DOMAIN || "")
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");
const token = process.env.SHOPIFY_ADMIN_TOKEN || "";
const apiVersion = process.env.SHOPIFY_API_VERSION || "2025-01";

export function isShopifyAdminConfigured() {
  return Boolean(domain && token);
}

export async function shopifyAdminGraphql<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  if (!isShopifyAdminConfigured()) {
    throw new Error("Shopify Admin is not configured (SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_TOKEN)");
  }

  const res = await fetch(`https://${domain}/admin/api/${apiVersion}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20_000),
  });

  const json = (await res.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };

  if (!res.ok) {
    throw new Error(`Shopify Admin request failed (${res.status})`);
  }
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  if (!json.data) {
    throw new Error("Empty response from Shopify Admin API");
  }
  return json.data;
}
