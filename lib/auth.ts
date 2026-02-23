// lib/auth.ts
import jwt from "jsonwebtoken";
import type { NextRequest } from "next/server";
import { SITE_URL } from "./config";
import { prisma } from "./prisma";
import type { User } from "@prisma/client";

/**
 * Auth helpers (JWT session + magic link)
 *
 * - createSessionToken(userId): long-lived session token (7d)
 * - verifySessionToken(token): returns normalized payload or null
 * - createMagicToken(userId): short-lived token for magic link (15m)
 * - verifyMagicToken(token): returns payload or null
 * - getTokenFromReq(req): helper to extract & verify token from request
 * - getUserFromReq(req): resolves the logged-in user
 */

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  // In production, fail early if JWT_SECRET not set
  throw new Error("JWT_SECRET must be set in production environment");
}

const JWT_ALG = "HS256";

export type SessionPayload = {
  sub?: string;
  userId?: string;
  email?: string | null;
  role?: string;
  iat?: number;
  exp?: number;
  type?: "session" | "magic";
  iss?: string;
  aud?: string;
};

export type NormalizedSession = {
  id: string;
  email?: string | null;
  role?: string;
  iat?: number;
  exp?: number;
  type: "session" | "magic";
};

// ---------------------------------------------------------------------------
// JWT token helpers
// ---------------------------------------------------------------------------

// Create a session JWT (7 days)
export function createSessionToken(userId: string) {
  if (!JWT_SECRET) {
    console.warn("Warning: JWT_SECRET is not set. Tokens created insecurely.");
  }
  const payload: any = { sub: userId, userId, type: "session" as const };
  if (SITE_URL) {
    payload.iss = SITE_URL;
    payload.aud = SITE_URL;
  }
  return jwt.sign(payload, JWT_SECRET ?? "dev_missing_secret", {
    algorithm: JWT_ALG,
    expiresIn: "7d",
  });
}

// Create a short-lived magic link token (15 minutes)
export function createMagicToken(userId: string) {
  if (!JWT_SECRET) {
    console.warn("Warning: JWT_SECRET is not set. Tokens created insecurely.");
  }
  const payload: any = { sub: userId, type: "magic" as const };
  if (SITE_URL) {
    payload.iss = SITE_URL;
    payload.aud = SITE_URL;
  }
  return jwt.sign(payload, JWT_SECRET ?? "dev_missing_secret", {
    algorithm: JWT_ALG,
    expiresIn: "15m",
  });
}

// Verify a session token (for cookies, etc.)
export function verifySessionToken(token: string): NormalizedSession | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET ?? "dev_missing_secret", {
      algorithms: [JWT_ALG],
    }) as SessionPayload;

    const userId = payload?.sub ?? payload?.userId ?? null;
    const type = (payload?.type as SessionPayload["type"]) ?? "session";
    if (!userId) return null;
    if (type !== "session" && type !== undefined) return null;

    return {
      id: userId,
      email: payload.email ?? null,
      role: payload.role,
      iat: payload.iat,
      exp: payload.exp,
      type: "session",
    };
  } catch {
    return null;
  }
}

// Verify a short-lived magic link token
export function verifyMagicToken(token: string): SessionPayload | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET ?? "dev_missing_secret", {
      algorithms: [JWT_ALG],
    }) as SessionPayload;
    if (payload?.type !== "magic") return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

/**
 * Extract token from a request-like object.
 * Supports:
 * - Authorization: Bearer <token>
 * - cookie 'session' or 'token' (reads raw cookie header)
 */
export function getTokenFromReq(
  req: Request | { headers?: any; cookies?: any } | NextRequest
): string | null {
  try {
    const authHeader =
      (req as any).headers?.get?.("authorization") ??
      (req as any).headers?.authorization;
    if (authHeader && typeof authHeader === "string") {
      const m = authHeader.match(/Bearer\s+(.+)/i);
      if (m) return m[1];
    }

    if ((req as NextRequest).cookies && typeof (req as NextRequest).cookies.get === "function") {
      const c =
        (req as NextRequest).cookies.get("session") ??
        (req as NextRequest).cookies.get("token");
      if (c) return (c as any).value ?? null;
    }

    const cookieHeader = (req as any).headers?.cookie ?? null;
    if (cookieHeader && typeof cookieHeader === "string") {
      const cookies = Object.fromEntries(
        cookieHeader.split(";").map((c: string) => {
          const [k, ...v] = c.split("=");
          return [k.trim(), decodeURIComponent((v || []).join("="))];
        })
      );
      return cookies["session"] ?? cookies["token"] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Get the currently authenticated user from a request.
 */
export async function getUserFromReq(
  req?: Request | { headers?: any; cookies?: any } | NextRequest
): Promise<User | null> {
  try {
    if (!req) return null;
    const token = getTokenFromReq(req);
    if (!token) return null;

    const session = verifySessionToken(token);
    if (!session?.id) return null;
    const method = (req as any)?.method;
    if (session.role === "guest" && method && method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
    });

    return user ?? null;
  } catch (err) {
    console.error("getUserFromReq error:", (err as any)?.message || err);
    return null;
  }
}
