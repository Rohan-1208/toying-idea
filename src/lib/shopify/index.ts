import { storefrontFetch, ShopifyError } from "./client";
import {
  CART_CREATE_MUTATION,
  CART_LINES_ADD_MUTATION,
  CART_LINES_REMOVE_MUTATION,
  CART_LINES_UPDATE_MUTATION,
  CART_QUERY,
  COLLECTION_PRODUCTS_QUERY,
  COLLECTIONS_QUERY,
  PRODUCT_BY_HANDLE_QUERY,
  PRODUCTS_QUERY,
} from "./queries";
import { mapShopifyProduct, type ShopifyProductNode } from "./map-product";
import type { Product } from "../types";

export type ShopifyCart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost?: {
    subtotalAmount: { amount: string; currencyCode: string };
    totalAmount: { amount: string; currencyCode: string };
  };
  lines: {
    nodes: Array<{
      id: string;
      quantity: number;
      merchandise: {
        id: string;
        title: string;
        sku?: string | null;
        price: { amount: string; currencyCode: string };
        image?: { url: string } | null;
        product: {
          id: string;
          handle: string;
          title: string;
          featuredImage?: { url: string } | null;
        };
      };
    }>;
  };
};

type UserErrors = Array<{ field?: string[] | null; message: string }>;

function assertNoUserErrors(userErrors: UserErrors | undefined) {
  if (userErrors?.length) {
    throw new ShopifyError(userErrors.map((e) => e.message).join("; "));
  }
}

function buildProductQuery(filters?: {
  q?: string;
  category?: string;
  collection?: string;
  tag?: string;
  featured?: string;
}): string | undefined {
  const parts: string[] = ["status:active"];
  if (filters?.q) parts.push(`title:*${filters.q}*`);
  if (filters?.tag) parts.push(`tag:${filters.tag}`);
  if (filters?.category) parts.push(`tag:category:${filters.category}`);
  if (filters?.collection) parts.push(`tag:collection:${filters.collection}`);
  if (filters?.featured === "1" || filters?.featured === "true") parts.push("tag:featured");
  return parts.join(" ");
}

export async function listShopifyProducts(filters?: {
  q?: string;
  category?: string;
  collection?: string;
  tag?: string;
  featured?: string;
}): Promise<Product[]> {
  if (filters?.collection) {
    const handle = filters.collection
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    try {
      const data = await storefrontFetch<{
        collection: { products: { nodes: ShopifyProductNode[] } } | null;
      }>(COLLECTION_PRODUCTS_QUERY, { handle, first: 50 });
      if (data.collection?.products?.nodes?.length) {
        return data.collection.products.nodes.map(mapShopifyProduct);
      }
    } catch {
      // fall through to products query
    }
  }

  const data = await storefrontFetch<{ products: { nodes: ShopifyProductNode[] } }>(PRODUCTS_QUERY, {
    first: 50,
    query: buildProductQuery(filters),
  });
  return data.products.nodes.map(mapShopifyProduct);
}

export async function getShopifyProduct(handle: string): Promise<Product | null> {
  const data = await storefrontFetch<{ product: ShopifyProductNode | null }>(PRODUCT_BY_HANDLE_QUERY, {
    handle,
  });
  return data.product ? mapShopifyProduct(data.product) : null;
}

export async function listShopifyCollections(): Promise<{ collections: string[]; categories: string[] }> {
  const data = await storefrontFetch<{
    collections: { nodes: Array<{ title: string; handle: string }> };
  }>(COLLECTIONS_QUERY, { first: 50 });

  const collections = data.collections.nodes.map((c) => c.title);
  const products = await listShopifyProducts();
  const categories = [
    ...new Set(products.map((p) => p.category).filter(Boolean) as string[]),
  ];
  return { collections, categories };
}

export async function createCart(
  lines: Array<{ merchandiseId: string; quantity: number }>
): Promise<ShopifyCart> {
  const data = await storefrontFetch<{
    cartCreate: { cart: ShopifyCart | null; userErrors: UserErrors };
  }>(CART_CREATE_MUTATION, {
    input: {
      lines: lines.map((l) => ({ merchandiseId: l.merchandiseId, quantity: l.quantity })),
    },
  });
  assertNoUserErrors(data.cartCreate.userErrors);
  if (!data.cartCreate.cart) throw new ShopifyError("Could not create cart");
  return data.cartCreate.cart;
}

export async function getCart(cartId: string): Promise<ShopifyCart | null> {
  const data = await storefrontFetch<{ cart: ShopifyCart | null }>(CART_QUERY, { cartId });
  return data.cart;
}

export async function addCartLines(
  cartId: string,
  lines: Array<{ merchandiseId: string; quantity: number }>
): Promise<ShopifyCart> {
  const data = await storefrontFetch<{
    cartLinesAdd: { cart: ShopifyCart | null; userErrors: UserErrors };
  }>(CART_LINES_ADD_MUTATION, { cartId, lines });
  assertNoUserErrors(data.cartLinesAdd.userErrors);
  if (!data.cartLinesAdd.cart) throw new ShopifyError("Could not add cart lines");
  return data.cartLinesAdd.cart;
}

export async function updateCartLines(
  cartId: string,
  lines: Array<{ id: string; quantity: number }>
): Promise<ShopifyCart> {
  const data = await storefrontFetch<{
    cartLinesUpdate: { cart: ShopifyCart | null; userErrors: UserErrors };
  }>(CART_LINES_UPDATE_MUTATION, { cartId, lines });
  assertNoUserErrors(data.cartLinesUpdate.userErrors);
  if (!data.cartLinesUpdate.cart) throw new ShopifyError("Could not update cart lines");
  return data.cartLinesUpdate.cart;
}

export async function removeCartLines(cartId: string, lineIds: string[]): Promise<ShopifyCart> {
  const data = await storefrontFetch<{
    cartLinesRemove: { cart: ShopifyCart | null; userErrors: UserErrors };
  }>(CART_LINES_REMOVE_MUTATION, { cartId, lineIds });
  assertNoUserErrors(data.cartLinesRemove.userErrors);
  if (!data.cartLinesRemove.cart) throw new ShopifyError("Could not remove cart lines");
  return data.cartLinesRemove.cart;
}

/** Rebuild a Shopify cart from local lines and return the hosted checkout URL. */
export async function checkoutFromMerchandise(
  lines: Array<{ merchandiseId: string; quantity: number }>
): Promise<{ cartId: string; checkoutUrl: string }> {
  if (!lines.length) throw new ShopifyError("Cart is empty");
  const cart = await createCart(lines);
  if (!cart.checkoutUrl) throw new ShopifyError("Shopify did not return a checkout URL");
  return { cartId: cart.id, checkoutUrl: withHeadlessCheckoutChannel(cart.checkoutUrl) };
}

/**
 * Shopify often redirects cart checkout URLs through Online Store password
 * unless the headless channel query param is present.
 * @see https://community.shopify.dev/t/every-checkouturl-ends-up-with-password-page-site-under-construction/24378
 */
export function withHeadlessCheckoutChannel(checkoutUrl: string): string {
  try {
    const url = new URL(checkoutUrl);
    // Required so Checkout does not bounce through Online Store password → homepage.
    url.searchParams.set("channel", "headless-storefronts");
    return url.toString();
  } catch {
    const join = checkoutUrl.includes("?") ? "&" : "?";
    return `${checkoutUrl}${join}channel=headless-storefronts`;
  }
}
