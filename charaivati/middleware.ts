// middleware.ts
import { NextRequest, NextResponse } from "next/server";

// ---------------- Utilities ----------------
function genNonce() {
  // 16 random bytes → base64 (works in edge runtime)
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64");
}

const isProd = process.env.NODE_ENV === "production";

// ---------------- CORS ----------------
const DEFAULT_ALLOWED = ["http://localhost:3000"]; // dev default
const ALLOWED = (process.env.CORS_ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const ALLOWLIST = new Set([...DEFAULT_ALLOWED, ...ALLOWED]);

function applyCors(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin");
  const isPreflight =
    req.method === "OPTIONS" &&
    req.headers.get("access-control-request-method");

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
}

// ---------------- Rate Limit ----------------
type Bucket = { t: number[]; limit: number };
const store = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 30;
const ROUTE_LIMITS: Record<string, number> = {
  "/api/auth/verify": 10,
};

function getClientIp(req: NextRequest) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "0.0.0.0"
  );
}

function rate(req: NextRequest): NextResponse | null {
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
}

// ---------------- Main middleware ----------------
export function middleware(req: NextRequest) {
  const url = new URL(req.url);

  // 1) API: CORS / Rate limit only on /api/*
  if (url.pathname.startsWith("/api/")) {
    const cors = applyCors(req);
    if (cors) return cors;

    const rl = rate(req);
    if (rl) return rl;

    // No CSP changes needed for API JSON; let it pass.
    return NextResponse.next();
  }

  // 2) Pages/assets: inject CSP with per-request nonce
  const nonce = genNonce();

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",          // block embedding; change to 'self' if you allow iframes on same origin
    "form-action 'self'",
    "object-src 'none'",               // hardening
    // Dev keeps 'unsafe-eval' for HMR; NO 'unsafe-inline' (nonce instead). Add blob: for dev blobs.
    `script-src 'self'${isProd ? "" : " 'unsafe-eval'"} 'nonce-${nonce}' blob:`,
    "style-src 'self' 'unsafe-inline'",// keep until all styles are external/hashed
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${isProd ? "" : " http://localhost:3000 ws://localhost:3000 ws: wss:"}`,
    "worker-src 'self' blob:",
    "frame-src 'self' blob: data:",
    "manifest-src 'self'",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  // Forward the nonce to the app via a request header so you can use it in layout if needed.
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-nonce", nonce);

  const res = NextResponse.next({ request: { headers: reqHeaders } });

  // Set CSP and keep your other security headers (except CSP in next.config.js)
  res.headers.set("Content-Security-Policy", csp);
  // You may also set X-Content-Type-Options / Referrer-Policy here if not set elsewhere.

  return res;
}

// Run on everything so pages get CSP, but the code above gates API-only logic.
export const config = {
  matcher: ["/:path*"],
};
