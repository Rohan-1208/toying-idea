export interface ProductVariant {
  id: string;
  label: string;
  material?: string;
  finish?: string;
  size?: string;
  inStock?: boolean;
  price: { currency: string; amount: number };
}

export type ProductPricingMode = "bundle" | "variant";

export interface Product {
  _id?: string;
  name: string;
  slug: string;
  sku?: string;
  tagline?: string;
  description?: string;
  shortDescription?: string;
  price: number;
  compareAtPrice?: number | null;
  currency?: string;
  category?: string;
  categories?: string[];
  collectionName?: string;
  tags?: string[];
  badges?: string[];
  images?: string[];
  thumbnail?: string;
  material?: string;
  finishes?: string[];
  colors?: string[];
  variants?: ProductVariant[];
  pricingMode?: ProductPricingMode;
  stock?: number;
  lowStockThreshold?: number;
  inStock?: boolean;
  featured?: boolean;
  featuredRank?: number | null;
  rating?: number;
  reviewCount?: number;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "printing"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface Order {
  _id?: string;
  orderNumber: string;
  customer: { name: string; email: string; phone?: string };
  shippingAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  items: Array<{
    productId?: string;
    slug?: string;
    sku?: string;
    name: string;
    price: number;
    qty: number;
    image?: string;
    options?: Record<string, string>;
  }>;
  subtotal: number;
  shipping: number;
  total: number;
  currency?: string;
  status: OrderStatus;
  paymentStatus?: "unpaid" | "paid" | "refunded";
  paymentMethod?: string;
  tracking?: {
    carrier?: string;
    number?: string;
    url?: string;
    estimatedDelivery?: string;
  };
  statusHistory?: Array<{ status: string; note?: string; at?: string }>;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type InquiryType = "pyot" | "gifting" | "contact";
export type InquiryStatus =
  | "new"
  | "in-review"
  | "quoted"
  | "approved"
  | "printing"
  | "completed"
  | "closed";

export interface Inquiry {
  _id?: string;
  type: InquiryType;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  pyot?: Record<string, string>;
  gifting?: Record<string, string>;
  contact?: { subject?: string };
  details?: Record<string, unknown>;
  quote?: { amount?: number; currency?: string; note?: string; validUntil?: string };
  status?: InquiryStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface Review {
  _id?: string;
  slug: string;
  authorName: string;
  rating: number;
  title?: string;
  body: string;
  status?: "pending" | "approved" | "rejected";
  createdAt?: string;
}

export interface InventoryMovement {
  _id?: string;
  productId?: string;
  slug: string;
  sku?: string;
  delta: number;
  stockAfter: number;
  reason: string;
  orderNumber?: string;
  note?: string;
  actor?: string;
  createdAt?: string;
}
