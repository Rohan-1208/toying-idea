/** Shop filter ids → Shopify productType values (and legacy category tags). */
export const SHOP_CATEGORIES = [
  { id: "", label: "All" },
  { id: "keychains", label: "Keychains" },
  { id: "collectibles", label: "Collectibles" },
  { id: "home", label: "Home" },
  { id: "fidgets", label: "Fidgets" },
  { id: "seasonal", label: "Seasonal" },
  { id: "custom", label: "Custom" },
  { id: "racing", label: "Racing" },
  { id: "spiritual", label: "Spiritual" },
] as const;

export type ShopCategoryId = (typeof SHOP_CATEGORIES)[number]["id"];

/** Canonical product types / tag suffixes that belong in each filter. */
export const SHOP_CATEGORY_TYPES: Record<string, string[]> = {
  keychains: ["Keychains", "Accessories", "Pet Accessories"],
  collectibles: [
    "Collectibles",
    "Toys",
    "toys",
    "Flexi Toys",
    "Sculptures",
    "Props",
    "Gifts",
  ],
  home: [
    "Home Decor",
    "Desk Decor",
    "Desk Organizers",
    "Planters",
    "Lighting",
    "Wall Art",
  ],
  fidgets: ["Fidgets", "Puzzles"],
  seasonal: ["Seasonal"],
  custom: ["Custom", "DIY"],
  racing: ["Racing", "Automotive"],
  spiritual: ["Spiritual"],
};

export function shopifyQueryForCategory(categoryId: string): string | null {
  const types = SHOP_CATEGORY_TYPES[categoryId];
  if (!types?.length) return null;
  // Storefront search: product_type:"Home Decor" OR …
  const typeClause = types
    .map((t) => (/\s/.test(t) ? `product_type:"${t}"` : `product_type:${t}`))
    .join(" OR ");
  // Also match legacy category: tags from older catalog items
  const tagClause = `tag:category:${categoryId} OR tag:category:${capitalize(categoryId)}`;
  return `(${typeClause}) OR (${tagClause})`;
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function productMatchesShopCategory(
  categoryId: string,
  product: {
    category?: string;
    categories?: string[];
    tags?: string[];
    collectionName?: string;
  }
): boolean {
  if (!categoryId) return true;
  const types = SHOP_CATEGORY_TYPES[categoryId];
  if (!types?.length) return true;

  const allowed = new Set(types.map((t) => t.toLowerCase()));
  allowed.add(categoryId.toLowerCase());

  const candidates = [
    product.category,
    ...(product.categories || []),
    product.collectionName,
    ...(product.tags || [])
      .filter((t) => /^category:/i.test(t))
      .map((t) => t.replace(/^category:/i, "").trim()),
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());

  return candidates.some((c) => allowed.has(c));
}
