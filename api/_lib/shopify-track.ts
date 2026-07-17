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

/** Shopify names look like #TI1005 — accept TI1005, #TI1005, 1005, ti-1005, etc. */
export function normalizeOrderName(raw: string): string {
  let t = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!t) return "";
  t = t.replace(/^#+/, "");
  // Allow TI-1005 → TI1005 (Shopify uses #TI1005 without hyphens in this store)
  t = t.replace(/^TI-/, "TI");
  // Bare numeric order ids → TI prefix (store default)
  if (/^\d+$/.test(t)) t = `TI${t}`;
  if (!t.startsWith("TI") && /^\d/.test(t)) t = `TI${t}`;
  return `#${t}`;
}

function namesEqual(a: string, b: string): boolean {
  return a.replace(/[\s#-]/g, "").toUpperCase() === b.replace(/[\s#-]/g, "").toUpperCase();
}

function mapStep(order: ShopifyOrderNode): TrackedOrder["step"] {
  if (order.cancelledAt) return "cancelled";
  const fulfill = (order.displayFulfillmentStatus || "").toUpperCase();
  if (fulfill === "FULFILLED") {
    const delivered = order.fulfillments.some((f) => /delivered/i.test(f.displayStatus || ""));
    return delivered ? "delivered" : "shipped";
  }
  if (fulfill === "PARTIAL" || fulfill === "IN_PROGRESS") return "printing";
  const pay = (order.displayFinancialStatus || "").toUpperCase();
  if (pay === "PAID" || pay === "PARTIALLY_PAID" || pay === "PENDING") return "confirmed";
  return "placed";
}

const ORDERS_QUERY = `
  query OrdersByName($query: String!) {
    orders(first: 10, query: $query) {
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
  if (!name || name === "#") throw new Error("Enter your order number (e.g. TI1005)");
  if (!emailNorm || !emailNorm.includes("@")) throw new Error("Enter a valid email");

  const bare = name.replace(/^#/, "");
  // Shopify search variants for #TI1005-style names
  const queries = [
    `name:${name}`,
    `name:${bare}`,
    `name:#${bare}`,
    bare,
    name,
  ];

  let foundByName: ShopifyOrderNode | undefined;
  let match: ShopifyOrderNode | undefined;

  for (const q of queries) {
    const data = await shopifyAdminGraphql<{ orders: { nodes: ShopifyOrderNode[] } }>(ORDERS_QUERY, {
      query: q,
    });
    const nodes = data.orders.nodes || [];
    if (!nodes.length) continue;

    foundByName =
      nodes.find((o) => namesEqual(o.name, name)) ||
      nodes.find((o) => namesEqual(o.name, bare)) ||
      nodes[0];

    match = nodes.find(
      (o) =>
        namesEqual(o.name, name) && (o.email || "").trim().toLowerCase() === emailNorm
    );
    if (match) break;

    match = nodes.find((o) => (o.email || "").trim().toLowerCase() === emailNorm);
    if (match && (namesEqual(match.name, name) || namesEqual(match.name, bare))) break;
    if (match && !namesEqual(match.name, name) && !namesEqual(match.name, bare)) {
      match = undefined;
    }
  }

  if (!match && foundByName) {
    const orderEmail = (foundByName.email || "").trim().toLowerCase();
    if (!orderEmail) {
      throw new Error(
        "This order has no email on file. Use the link in your confirmation email, or contact us with your order number."
      );
    }
    if (orderEmail !== emailNorm) {
      throw new Error("Email does not match this order");
    }
    match = foundByName;
  }

  if (!match) throw new Error("Order not found. Check the number (e.g. TI1005) and email from your confirmation.");

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
