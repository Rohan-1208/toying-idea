import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine, Product } from "../lib/types";
import { cartLineKey, resolveProductImage, resolveProductPrice } from "../lib/cart";

const STORAGE_KEY = "ti_cart_v2";

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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines]);

  const value = useMemo<CartContextValue>(() => {
    const add: CartContextValue["add"] = (product, qty = 1, options) => {
      const key = cartLineKey(product.slug, options);
      const price = resolveProductPrice(product, options?.variantId);
      setLines((prev) => {
        const existing = prev.find((l) => l.key === key);
        if (existing) {
          return prev.map((l) =>
            l.key === key ? { ...l, qty: l.qty + qty, price, options: options || l.options } : l
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
            options,
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

    const clear = () => setLines([]);

    const count = lines.reduce((s, l) => s + l.qty, 0);
    const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);

    return { lines, count, subtotal, add, setQty, remove, clear, isOpen, setOpen };
  }, [lines, isOpen]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
