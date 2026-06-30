export interface Product {
  _id?: string;
  name: string;
  slug: string;
  sku?: string;
  description?: string;
  shortDescription?: string;
  price: number;
  compareAtPrice?: number | null;
  currency?: string;
  category?: string;
  collectionName?: string;
  tags?: string[];
  badges?: string[];
  images?: string[];
  thumbnail?: string;
  material?: string;
  finishes?: string[];
  colors?: string[];
  stock?: number;
  lowStockThreshold?: number;
  inStock?: boolean;
  featured?: boolean;
  rating?: number;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartLine {
  slug: string;
  productId?: string;
  name: string;
  price: number;
  qty: number;
  image?: string;
  options?: Record<string, string>;
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "printing"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface OrderTracking {
  carrier?: string;
  number?: string;
  url?: string;
  estimatedDelivery?: string;
}

export interface OrderStatusEvent {
  status: string;
  note?: string;
  at?: string;
}

export interface OrderItem {
  productId?: string;
  slug?: string;
  sku?: string;
  name: string;
  price: number;
  qty: number;
  image?: string;
  options?: Record<string, string>;
}

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
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  currency?: string;
  status: OrderStatus;
  paymentStatus?: "unpaid" | "paid" | "refunded";
  paymentMethod?: string;
  tracking?: OrderTracking;
  statusHistory?: OrderStatusEvent[];
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

export interface PyotDetails {
  fileLinks?: string;
  fileNames?: string;
  material?: string;
  finish?: string;
  color?: string;
  quantity?: string;
  scale?: string;
}

export interface GiftingDetails {
  occasion?: string;
  quantity?: string;
  budget?: string;
  brandingNotes?: string;
  deliveryDate?: string;
}

export interface InquiryQuote {
  amount?: number;
  currency?: string;
  note?: string;
  validUntil?: string;
}

export interface Inquiry {
  _id?: string;
  type: InquiryType;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  pyot?: PyotDetails;
  gifting?: GiftingDetails;
  contact?: { subject?: string };
  details?: Record<string, unknown>;
  quote?: InquiryQuote;
  status?: InquiryStatus;
  createdAt?: string;
  updatedAt?: string;
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
