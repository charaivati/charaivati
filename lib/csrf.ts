// lib/csrf.ts
import { cookies as nextCookies } from "next/headers";
import { NextResponse } from "next/server";

export const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || "csrf_token";

/**
 * Read CSRF token from request header or cookie.
 */
export async function getCsrfTokenFromRequest(req?: Request): Promise<string | null> {
  try {
    if (req) {
      const header = req.headers.get("x-csrf-token");
      if (header) return header;
    }

    const jar = typeof nextCookies === "function" ? nextCookies() : nextCookies;
    const cookies = await Promise.resolve(jar as any);
    const c = typeof cookies.get === "function" ? cookies.get(CSRF_COOKIE_NAME) : undefined;
    return (c && c.value) ? String(c.value) : null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("getCsrfTokenFromRequest error:", err);
    return null;
  }
}

/**
 * Set a CSRF cookie on a NextResponse.
 * - httpOnly: false (CSRF token must be readable by client JS)
 * - Accepts optional domain (useful when your site uses subdomains)
 */
export function setCsrfCookie<T = unknown>(
  res: NextResponse<T>,
  token: string,
  opts?: { maxAge?: number; domain?: string }
): NextResponse<T> {
  const maxAge = opts?.maxAge ?? 60 * 60 * 24; // 1 day default
  const cookieOpts: any = {
    httpOnly: false, // JS must read it
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge,
    expires: new Date(Date.now() + maxAge * 1000),
    priority: "high",
  };
  if (opts?.domain) cookieOpts.domain = opts.domain;
  res.cookies.set(CSRF_COOKIE_NAME, token, cookieOpts);
  return res;
}
