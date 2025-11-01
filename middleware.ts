// middleware.ts
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

export function middleware(req: NextRequest) {
  try {
    const url = new URL(req.url);

    if (url.pathname.startsWith("/api/")) {
      const cors = applyCors(req);
      if (cors) return cors;
      return NextResponse.next();
    }

    const nonce = isProd ? genNonce() : undefined;

    const connectSrcSite = SITE_URL ?? (isProd ? "" : "http://localhost:3000 ws://localhost:3000");
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "object-src 'none'",
      `script-src 'self'${nonce ? ` 'nonce-${nonce}'` : ""}${isProd ? "" : " 'unsafe-eval' 'unsafe-inline'"}`,
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
