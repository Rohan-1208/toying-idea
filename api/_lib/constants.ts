export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "printing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export const INQUIRY_TYPES = ["pyot", "gifting", "contact"] as const;
export const INQUIRY_STATUSES = [
  "new",
  "in-review",
  "quoted",
  "approved",
  "printing",
  "completed",
  "closed",
] as const;

export const INVENTORY_REASONS = ["sale", "restore", "adjustment"] as const;
