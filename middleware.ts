// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { absoluteUrl, SITE_URL } from "@/lib/config"; // requires lib/config.ts (we added this earlier)

/**
 * Edge-safe nonce generator
 */
function genNonce() {
  try {
    // Edge runtime will have globalThis.crypto.getRandomValues
    const bytes = new Uint8Array(16);
    globalThis.crypto?.getRandomValues?.(bytes);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    // base64
    if (typeof btoa === "function") return btoa(binary);
    if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
    return globalThis.btoa?.(binary) || "fallback-nonce";
  } catch (err) {
    // don't leak error details in prod logs; log minimal info
    // eslint-disable-next-line no-console
    console.warn("Nonce generation error - using fallback");
    return "fallback-nonce-" + Date.now();
  }
}

const isProd = process.env.NODE_ENV === "production";

/**
 * CORS allowlist
 * - Use CORS_ALLOWED_ORIGINS env var for a comma-separated list
 * - Add SITE_URL automatically if present
 */
const DEFAULT_ALLOWED = new Set<string>([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);
const envList = (process.env.CORS_ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (SITE_URL) envList.push(SITE_URL);
for (const o of envList) DEFAULT_ALLOWED.add(o);

function applyCors(req: NextRequest): NextResponse | null {
  try {
    const origin = req.headers.get("origin");
    const isPreflight =
      req.method === "OPTIONS" && !!req.headers.get("access-control-request-method");

    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return null;

    const allow = origin && DEFAULT_ALLOWED.has(origin) ? origin : null;

    if (isPreflight) {
      const res = new NextResponse(null, { status: 204 });
      if (allow) {
        res.headers.set("Access-Control-Allow-Origin", allow);
        res.headers.set("Access-Control-Allow-Credentials", "true");
        res.headers.set(
          "Access-Control-Allow-Headers",
          "content-type, authorization, x-csrf-token"
        );
        res.headers.set(
          "Access-Control-Allow-Methods",
          "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        );
        res.headers.set("Vary", "Origin");
        res.headers.set("Access-Control-Max-Age", "600");
      }
      return res;
    }

    if (allow) {
      const res = NextResponse.next();
      res.headers.set("Access-Control-Allow-Origin", allow);
      res.headers.set("Access-Control-Allow-Credentials", "true");
      res.headers.set("Vary", "Origin");
      return res;
    }
    return null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("CORS check error (non-fatal)");
    return null;
  }
}

/**
 * Rate limiting:
 * - In-memory per-instance short window fallback (very conservative)
 * - If you run multiple instances, replace with a Redis-backed limiter (recommended)
 *
 * NOTE: in-memory is not safe for distributed deployment — use Redis/Upstash in prod.
 */
type Bucket = { t: number[]; limit: number };
const memStore = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 30; // per minute per IP (fallback)
const ROUTE_LIMITS: Record<string, number> = {
  "/api/auth/verify": 10,
};

function getClientIp(req: NextRequest) {
  try {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    return (
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "0.0.0.0"
    );
  } catch {
    return "0.0.0.0";
  }
}

function rateLimitFallback(req: NextRequest): NextResponse | null {
  try {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return null;

    const limit = ROUTE_LIMITS[url.pathname] ?? DEFAULT_LIMIT;
    const ip = getClientIp(req);
    const key = `${ip}:${url.pathname}`;
    const now = Date.now();

    const b = memStore.get(key) ?? { t: [], limit };
    b.t = b.t.filter((x) => now - x < WINDOW_MS);

    if (b.t.length >= limit) {
      memStore.set(key, b);
      const resetIn = WINDOW_MS - (now - b.t[0]);
      const res = NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429 }
      );
      res.headers.set("RateLimit-Limit", String(limit));
      res.headers.set("RateLimit-Remaining", "0");
      res.headers.set("RateLimit-Reset", String(Math.ceil(resetIn / 1000)));
      res.headers.set("Retry-After", String(Math.ceil(resetIn / 1000)));
      res.headers.set("Cache-Control", "no-store");
      return res;
    }

    b.t.push(now);
    memStore.set(key, b);
    const remaining = Math.max(0, limit - b.t.length);
    const resetIn = WINDOW_MS - (now - (b.t[0] ?? now));

    const res = NextResponse.next();
    res.headers.set("RateLimit-Limit", String(limit));
    res.headers.set("RateLimit-Remaining", String(remaining));
    res.headers.set("RateLimit-Reset", String(Math.ceil(resetIn / 1000)));
    return res;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("Rate limiter error (non-fatal)");
    return null;
  }
}

export function middleware(req: NextRequest) {
  try {
    const url = new URL(req.url);

    // API: CORS and rate limiting
    if (url.pathname.startsWith("/api/")) {
      // CORS
      const cors = applyCors(req);
      if (cors) return cors;

      // Prefer Redis-backed limiter here (if available), otherwise fallback
      // TODO: replace rateLimitFallback with a Redis-backed limiter for production
      const rl = rateLimitFallback(req);
      if (rl) return rl;

      return NextResponse.next();
    }

    // Non-API: inject per-request CSP nonce
    const nonce = genNonce();

    // Build CSP: keep dev relaxations out of prod
    const connectSrcSite = SITE_URL ?? (isProd ? "" : "http://localhost:3000 ws://localhost:3000");
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "object-src 'none'",
      `script-src 'self' 'nonce-${nonce}'${isProd ? "" : " 'unsafe-eval'"}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src 'self' ${connectSrcSite}`,
      "worker-src 'self' blob:",
      "frame-src 'self' blob: data:",
      "manifest-src 'self'",
      ...(isProd ? ["upgrade-insecure-requests"] : []),
    ].join("; ");

    const reqHeaders = new Headers(req.headers);
    reqHeaders.set("x-nonce", nonce);

    const res = NextResponse.next({ request: { headers: reqHeaders } });

    res.headers.set("Content-Security-Policy", csp);
    // Helpful security headers (non-invasive)
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("X-XSS-Protection", "0");

    return res;
  } catch (err) {
    // Do not leak headers/payloads in logs in production.
    // Log minimal context and continue (open fail-safe).
    // eslint-disable-next-line no-console
    if (isProd) {
      console.error("Middleware error (see server logs)");
    } else {
      console.error("Middleware error:", err);
    }
    return NextResponse.next();
  }
}

/**
 * Matcher: include everything except next internals and static assets
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
