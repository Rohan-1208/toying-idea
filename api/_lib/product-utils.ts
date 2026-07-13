import type { ProductDoc } from "./models/Product.js";

type VariantLike = {
  id: string;
  label: string;
  inStock?: boolean;
  price?: { amount?: number };
};

export function isBundleProduct(product: Pick<ProductDoc, "pricingMode">): boolean {
  return product.pricingMode === "bundle";
}

export function resolveVariantPrice(product: ProductDoc, variantId?: string): number {
  if (isBundleProduct(product)) return product.price;
  const variants = (product.variants || []) as VariantLike[];
  if (!variants.length) return product.price;
  const variant = variants.find((v) => v.id === variantId && v.inStock !== false) || variants.find((v) => v.inStock !== false);
  return variant?.price?.amount ?? product.price;
}

export function resolveVariantLabel(product: ProductDoc, variantId?: string): string {
  const variants = (product.variants || []) as VariantLike[];
  if (!variants.length || !variantId) return "";
  return variants.find((v) => v.id === variantId)?.label || "";
}

export function categoryFilter(category: string) {
  return {
    $or: [{ categories: category }, { category }],
  };
}
