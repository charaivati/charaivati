// lib/config.ts
// Centralized site URL + helpers.
// Use this everywhere you need absolute links (magic links, sitemaps, canonical tags, etc).

export const NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;
export const SITE_URL =
  NEXT_PUBLIC_SITE_URL ??
  process.env.SITE_URL ??
  (process.env.NODE_ENV === "production"
    ? (() => {
        throw new Error("NEXT_PUBLIC_SITE_URL (or SITE_URL) must be set in production");
      })()
    : "http://localhost:3000"
  );

/**
 * Return an absolute URL for a given path.
 * If `path` is an absolute URL already, it is returned unchanged.
 */
export function absoluteUrl(path = "/"): string {
  // already absolute?
  try {
    const u = new URL(path);
    if (u.protocol === "http:" || u.protocol === "https:") return path;
  } catch {
    // not an absolute url
  }

  if (!path.startsWith("/")) path = `/${path}`;
  return `${SITE_URL}${path}`;
}
