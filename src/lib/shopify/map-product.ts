import type { Product, ProductPricingMode, ProductVariant } from "../types";

export type ShopifyMoney = {
  amount: string;
  currencyCode: string;
};

export type ShopifyVariantNode = {
  id: string;
  title: string;
  availableForSale: boolean;
  sku?: string | null;
  price: ShopifyMoney;
  compareAtPrice?: ShopifyMoney | null;
  image?: { url: string } | null;
  selectedOptions?: Array<{ name: string; value: string }>;
};

export type ShopifyProductNode = {
  id: string;
  handle: string;
  title: string;
  description?: string;
  descriptionHtml?: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  availableForSale: boolean;
  featuredImage?: { url: string; altText?: string | null } | null;
  images?: { nodes: Array<{ url: string; altText?: string | null }> };
  priceRange: {
    minVariantPrice: ShopifyMoney;
    maxVariantPrice: ShopifyMoney;
  };
  compareAtPriceRange?: {
    minVariantPrice: ShopifyMoney;
  };
  options?: Array<{ name: string; values: string[] }>;
  variants: { nodes: ShopifyVariantNode[] };
};

function moneyAmount(m?: ShopifyMoney | null): number {
  if (!m?.amount) return 0;
  return Math.round(parseFloat(m.amount));
}

function detectPricingMode(node: ShopifyProductNode): ProductPricingMode {
  if (node.tags?.some((t) => t.toLowerCase() === "bundle")) return "bundle";
  const prices = new Set(node.variants.nodes.map((v) => v.price.amount));
  if (prices.size <= 1 && node.variants.nodes.length > 1) return "bundle";
  return "variant";
}

function mapVariant(v: ShopifyVariantNode): ProductVariant {
  const label =
    v.title === "Default Title"
      ? "Standard"
      : v.selectedOptions?.map((o) => o.value).join(" / ") || v.title;

  return {
    id: v.id,
    label,
    inStock: v.availableForSale,
    price: {
      currency: v.price.currencyCode || "INR",
      amount: moneyAmount(v.price),
    },
  };
}

export function mapShopifyProduct(node: ShopifyProductNode): Product {
  const pricingMode = detectPricingMode(node);
  const mappedVariants = node.variants.nodes.map(mapVariant);
  // Bundles still need at least one Shopify variant GID for checkout (Default Title → "Standard").
  const variants =
    pricingMode === "bundle"
      ? (() => {
          const extras = mappedVariants.filter((v) => v.label !== "Standard");
          return extras.length ? extras : mappedVariants;
        })()
      : mappedVariants;
  const images = [
    ...(node.featuredImage?.url ? [node.featuredImage.url] : []),
    ...(node.images?.nodes?.map((i) => i.url) || []),
  ].filter((url, i, arr) => url && arr.indexOf(url) === i);

  const collectionTag = node.tags?.find((t) => t.toLowerCase().startsWith("collection:"));
  const collectionName = collectionTag
    ? collectionTag.replace(/^collection:/i, "").trim()
    : node.productType || undefined;

  const category =
    node.tags?.find((t) => t.toLowerCase().startsWith("category:"))?.replace(/^category:/i, "").trim() ||
    node.productType?.toLowerCase() ||
    undefined;

  const compareAt = moneyAmount(node.compareAtPriceRange?.minVariantPrice);
  const minPrice = moneyAmount(node.priceRange.minVariantPrice);
  const primaryVariantId = node.variants.nodes[0]?.id;

  return {
    _id: node.id,
    name: node.title,
    slug: node.handle,
    sku: node.variants.nodes[0]?.sku || undefined,
    description: node.description || undefined,
    shortDescription: node.description?.slice(0, 160) || undefined,
    price: minPrice,
    compareAtPrice: compareAt > minPrice ? compareAt : null,
    currency: node.priceRange.minVariantPrice.currencyCode || "INR",
    category,
    categories: category ? [category] : undefined,
    collectionName,
    tags: node.tags || [],
    badges: (node.tags || []).filter((t) =>
      ["trending", "fun", "premium", "limited", "new"].includes(t.toLowerCase())
    ),
    images,
    thumbnail: images[0],
    variants,
    pricingMode,
    // Prefer the primary Shopify variant for add-to-cart when options omit variantId (bundles).
    ...(primaryVariantId ? { shopifyMerchandiseId: primaryVariantId } : {}),
    inStock: node.availableForSale,
    stock: node.availableForSale ? 99 : 0,
    featured: node.tags?.some((t) => t.toLowerCase() === "featured") || false,
    active: true,
  };
}
