// Central brand palette for the TOYING IDEA 3D world.
// Warm cream backdrop with clay-orange, teal and gold — matching the voxel art direction.

export const PALETTE = {
  cream: "#F4EAD5",
  creamDeep: "#EAD9B8",
  ink: "#2B2018",

  clay: "#E8731E",
  clayLight: "#F0913A",
  clayDeep: "#C9560F",

  teal: "#3FB8C4",
  tealLight: "#6FD0D9",
  tealDeep: "#2A8C97",

  gold: "#F2B705",
  goldLight: "#FFD23F",

  white: "#FBF6EC",
} as const;

export type PaletteKey = keyof typeof PALETTE;

// A curated pool used to randomly tint procedural blocks while keeping harmony.
export const BLOCK_COLORS = [
  PALETTE.clay,
  PALETTE.clayLight,
  PALETTE.clayDeep,
  PALETTE.teal,
  PALETTE.tealLight,
  PALETTE.gold,
  PALETTE.goldLight,
];
