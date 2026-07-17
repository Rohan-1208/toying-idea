function cleanEnv(value: string | undefined): string {
  return (value || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\/$/, "");
}

function shopDomain(): string {
  return cleanEnv(process.env.SHOPIFY_STORE_DOMAIN || process.env.VITE_SHOPIFY_STORE_DOMAIN)
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

function staticAdminToken(): string {
  return cleanEnv(
    process.env.SHOPIFY_ADMIN_TOKEN ||
      process.env.shopify_admin_token ||
      process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ||
      process.env.SHOPIFY_ACCESS_TOKEN
  );
}

function clientId(): string {
  return cleanEnv(process.env.SHOPIFY_CLIENT_ID || process.env.SHOPIFY_API_KEY);
}

function clientSecret(): string {
  return cleanEnv(
    process.env.SHOPIFY_CLIENT_SECRET ||
      process.env.SHOPIFY_API_SECRET ||
      process.env.SHOPIFY_APP_SECRET
  );
}

const apiVersion = cleanEnv(process.env.SHOPIFY_API_VERSION) || "2025-01";

/** In-memory cache for client-credentials tokens (valid ~24h). */
let cachedToken: { value: string; expiresAt: number } | null = null;

export function isShopifyAdminConfigured() {
  const domain = shopDomain();
  if (!domain) return false;

  const token = staticAdminToken();
  // shpss_ is a client secret, not an access token — needs client_id too
  if (token && !token.startsWith("shpss_")) return true;

  return Boolean(clientId() && (clientSecret() || token.startsWith("shpss_")));
}

async function fetchClientCredentialsToken(domain: string): Promise<string> {
  const id = clientId();
  const secret = clientSecret() || (staticAdminToken().startsWith("shpss_") ? staticAdminToken() : "");

  if (!id || !secret) {
    throw new Error(
      "Dev Dashboard apps need SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET (shpss_…), not the secret alone as SHOPIFY_ADMIN_TOKEN."
    );
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: id,
      client_secret: secret,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const text = await res.text();
  let json: { access_token?: string; expires_in?: number; error?: string; error_description?: string } =
    {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Shopify token exchange returned non-JSON (${res.status})`);
  }

  if (!res.ok || !json.access_token) {
    const detail = json.error_description || json.error || `HTTP ${res.status}`;
    throw new Error(
      `Shopify token exchange failed (${detail}). Ensure the app is installed on the store with read_orders, and SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET are correct.`
    );
  }

  const expiresInSec = typeof json.expires_in === "number" ? json.expires_in : 86_399;
  cachedToken = {
    value: json.access_token,
    expiresAt: now + expiresInSec * 1000,
  };
  return json.access_token;
}

async function resolveAccessToken(domain: string): Promise<string> {
  const token = staticAdminToken();

  if (token.startsWith("shpss_")) {
    // User pasted client secret into ADMIN_TOKEN — exchange with client_id
    return fetchClientCredentialsToken(domain);
  }

  if (token) {
    if (token.length < 20) {
      throw new Error(
        "SHOPIFY_ADMIN_TOKEN looks invalid. Use shpat_… or set SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET (shpss_…)."
      );
    }
    return token;
  }

  if (clientId() && clientSecret()) {
    return fetchClientCredentialsToken(domain);
  }

  throw new Error(
    "Order tracking is not configured. Set SHOPIFY_STORE_DOMAIN and either SHOPIFY_ADMIN_TOKEN (shpat_…) or SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET on Vercel, then redeploy."
  );
}

export async function shopifyAdminGraphql<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const domain = shopDomain();
  if (!domain) {
    throw new Error("Set SHOPIFY_STORE_DOMAIN on Vercel (e.g. vercel-store-dec63599.myshopify.com).");
  }

  const token = await resolveAccessToken(domain);

  const res = await fetch(`https://${domain}/admin/api/${apiVersion}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20_000),
  });

  const text = await res.text();
  let json: { data?: T; errors?: Array<{ message: string }> } = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Shopify Admin returned non-JSON (${res.status})`);
  }

  if (res.status === 401 || res.status === 403) {
    // Drop cached token so next request re-exchanges
    cachedToken = null;
    throw new Error(
      "Shopify Admin auth failed. Use a shpat_ Admin token, or SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET (shpss_…) with the app installed and read_orders enabled."
    );
  }

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
