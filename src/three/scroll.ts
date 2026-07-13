// Storyboard v2.0 — Tactile Scroll Journey
//   0.00 – 0.25  Hero City
//   0.25 – 0.45  The Dive / Print Studio
//   0.45 – 0.70  Precision Print (Workshop)
//   0.70 – 0.90  Designer Archive (Collection)
//   0.90 – 1.00  Infinite Horizon

export const STOPS = {
  hero: 0,
  dive: 0.25,
  workshop: 0.45,
  archive: 0.7,
  universe: 0.9,
  end: 1,
} as const;

export const SCROLL_PAGES = 7;
export const MOBILE_SCROLL_PAGES = 5;

export const clamp = (v: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, v));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Smoothstep — gentle ease for camera segments.
export const smooth = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};

// Smoother ease-in-out for the studio dive (less abrupt than smoothstep).
export const smoother = (t: number) => {
  const x = clamp(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

export const range = (
  value: number,
  inMin: number,
  inMax: number,
  outMin = 0,
  outMax = 1
) => {
  const t = clamp((value - inMin) / (inMax - inMin));
  return lerp(outMin, outMax, t);
};

// Scroll-driven progress within a chapter [start, end], eased.
export const chapterProgress = (
  offset: number,
  start: number,
  end: number,
  ease: (t: number) => number = smooth
) => ease(range(offset, start, end));

export const windowAt = (
  offset: number,
  start: number,
  end: number,
  fade = 0.06
) => {
  const fadeIn = range(offset, start - fade, start + fade);
  const fadeOut = 1 - range(offset, end - fade, end + fade);
  return clamp(Math.min(fadeIn, fadeOut));
};
