import type { Product, Order, Inquiry, InventoryMovement, Review } from "./types";
import catalog from "../data/products.json";
import { isShopifyConfigured } from "./shopify/config";
import {
  getShopifyProduct,
  listShopifyCollections,
  listShopifyProducts,
} from "./shopify";

const fallbackCatalog = catalog as Product[];

const BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") || "/api";

const TOKEN_KEY = "ti_admin_token";

export const auth = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
  isAuthed: () => !!localStorage.getItem(TOKEN_KEY),
};

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
    signal: AbortSignal.timeout(45_000),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    if (res.status === 401) auth.clear();
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

function filterSample(query?: Record<string, string | undefined>): Product[] {
  let items = [...fallbackCatalog];
  if (!query) return items;
  if (query.category) items = items.filter((p) => p.category === query.category);
  if (query.collection) items = items.filter((p) => p.collectionName === query.collection);
  if (query.tag) items = items.filter((p) => p.tags?.includes(query.tag!));
  if (query.badge) items = items.filter((p) => p.badges?.includes(query.badge!));
  if (query.featured) items = items.filter((p) => p.featured);
  if (query.q) {
    const q = query.q.toLowerCase();
    items = items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }
  return items;
}

export const api = {
  products: {
    async list(query?: Record<string, string | undefined>): Promise<{ items: Product[]; usingSample: boolean }> {
      if (isShopifyConfigured()) {
        try {
          const items = await listShopifyProducts(query);
          if (items.length) return { items, usingSample: false };
        } catch (err) {
          console.error("Shopify product list failed:", err);
        }
      }
      try {
        const data = await request<{ items: Product[] }>("/products", { query });
        if (!data.items?.length) return { items: filterSample(query), usingSample: true };
        return { items: data.items, usingSample: false };
      } catch {
        return { items: filterSample(query), usingSample: true };
      }
    },
    async get(slug: string): Promise<{ product: Product | null; usingSample: boolean }> {
      if (isShopifyConfigured()) {
        try {
          const product = await getShopifyProduct(slug);
          if (product) return { product, usingSample: false };
        } catch (err) {
          console.error("Shopify product get failed:", err);
        }
      }
      try {
        const data = await request<{ product: Product }>(`/products/${slug}`);
        return { product: data.product, usingSample: false };
      } catch {
        const product = fallbackCatalog.find((p) => p.slug === slug) || null;
        return { product, usingSample: true };
      }
    },
    create: (body: Partial<Product>) =>
      request<{ product: Product }>("/products", { method: "POST", body, admin: true }),
    update: (id: string, body: Partial<Product>) =>
      request<{ product: Product }>(`/products/${id}`, { method: "PUT", body, admin: true }),
    remove: (id: string) => request<{ ok: boolean }>(`/products/${id}`, { method: "DELETE", admin: true }),
    adminList: () => request<{ items: Product[] }>("/products", { query: { all: "1", limit: 200 } }),
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
    if (isShopifyConfigured()) {
      try {
        return await listShopifyCollections();
      } catch (err) {
        console.error("Shopify collections failed:", err);
      }
    }
    return request<{ collections: string[]; categories: string[] }>("/collections");
  },

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
