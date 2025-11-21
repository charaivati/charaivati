// ============================================================================
// FILE 2: middleware.ts (UPDATED FOR SOCIAL/PROXY)
// ============================================================================
import { NextRequest, NextResponse } from "next/server";
import { SITE_URL } from "@/lib/config";

function genNonce() {
  try {
    const bytes = new Uint8Array(16);
    globalThis.crypto?.getRandomValues?.(bytes);
    return Buffer.from(bytes).toString("base64");
  } catch {
    return "fallback-nonce-" + Date.now();
  }
}

const isProd = process.env.NODE_ENV === "production";
const CSP_REPORT_ONLY = process.env.CSP_REPORT_ONLY === "1";

const DEFAULT_ALLOWED = new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);
if (SITE_URL) DEFAULT_ALLOWED.add(SITE_URL);

// Rate limiting for proxy endpoint
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string, limit: number = 100, windowMs: number = 60000): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count < limit) {
    record.count++;
    return true;
  }

  return false;
}

function applyCors(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin");
  const url = new URL(req.url);
  if (!url.pathname.startsWith("/api/")) return null;
  const allow = origin && DEFAULT_ALLOWED.has(origin) ? origin : null;
  if (!allow) return null;
  const res = NextResponse.next();
  res.headers.set("Access-Control-Allow-Origin", allow);
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set("Vary", "Origin");
  return res;
}

function validateProxyFileId(fileId: string | null): boolean {
  if (!fileId) return false;
  return /^[a-zA-Z0-9_-]+$/.test(fileId);
}

export function middleware(req: NextRequest) {
  try {
    const url = new URL(req.url);

    // Handle API routes with CORS
    if (url.pathname.startsWith("/api/")) {
      // Special handling for social proxy endpoint
      if (url.pathname === "/api/social/proxy") {
        const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

        // Rate limiting
        if (!checkRateLimit(ip, 100, 60000)) {
          return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
        }

        // Validate file ID for GET requests
        if (req.method === "GET") {
          const fileId = url.searchParams.get("id");
          if (!validateProxyFileId(fileId)) {
            return NextResponse.json({ error: "Invalid file ID format" }, { status: 400 });
          }
        }

        // Validate admin token for POST requests
        if (req.method === "POST") {
          const authHeader = req.headers.get("Authorization");
          const adminToken = process.env.ADMIN_CACHE_TOKEN;
          if (!adminToken || authHeader !== `Bearer ${adminToken}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }
        }

        // Add security headers
        const res = NextResponse.next();
        res.headers.set("X-Content-Type-Options", "nosniff");
        res.headers.set("X-Frame-Options", "DENY");
        res.headers.set("X-XSS-Protection", "1; mode=block");
        return res;
      }

      // Apply CORS to other API routes
      const cors = applyCors(req);
      if (cors) return cors;
      return NextResponse.next();
    }

    // CSP for HTML pages
    const nonce = isProd ? genNonce() : undefined;

    const connectSrcSite = SITE_URL ?? (isProd ? "" : "http://localhost:3000 ws://localhost:3000");

    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "object-src 'none'",
      `script-src 'self'${nonce ? ` 'nonce-${nonce}'` : ""}${isProd ? "" : " 'unsafe-eval' 'unsafe-inline'"} https://accounts.google.com https://apis.google.com https://accounts.google.com/gsi/client`,
      "style-src 'self' 'unsafe-inline' https://accounts.google.com",
      "img-src 'self' data: blob: https: https://drive.google.com https://lh3.googleusercontent.com https://*.googleapis.com",
      "font-src 'self' data:",
      `connect-src 'self' ${connectSrcSite} https://accounts.google.com https://www.googleapis.com https://drive.google.com https://*.google.com https://drive.google.com/uc`,
      "worker-src 'self' blob:",
      "frame-src 'self' blob: data: https://accounts.google.com https://www.youtube.com https://youtube.com",
      "manifest-src 'self'",
      ...(isProd ? ["upgrade-insecure-requests"] : []),
    ].join("; ");

    const reqHeaders = new Headers(req.headers);
    if (nonce) reqHeaders.set("x-nonce", nonce);

    const res = NextResponse.next({ request: { headers: reqHeaders } });
    res.headers.set(CSP_REPORT_ONLY ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy", csp);
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("X-XSS-Protection", "0");

    return res;
  } catch (err) {
    console.error("Middleware error:", err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
