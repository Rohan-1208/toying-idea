/**
 * Normalize image URLs for display — supports Google Drive share links,
 * relative /api/uploads paths, and standard HTTPS URLs.
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

export function toGoogleDriveImageUrl(fileId: string, size = 1600): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

export function normalizeImageUrl(src: string): string {
  if (!src) return "";
  if (src.startsWith("data:")) return src;

  const driveId = extractGoogleDriveId(src);
  if (driveId) return toGoogleDriveImageUrl(driveId);

  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  return src.startsWith("/") ? src : `/${src}`;
}

export function normalizeImageList(urls?: string[]): string[] {
  return (urls || []).map(normalizeImageUrl).filter(Boolean);
}
