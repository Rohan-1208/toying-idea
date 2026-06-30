import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine, Product } from "../lib/types";

const STORAGE_KEY = "ti_cart_v1";

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (product: Product, qty?: number, options?: Record<string, string>) => void;
  setQty: (slug: string, qty: number) => void;
  remove: (slug: string) => void;
  clear: () => void;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartLine[]) : [];
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
      setLines((prev) => {
        const existing = prev.find((l) => l.slug === product.slug);
        if (existing) {
          return prev.map((l) =>
            l.slug === product.slug ? { ...l, qty: l.qty + qty, options: options || l.options } : l
          );
        }
        return [
          ...prev,
          {
            slug: product.slug,
            productId: product._id,
            name: product.name,
            price: product.price,
            qty,
            image: product.thumbnail || product.images?.[0] || "",
            options,
          },
        ];
      });
      setOpen(true);
    };

    const setQty: CartContextValue["setQty"] = (slug, qty) =>
      setLines((prev) =>
        qty <= 0
          ? prev.filter((l) => l.slug !== slug)
          : prev.map((l) => (l.slug === slug ? { ...l, qty } : l))
      );

    const remove: CartContextValue["remove"] = (slug) =>
      setLines((prev) => prev.filter((l) => l.slug !== slug));

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
