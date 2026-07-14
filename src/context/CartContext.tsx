import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine, Product } from "../lib/types";
import { cartLineKey, resolveProductImage, resolveProductPrice, resolveVariant } from "../lib/cart";
import { isShopifyConfigured } from "../lib/shopify/config";
import { checkoutFromMerchandise } from "../lib/shopify";

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
  const variant = resolveVariant(product, options?.variantId);
  if (variant?.id?.startsWith("gid://")) return variant.id;
  // Bundle / single-variant Shopify products: first (and often only) variant GID on product._id of variants
  const first = product.variants?.find((v) => v.id?.startsWith("gid://"));
  return first?.id;
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
  /** Create a Shopify cart and return hosted checkout URL (requires Shopify env). */
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
        throw new Error("Shopify is not configured on this environment.");
      }
      const merchandiseLines = lines
        .map((l) => ({
          merchandiseId: l.options?.variantId || "",
          quantity: l.qty,
        }))
        .filter((l) => l.merchandiseId.startsWith("gid://"));

      if (!merchandiseLines.length) {
        throw new Error(
          "This cart has no Shopify variant IDs. Refresh products from Shopify and add items again."
        );
      }

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
