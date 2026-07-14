import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine, Product } from "../lib/types";
import { cartLineKey, resolveProductImage, resolveProductPrice, resolveVariant } from "../lib/cart";
import { isShopifyConfigured } from "../lib/shopify/config";
import { checkoutFromMerchandise, getShopifyProduct } from "../lib/shopify";

const STORAGE_KEY = "ti_cart_v2";
const CART_ID_KEY = "ti_shopify_cart_id";

function migrateLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((line) => {
    const l = line as CartLine;
    return {
      ...l,
      key: l.key || cartLineKey(l.slug, l.options),
    };
  });
}

function merchandiseIdForLine(product: Product, options?: Record<string, string>): string | undefined {
  if (options?.variantId?.startsWith("gid://")) return options.variantId;
  if (product.shopifyMerchandiseId?.startsWith("gid://")) return product.shopifyMerchandiseId;
  const variant = resolveVariant(product, options?.variantId);
  if (variant?.id?.startsWith("gid://")) return variant.id;
  const first = product.variants?.find((v) => v.id?.startsWith("gid://"));
  return first?.id;
}

async function resolveMerchandiseId(line: CartLine): Promise<string | null> {
  const existing = line.options?.variantId;
  if (existing?.startsWith("gid://")) return existing;

  try {
    const product = await getShopifyProduct(line.slug);
    if (!product) return null;
    return (
      product.shopifyMerchandiseId ||
      product.variants?.find((v) => v.id?.startsWith("gid://"))?.id ||
      null
    );
  } catch {
    return null;
  }
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (product: Product, qty?: number, options?: Record<string, string>) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  beginShopifyCheckout: () => Promise<string>;
  shopifyReady: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return migrateLines(JSON.parse(raw));
      const legacy = localStorage.getItem("ti_cart_v1");
      return legacy ? migrateLines(JSON.parse(legacy)) : [];
    } catch {
      return [];
    }
  });
  const [isOpen, setOpen] = useState(false);
  const shopifyReady = isShopifyConfigured();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines]);

  const value = useMemo<CartContextValue>(() => {
    const add: CartContextValue["add"] = (product, qty = 1, options) => {
      const merchandiseId = merchandiseIdForLine(product, options);
      const mergedOptions = {
        ...options,
        ...(merchandiseId ? { variantId: merchandiseId } : {}),
      };
      const key = cartLineKey(product.slug, mergedOptions);
      const price = resolveProductPrice(product, mergedOptions.variantId);
      setLines((prev) => {
        const existing = prev.find((l) => l.key === key);
        if (existing) {
          return prev.map((l) =>
            l.key === key
              ? { ...l, qty: l.qty + qty, price, options: mergedOptions || l.options, productId: product._id }
              : l
          );
        }
        return [
          ...prev,
          {
            key,
            slug: product.slug,
            productId: product._id,
            name: product.name,
            price,
            qty,
            image: resolveProductImage(product),
            options: mergedOptions,
          },
        ];
      });
      setOpen(true);
    };

    const setQty: CartContextValue["setQty"] = (key, qty) =>
      setLines((prev) =>
        qty <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, qty } : l))
      );

    const remove: CartContextValue["remove"] = (key) =>
      setLines((prev) => prev.filter((l) => l.key !== key));

    const clear = () => {
      setLines([]);
      localStorage.removeItem(CART_ID_KEY);
    };

    const beginShopifyCheckout: CartContextValue["beginShopifyCheckout"] = async () => {
      if (!shopifyReady) {
        throw new Error("Checkout is not configured yet. Please try again shortly.");
      }
      if (!lines.length) {
        throw new Error("Your cart is empty.");
      }

      const merchandiseLines: Array<{ merchandiseId: string; quantity: number }> = [];
      const resolvedByKey: Record<string, string> = {};

      for (const line of lines) {
        const merchandiseId = await resolveMerchandiseId(line);
        if (!merchandiseId) {
          throw new Error(
            `Could not check out “${line.name}”. Remove it, open the product again, and add it to cart.`
          );
        }
        merchandiseLines.push({ merchandiseId, quantity: line.qty });
        resolvedByKey[line.key] = merchandiseId;
      }

      setLines((prev) =>
        prev.map((l) => {
          const id = resolvedByKey[l.key];
          return id ? { ...l, options: { ...l.options, variantId: id } } : l;
        })
      );

      const { cartId, checkoutUrl } = await checkoutFromMerchandise(merchandiseLines);
      localStorage.setItem(CART_ID_KEY, cartId);
      return checkoutUrl;
    };

    const count = lines.reduce((s, l) => s + l.qty, 0);
    const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);

    return {
      lines,
      count,
      subtotal,
      add,
      setQty,
      remove,
      clear,
      isOpen,
      setOpen,
      beginShopifyCheckout,
      shopifyReady,
    };
  }, [lines, isOpen, shopifyReady]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
