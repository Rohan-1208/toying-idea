import type { Product, Order, Inquiry, InventoryMovement, Review, StudioDraft, PrintJob } from "./types";

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
    timeoutMs?: number;
  } = {}
): Promise<T> {
  const { method = "GET", body, admin, query, timeoutMs = 20_000 } = opts;
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
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = { error: text || `Request failed (${res.status})` };
  }
  if (!res.ok) {
    if (res.status === 401) auth.clear();
    throw new Error((data.error as string) || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  products: {
    list: (query?: Record<string, string | undefined>) =>
      request<{ items: Product[]; total: number }>("/products", { query }),
    get: (slug: string) => request<{ product: Product }>(`/products/${encodeURIComponent(slug)}`),
    adminList: () =>
      request<{ items: Product[]; total: number }>("/products", {
        query: { all: 1, limit: 100 },
        admin: true,
      }),
    adminUpdate: (id: string, body: Partial<Product>) =>
      request<{ product: Product }>(`/products/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body,
        admin: true,
      }),
  },

  orders: {
    create: (body: {
      customer: { name: string; email: string; phone: string };
      shippingAddress: {
        line1: string;
        line2?: string;
        city: string;
        state: string;
        pincode: string;
        country?: string;
      };
      items: Array<{ productId?: string; slug: string; qty: number; options?: Record<string, string> }>;
      paymentMethod?: string;
      notes?: string;
    }) => request<{ order: Order }>("/orders", { method: "POST", body, timeoutMs: 30_000 }),
    track: (idOrNumber: string, email: string) =>
      request<{ order: Order }>(`/orders/${encodeURIComponent(idOrNumber)}`, { query: { email } }),
    trackPublic: (orderNumber: string, email: string) =>
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
      pendingDrafts: number;
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

  health: () => request<{ ok: boolean; db: string; provider?: string; dbError?: string }>("/health"),

  collections: () => request<{ collections: string[]; categories: string[] }>("/collections"),

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

  studio: {
    upload: (file: { filename: string; contentType: string; data: string }) =>
      request<{ url: string }>("/studio/upload", { method: "POST", body: file, admin: true, timeoutMs: 60_000 }),
    catalogGenerate: (body: { photos: string[]; notes?: string; extraImages?: number }) =>
      request<{ draft: StudioDraft }>("/studio/catalog", {
        method: "POST",
        body,
        admin: true,
        timeoutMs: 120_000,
      }),
    drafts: (status = "pending") =>
      request<{ items: StudioDraft[] }>("/studio/drafts", { query: { status }, admin: true }),
    patchDraft: (id: string, body: { payload?: Record<string, unknown>; title?: string }) =>
      request<{ draft: StudioDraft }>("/studio/drafts", {
        method: "PATCH",
        body,
        query: { id },
        admin: true,
      }),
    approveDraft: (id: string) =>
      request<{ draft: StudioDraft; result?: unknown }>("/studio/drafts", {
        method: "POST",
        query: { id, action: "approve" },
        admin: true,
        timeoutMs: 30_000,
      }),
    rejectDraft: (id: string) =>
      request<{ draft: StudioDraft }>("/studio/drafts", {
        method: "POST",
        query: { id, action: "reject" },
        admin: true,
      }),
    printJobs: () => request<{ items: PrintJob[] }>("/studio/print-jobs", { admin: true }),
    patchPrintJob: (id: string, body: { status?: string; printer?: string; dueAt?: string; notes?: string }) =>
      request<{ job: PrintJob }>("/studio/print-jobs", {
        method: "PATCH",
        body,
        query: { id },
        admin: true,
      }),
    inboxDraft: (inquiryId: string) =>
      request<{ draft: StudioDraft }>("/studio/inbox", {
        method: "POST",
        body: { inquiryId, action: "draft" },
        admin: true,
        timeoutMs: 60_000,
      }),
    inboxSend: (draftId: string) =>
      request<{ draft: StudioDraft }>("/studio/inbox", {
        method: "POST",
        body: { action: "send", draftId },
        admin: true,
      }),
    marketing: (body: { productName?: string; trend?: string; extraImages?: number }) =>
      request<{ draft: StudioDraft }>("/studio/marketing", {
        method: "POST",
        body,
        admin: true,
        timeoutMs: 120_000,
      }),
    websiteTickets: () =>
      request<{ items: Array<Record<string, unknown>> }>("/studio/website", { admin: true }),
    websiteRequest: (requestText: string) =>
      request<{ draft: StudioDraft }>("/studio/website", {
        method: "POST",
        body: { request: requestText },
        admin: true,
        timeoutMs: 60_000,
      }),
  },
};
