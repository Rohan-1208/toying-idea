import { shopifyAdminGraphql, isShopifyAdminConfigured } from "./shopify-admin.js";

export type TrackedFulfillment = {
  status: string;
  carrier?: string;
  number?: string;
  url?: string;
  createdAt?: string;
};

export type TrackedOrder = {
  orderNumber: string;
  email: string;
  financialStatus: string;
  fulfillmentStatus: string;
  processedAt?: string;
  statusPageUrl?: string;
  items: Array<{ title: string; quantity: number }>;
  fulfillments: TrackedFulfillment[];
  /** Friendly step for the progress UI */
  step: "placed" | "confirmed" | "printing" | "shipped" | "delivered" | "cancelled";
};

type ShopifyOrderNode = {
  id: string;
  name: string;
  email?: string | null;
  cancelledAt?: string | null;
  displayFinancialStatus?: string | null;
  displayFulfillmentStatus?: string | null;
  processedAt?: string | null;
  statusPageUrl?: string | null;
  fulfillments: Array<{
    displayStatus?: string | null;
    createdAt?: string | null;
    trackingInfo: Array<{
      company?: string | null;
      number?: string | null;
      url?: string | null;
    }>;
  }>;
  lineItems: {
    nodes: Array<{ title: string; quantity: number }>;
  };
};

function normalizeOrderName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("#") ? trimmed : `#${trimmed.replace(/^#+/, "")}`;
}

function mapStep(order: ShopifyOrderNode): TrackedOrder["step"] {
  if (order.cancelledAt) return "cancelled";
  const fulfill = (order.displayFulfillmentStatus || "").toUpperCase();
  if (fulfill === "FULFILLED") {
    const delivered = order.fulfillments.some((f) =>
      /delivered/i.test(f.displayStatus || "")
    );
    return delivered ? "delivered" : "shipped";
  }
  if (fulfill === "PARTIAL" || fulfill === "IN_PROGRESS") return "printing";
  const pay = (order.displayFinancialStatus || "").toUpperCase();
  if (pay === "PAID" || pay === "PARTIALLY_PAID" || pay === "PENDING") return "confirmed";
  return "placed";
}

const ORDERS_QUERY = `
  query OrdersByName($query: String!) {
    orders(first: 5, query: $query) {
      nodes {
        id
        name
        email
        cancelledAt
        displayFinancialStatus
        displayFulfillmentStatus
        processedAt
        statusPageUrl
        fulfillments(first: 5) {
          displayStatus
          createdAt
          trackingInfo {
            company
            number
            url
          }
        }
        lineItems(first: 30) {
          nodes {
            title
            quantity
          }
        }
      }
    }
  }
`;

export async function findShopifyOrderForTracking(
  orderNumber: string,
  email: string
): Promise<TrackedOrder> {
  if (!isShopifyAdminConfigured()) {
    throw new Error("Order tracking is not configured yet");
  }

  const name = normalizeOrderName(orderNumber);
  const emailNorm = email.trim().toLowerCase();
  if (!name || name === "#") throw new Error("Enter your order number");
  if (!emailNorm || !emailNorm.includes("@")) throw new Error("Enter a valid email");

  // Shopify search: try with and without leading #
  const queries = [
    `name:${name}`,
    `name:${name.replace(/^#/, "")}`,
  ];

  let match: ShopifyOrderNode | undefined;
  for (const q of queries) {
    const data = await shopifyAdminGraphql<{ orders: { nodes: ShopifyOrderNode[] } }>(ORDERS_QUERY, {
      query: q,
    });
    match = data.orders.nodes.find((o) => (o.email || "").trim().toLowerCase() === emailNorm);
    if (match) break;
    // Also allow name-only match then verify email (exact name)
    const byName = data.orders.nodes.find(
      (o) => o.name.replace(/\s/g, "").toLowerCase() === name.replace(/\s/g, "").toLowerCase()
    );
    if (byName) {
      if ((byName.email || "").trim().toLowerCase() !== emailNorm) {
        throw new Error("Unauthorized: email does not match this order");
      }
      match = byName;
      break;
    }
  }

  if (!match) throw new Error("Order not found");

  const fulfillments: TrackedFulfillment[] = [];
  for (const f of match.fulfillments || []) {
    if (f.trackingInfo?.length) {
      for (const t of f.trackingInfo) {
        fulfillments.push({
          status: f.displayStatus || "IN_TRANSIT",
          carrier: t.company || undefined,
          number: t.number || undefined,
          url: t.url || undefined,
          createdAt: f.createdAt || undefined,
        });
      }
    } else {
      fulfillments.push({
        status: f.displayStatus || "PENDING",
        createdAt: f.createdAt || undefined,
      });
    }
  }

  return {
    orderNumber: match.name,
    email: match.email || emailNorm,
    financialStatus: match.displayFinancialStatus || "PENDING",
    fulfillmentStatus: match.displayFulfillmentStatus || "UNFULFILLED",
    processedAt: match.processedAt || undefined,
    statusPageUrl: match.statusPageUrl || undefined,
    items: match.lineItems.nodes.map((li) => ({ title: li.title, quantity: li.quantity })),
    fulfillments,
    step: mapStep(match),
  };
}
