/**
 * Normalize image URLs for display — supports Google Drive share links,
 * Shopify CDN sizing, relative /api/uploads paths, and standard HTTPS URLs.
 */

const DRIVE_HOSTS = ["drive.google.com", "docs.google.com"];

export function extractGoogleDriveId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!DRIVE_HOSTS.includes(parsed.hostname)) return null;

    const fromPath = parsed.pathname.match(/\/file\/d\/([^/]+)/)?.[1];
    if (fromPath) return fromPath;

    const fromQuery = parsed.searchParams.get("id");
    if (fromQuery) return fromQuery;

    return null;
  } catch {
    return null;
  }
}

export function toGoogleDriveImageUrl(fileId: string, size = 800): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

/** Request a resized Shopify CDN asset when possible. */
export function withImageWidth(src: string, width?: number): string {
  if (!src || !width || width <= 0) return src;
  try {
    const url = new URL(src);
    const host = url.hostname;
    if (host.includes("cdn.shopify.com") || host.includes("shopify.com")) {
      url.searchParams.set("width", String(Math.round(width)));
      return url.toString();
    }
  } catch {
    // keep original
  }
  return src;
}

export function normalizeImageUrl(src: string, width = 800): string {
  if (!src) return "";
  if (src.startsWith("data:")) return src;

  const driveId = extractGoogleDriveId(src);
  if (driveId) return toGoogleDriveImageUrl(driveId, Math.min(width, 1600));

  if (src.startsWith("http://") || src.startsWith("https://")) {
    return withImageWidth(src, width);
  }
  return src.startsWith("/") ? src : `/${src}`;
}

export function normalizeImageList(urls?: string[], width = 1200): string[] {
  return (urls || []).map((u) => normalizeImageUrl(u, width)).filter(Boolean);
}
