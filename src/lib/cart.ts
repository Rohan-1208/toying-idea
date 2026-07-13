import type { Product, ProductVariant } from "./types";

export function isBundleProduct(product: Pick<Product, "pricingMode" | "variants">): boolean {
  return product.pricingMode === "bundle";
}

export function cartLineKey(slug: string, options?: Record<string, string>) {
  if (options?.variantId && !options.bundle) {
    return `${slug}::${options.variantId}`;
  }
  return slug;
}

export function resolveVariant(product: Product, variantId?: string): ProductVariant | undefined {
  if (isBundleProduct(product)) return undefined;
  const variants = product.variants?.filter((v) => v.inStock !== false) || [];
  if (!variants.length) return undefined;
  return variants.find((v) => v.id === variantId) || variants[0];
}

export function resolveProductPrice(product: Product, variantId?: string): number {
  if (isBundleProduct(product)) return product.price;
  const variant = resolveVariant(product, variantId);
  return variant?.price?.amount ?? product.price;
}

export function resolveProductImage(product: Product): string {
  return product.thumbnail || product.images?.[0] || "";
}

export function bundleIncludes(product: Product): string[] {
  if (!isBundleProduct(product)) return [];
  return (product.variants || [])
    .map((v) => v.label)
    .filter((label) => label && !/^whole collection$/i.test(label.trim()));
}
