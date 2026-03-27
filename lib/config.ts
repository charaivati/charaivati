// lib/config.ts
// Centralized site URL + helpers.
// Use this everywhere you need absolute links (magic links, sitemaps, canonical tags, etc).

export const NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

function resolveSiteUrl(): string {
  const explicit = NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;
  if (explicit) return explicit;

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    const normalized = vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`;
    return normalized;
  }

  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl();

/**
 * Return an absolute URL for a given path.
 * If `path` is an absolute URL already, it is returned unchanged.
 */
export function absoluteUrl(path = "/"): string {
  try {
    const u = new URL(path);
    if (u.protocol === "http:" || u.protocol === "https:") return path;
  } catch {
    // not an absolute url
  }

  if (!path.startsWith("/")) path = `/${path}`;
  return `${SITE_URL}${path}`;
}
