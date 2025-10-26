// middleware.ts
import { NextRequest, NextResponse } from "next/server";

// Edge-safe nonce generator
function genNonce() {
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    if (typeof btoa === "function") return btoa(binary);
    if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
    return globalThis.btoa?.(binary) || "fallback-nonce";
  } catch (err) {
    console.error("Nonce generation error:", err);
    return "fallback-nonce-" + Date.now();
  }
}

const isProd = process.env.NODE_ENV === "production";

// CORS list
const DEFAULT_ALLOWED = ["http://localhost:3000"];
const ALLOWED = (process.env.CORS_ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const ALLOWLIST = new Set([...DEFAULT_ALLOWED, ...ALLOWED]);

function applyCors(req: NextRequest): NextResponse | null {
  try {
    const origin = req.headers.get("origin");
    const isPreflight =
      req.method === "OPTIONS" && req.headers.get("access-control-request-method");

    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return null;

    const allow = origin && ALLOWLIST.has(origin) ? origin : null;

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
    console.error("CORS error:", err);
    return null;
  }
}

// Simple in-memory rate limiting (ephemeral per instance)
type Bucket = { t: number[]; limit: number };
const store = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 30;
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
  } catch (err) {
    console.error("IP extraction error:", err);
    return "0.0.0.0";
  }
}

function rate(req: NextRequest): NextResponse | null {
  try {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return null;

    const limit = ROUTE_LIMITS[url.pathname] ?? DEFAULT_LIMIT;
    const ip = getClientIp(req);
    const key = `${ip}:${url.pathname}`;
    const now = Date.now();

    const b = store.get(key) ?? { t: [], limit };
    b.t = b.t.filter((x) => now - x < WINDOW_MS);
    if (b.t.length >= limit) {
      store.set(key, b);
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
    store.set(key, b);
    const remaining = limit - b.t.length;
    const resetIn = WINDOW_MS - (now - b.t[0]);

    const res = NextResponse.next();
    res.headers.set("RateLimit-Limit", String(limit));
    res.headers.set("RateLimit-Remaining", String(remaining));
    res.headers.set("RateLimit-Reset", String(Math.ceil(resetIn / 1000)));
    return res;
  } catch (err) {
    console.error("Rate limiting error:", err);
    return null;
  }
}

export function middleware(req: NextRequest) {
  try {
    const url = new URL(req.url);

    if (url.pathname.startsWith("/api/")) {
      const cors = applyCors(req);
      if (cors) return cors;

      const rl = rate(req);
      if (rl) return rl;

      return NextResponse.next();
    }

    // Pages/assets: inject CSP with per-request nonce
    const nonce = genNonce();
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "object-src 'none'",
      `script-src 'self'${isProd ? "" : " 'unsafe-eval'"} 'nonce-${nonce}' blob:`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src 'self'${isProd ? "" : " http://localhost:3000 ws://localhost:3000 ws: wss:"}`,
      "worker-src 'self' blob:",
      "frame-src 'self' blob: data:",
      "manifest-src 'self'",
      ...(isProd ? ["upgrade-insecure-requests"] : []),
    ].join("; ");

    const reqHeaders = new Headers(req.headers);
    reqHeaders.set("x-nonce", nonce);

    const res = NextResponse.next({ request: { headers: reqHeaders } });
    res.headers.set("Content-Security-Policy", csp);

    return res;
  } catch (err) {
    // Log the error with details
    console.error("Middleware critical error:", err, {
      url: req.url,
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
    });
    
    // Return a safe fallback response
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};