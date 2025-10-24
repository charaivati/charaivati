// lib/csrf.ts
import { cookies as nextCookies } from "next/headers";
import { NextResponse } from "next/server";

const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || "csrf_token";

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
    console.error("getCsrfTokenFromRequest error:", err);
    return null;
  }
}

/**
 * Set a CSRF cookie on a NextResponse.
 */
export function setCsrfCookie<T = unknown>(res: NextResponse<T>, token: string, opts?: { maxAge?: number }): NextResponse<T> {
  const maxAge = opts?.maxAge ?? 60 * 60 * 24; // 1 day default
  res.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // CSRF cookie typically readable by JS
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge,
    expires: new Date(Date.now() + maxAge * 1000),
    priority: "high",
  });
  return res;
}
