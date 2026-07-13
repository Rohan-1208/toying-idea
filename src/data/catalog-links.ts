/** Deep links from 3D home featured drops → catalog */
export const FEATURED_DROPS = [
  { label: "F1 Collection", to: "/shop?collection=F1" },
  { label: "Flexi Dragon", to: "/product/flexi-dragon" },
  { label: "Hogwarts Castle", to: "/product/Harry%20Potter" },
  { label: "Flexi Caterpillar", to: "/product/caterpillar" },
] as const;

export const COLLECTION_LINKS = [
  { label: "F1", to: "/shop?collection=F1" },
  { label: "Valentines", to: "/shop?collection=Valentines" },
] as const;
