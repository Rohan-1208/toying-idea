import type { Product, Order, Inquiry, InventoryMovement, Review } from "./types";
import { isShopifyConfigured, shopifyConfig } from "./shopify/config";
import {
  getShopifyProduct,
  listShopifyCollections,
  listShopifyProducts,
} from "./shopify";

const BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") || "/api";

const TOKEN_KEY = "ti_admin_token";

export const auth = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
  isAuthed: () => !!localStorage.getItem(TOKEN_KEY),
};

function requireShopify() {
  if (!isShopifyConfigured()) {
    throw new Error(
      "Shopify is not configured. Set VITE_SHOPIFY_STORE_DOMAIN and VITE_SHOPIFY_STOREFRONT_TOKEN."
    );
  }
}

async function request<T>(
  path: string,
  opts: {
    method?: string;
    body?: unknown;
    admin?: boolean;
    query?: Record<string, string | number | boolean | undefined>;
  } = {}
): Promise<T> {
  const { method = "GET", body, admin, query } = opts;
  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }
  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";
  if (admin) {
    const t = auth.getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  const res = await fetch(url.toString().replace(window.location.origin, ""), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    if (res.status === 401) auth.clear();
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  products: {
    /** Catalog is Shopify-only — no Mongo / sample fallback. */
    async list(query?: Record<string, string | undefined>): Promise<{ items: Product[] }> {
      requireShopify();
      const items = await listShopifyProducts(query);
      return { items };
    },
    async get(slug: string): Promise<{ product: Product | null }> {
      requireShopify();
      const product = await getShopifyProduct(slug);
      return { product };
    },
    adminList: async () => {
      requireShopify();
      const items = await listShopifyProducts();
      return { items };
    },
  },

  orders: {
    /** Deprecated for storefront — checkout goes through Shopify. */
    create: (_body: unknown) =>
      Promise.reject(new Error("Checkout is handled by Shopify. Use Place order instead.")),
    track: (idOrNumber: string, email: string) =>
      request<{ order: Order }>(`/orders/${idOrNumber}`, { query: { email } }),
    trackShopify: (orderNumber: string, email: string) =>
      request<{ order: import("./types").ShopifyTrackedOrder }>("/track", {
        method: "POST",
        body: { orderNumber, email },
      }),
    adminList: (query?: Record<string, string | undefined>) =>
      request<{ items: Order[]; total: number }>("/orders", { query, admin: true }),
    adminGet: (id: string) => request<{ order: Order }>(`/orders/${id}`, { admin: true }),
    adminUpdate: (
      id: string,
      body: {
        status?: string;
        paymentStatus?: string;
        notes?: string;
        statusNote?: string;
        tracking?: { carrier?: string; number?: string; url?: string; estimatedDelivery?: string };
      }
    ) => request<{ order: Order }>(`/orders/${id}`, { method: "PATCH", body, admin: true }),
  },

  inquiries: {
    create: (body: Partial<Inquiry>) => request<{ inquiry: Inquiry }>("/inquiries", { method: "POST", body }),
    adminList: (query?: Record<string, string | undefined>) =>
      request<{ items: Inquiry[] }>("/inquiries", { query, admin: true }),
    adminUpdate: (id: string, status: string, quote?: { amount?: number; note?: string }) =>
      request<{ inquiry: Inquiry }>(`/inquiries/${id}`, {
        method: "PATCH",
        body: quote ? { status, quote: { ...quote, currency: "INR" } } : { status },
        admin: true,
      }),
  },

  authApi: {
    login: (email: string, password: string) =>
      request<{ token: string; admin: { email: string; role: string } }>("/auth/login", {
        method: "POST",
        body: { email, password },
      }),
    me: () => request<{ admin: { email: string; role: string } }>("/auth/me", { admin: true }),
  },

  stats: () =>
    request<{
      totalOrders: number;
      totalProducts: number;
      openInquiries: number;
      lowStock: number;
      revenue: number;
      byStatus: Record<string, number>;
      recentOrders: Order[];
    }>("/admin/stats", { admin: true }),

  inventory: {
    summary: () =>
      request<{
        summary: { totalSkus: number; totalUnits: number; outOfStock: number };
        lowStock: Product[];
        recentMovements: InventoryMovement[];
      }>("/inventory", { admin: true }),
    adjust: (body: { productId?: string; slug?: string; delta?: number; stock?: number; note?: string }) =>
      request<{ product: Product }>("/inventory", { method: "POST", body, admin: true }),
  },

  health: () => request<{ ok: boolean; db: string; dbError?: string }>("/health"),

  collections: async () => {
    requireShopify();
    return listShopifyCollections();
  },

  shopifyAdminUrl: () =>
    shopifyConfig.domain ? `https://${shopifyConfig.domain}/admin/products` : "https://admin.shopify.com",

  reviews: {
    list: (slug: string) =>
      request<{ items: Review[]; summary: { average: number; count: number } }>("/reviews", {
        query: { slug },
      }),
    create: (body: { slug: string; authorName: string; rating: number; title?: string; body: string }) =>
      request<{ review: Review; summary: { average: number; count: number } }>("/reviews", {
        method: "POST",
        body,
      }),
  },
};
