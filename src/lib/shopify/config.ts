const domain = (import.meta.env.VITE_SHOPIFY_STORE_DOMAIN as string | undefined)?.trim() || "";
const token = (import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN as string | undefined)?.trim() || "";
const apiVersion = (import.meta.env.VITE_SHOPIFY_API_VERSION as string | undefined)?.trim() || "2025-01";

export const shopifyConfig = {
  domain: domain.replace(/^https?:\/\//, "").replace(/\/$/, ""),
  storefrontToken: token,
  apiVersion,
};

export function isShopifyConfigured(): boolean {
  return Boolean(shopifyConfig.domain && shopifyConfig.storefrontToken);
}

export function shopifyStorefrontEndpoint(): string {
  return `https://${shopifyConfig.domain}/api/${shopifyConfig.apiVersion}/graphql.json`;
}

export function shopifyOrderStatusBase(): string {
  // Buyers land here from Shopify emails; we also deep-link from Track page tips.
  return `https://${shopifyConfig.domain}`;
}
