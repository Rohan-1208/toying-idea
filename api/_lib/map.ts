import type { Inquiry, InventoryMovement, Order, Product, Review } from "./app-types.js";

type Row = Record<string, unknown>;

function iso(value: unknown): string | undefined {
  if (!value) return undefined;
  return new Date(String(value)).toISOString();
}

export function mapProduct(row: Row): Product {
  return {
    _id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    sku: (row.sku as string) || undefined,
    tagline: (row.tagline as string) || "",
    description: (row.description as string) || "",
    shortDescription: (row.short_description as string) || "",
    price: Number(row.price) || 0,
    compareAtPrice: row.compare_at_price == null ? null : Number(row.compare_at_price),
    currency: (row.currency as string) || "INR",
    category: (row.category as string) || "",
    categories: (row.categories as string[]) || [],
    collectionName: (row.collection_name as string) || "",
    tags: (row.tags as string[]) || [],
    badges: (row.badges as string[]) || [],
    images: (row.images as string[]) || [],
    thumbnail: (row.thumbnail as string) || "",
    material: (row.material as string) || "PLA",
    finishes: (row.finishes as string[]) || [],
    colors: (row.colors as string[]) || [],
    variants: (row.variants as Product["variants"]) || [],
    pricingMode: (row.pricing_mode as Product["pricingMode"]) || "variant",
    stock: Number(row.stock) || 0,
    lowStockThreshold: Number(row.low_stock_threshold) || 5,
    inStock: Boolean(row.in_stock),
    featured: Boolean(row.featured),
    featuredRank: row.featured_rank == null ? null : Number(row.featured_rank),
    rating: Number(row.rating) || 5,
    reviewCount: Number(row.review_count) || 0,
    active: row.active !== false,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function productToRow(body: Record<string, unknown>): Row {
  const row: Row = {};
  const assign = (dbKey: string, value: unknown) => {
    if (value !== undefined) row[dbKey] = value;
  };
  assign("slug", body.slug ? String(body.slug).toLowerCase() : undefined);
  assign("name", body.name);
  assign("sku", body.sku);
  assign("tagline", body.tagline);
  assign("description", body.description);
  assign("short_description", body.shortDescription ?? body.short_description);
  if (body.price != null) assign("price", Number(body.price));
  assign("compare_at_price", body.compareAtPrice ?? body.compare_at_price);
  assign("currency", body.currency ?? "INR");
  assign("category", body.category);
  assign("categories", body.categories);
  assign("collection_name", body.collectionName ?? body.collection_name);
  assign("tags", body.tags);
  assign("badges", body.badges);
  assign("images", body.images);
  assign("thumbnail", body.thumbnail);
  assign("material", body.material ?? "PLA");
  assign("finishes", body.finishes);
  assign("colors", body.colors);
  assign("variants", body.variants ?? []);
  assign("pricing_mode", body.pricingMode ?? body.pricing_mode ?? "variant");
  if (body.stock != null) assign("stock", Number(body.stock));
  if (body.lowStockThreshold != null) assign("low_stock_threshold", Number(body.lowStockThreshold));
  if (body.inStock != null) assign("in_stock", Boolean(body.inStock));
  if (body.featured != null) assign("featured", Boolean(body.featured));
  assign("featured_rank", body.featuredRank ?? body.featured_rank);
  if (body.active != null) assign("active", Boolean(body.active));
  row.updated_at = new Date().toISOString();
  return row;
}

export function mapOrder(row: Row): Order {
  const customer = (row.customer as Order["customer"]) || { name: "", email: "" };
  return {
    _id: String(row.id),
    orderNumber: String(row.order_number),
    customer,
    shippingAddress: (row.shipping_address as Order["shippingAddress"]) || {},
    items: (row.items as Order["items"]) || [],
    subtotal: Number(row.subtotal) || 0,
    shipping: Number(row.shipping) || 0,
    total: Number(row.total) || 0,
    currency: (row.currency as string) || "INR",
    status: (row.status as Order["status"]) || "pending",
    paymentStatus: (row.payment_status as Order["paymentStatus"]) || "unpaid",
    paymentMethod: (row.payment_method as string) || "cod",
    tracking: (row.tracking as Order["tracking"]) || {},
    statusHistory: (row.status_history as Order["statusHistory"]) || [],
    notes: (row.notes as string) || "",
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function mapInquiry(row: Row): Inquiry {
  return {
    _id: String(row.id),
    type: row.type as Inquiry["type"],
    name: String(row.name),
    email: String(row.email),
    phone: (row.phone as string) || "",
    message: (row.message as string) || "",
    pyot: row.pyot as Inquiry["pyot"],
    gifting: row.gifting as Inquiry["gifting"],
    contact: row.contact as Inquiry["contact"],
    details: (row.details as Record<string, unknown>) || {},
    quote: row.quote as Inquiry["quote"],
    status: (row.status as Inquiry["status"]) || "new",
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function mapReview(row: Row): Review {
  return {
    _id: String(row.id),
    slug: String(row.slug),
    authorName: String(row.author_name),
    rating: Number(row.rating),
    title: (row.title as string) || "",
    body: String(row.body),
    status: (row.status as Review["status"]) || "approved",
    createdAt: iso(row.created_at),
  };
}

export function mapMovement(row: Row): InventoryMovement {
  return {
    _id: String(row.id),
    productId: row.product_id ? String(row.product_id) : undefined,
    slug: String(row.slug || ""),
    sku: (row.sku as string) || "",
    delta: Number(row.delta),
    stockAfter: Number(row.stock_after),
    reason: String(row.reason),
    orderNumber: (row.order_number as string) || "",
    note: (row.note as string) || "",
    actor: (row.actor as string) || "system",
    createdAt: iso(row.created_at),
  };
}

export function throwIf(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
