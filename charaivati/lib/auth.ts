import jwt from "jsonwebtoken";
import type { NextRequest } from "next/server";

/**
 * Auth helpers (JWT session + magic link)
 *
 * - createSessionToken(userId): long-lived session token (7d)
 * - verifySessionToken(token): returns normalized payload or null
 * - createMagicToken(userId): short-lived token for magic link (15m)
 * - verifyMagicToken(token): returns payload or null
 * - getUserFromReq(req): helper to extract & verify token from NextRequest or plain request-like object
 */

/* --------------------------- Config / Types --------------------------- */

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET must be set in production environment");
}

const JWT_ALG = "HS256";

export type SessionPayload = {
  sub?: string; // standard subject
  userId?: string; // legacy / alternative
  email?: string | null;
  iat?: number;
  exp?: number;
  type?: "session" | "magic";
  iss?: string;
  aud?: string;
};

export type NormalizedSession = {
  id: string;
  email?: string | null;
  iat?: number;
  exp?: number;
  type: "session" | "magic";
};

/* --------------------------- Token creators --------------------------- */

/**
 * Create a session JWT (7 days)
 */
export function createSessionToken(userId: string) {
  if (!JWT_SECRET) {
    // for dev, allow but advise
    console.warn("Warning: JWT_SECRET is not set. Tokens are created insecurely.");
  }
  const payload = { sub: userId, userId, type: "session" as const };
  return jwt.sign(payload, JWT_SECRET ?? "dev_missing_secret", {
    algorithm: JWT_ALG,
    expiresIn: "7d",
  });
}

/**
 * Create a short-lived magic link token (15 minutes)
 */
export function createMagicToken(userId: string) {
  if (!JWT_SECRET) {
    console.warn("Warning: JWT_SECRET is not set. Tokens are created insecurely.");
  }
  return jwt.sign({ sub: userId, type: "magic" as const }, JWT_SECRET ?? "dev_missing_secret", {
    algorithm: JWT_ALG,
    expiresIn: "15m",
  });
}

/* --------------------------- Verification --------------------------- */

/**
 * Verify a session token and return a normalized shape or null.
 * Accepts tokens that have:
 * - sub OR userId
 * - type === 'session' OR missing (graceful fallback)
 */
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
      iat: payload.iat,
      exp: payload.exp,
      type: "session",
    };
  } catch (_e) {
    // don't leak verification error details
    return null;
  }
}

/**
 * Verify a magic token; only accepts tokens with type === 'magic'
 */
export function verifyMagicToken(token: string): SessionPayload | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET ?? "dev_missing_secret", {
      algorithms: [JWT_ALG],
    }) as SessionPayload;
    if (payload?.type !== "magic") return null;
    return payload;
  } catch (_e) {
    return null;
  }
}

/* --------------------------- Request helpers --------------------------- */

/**
 * Extract token from a request-like object.
 * Supports:
 * - Authorization: Bearer <token>
 * - cookie 'session' or 'token' (reads raw cookie header)
 *
 * Compatible with NextRequest (App Router) or Node/Express req objects.
 */
export function getTokenFromReq(req: Request | { headers?: any; cookies?: any } | NextRequest): string | null {
  // Prefer Authorization header
  try {
    const authHeader = (req as any).headers?.get ? (req as any).headers.get("authorization") : (req as any).headers?.authorization;
    if (authHeader && typeof authHeader === "string") {
      const m = authHeader.match(/Bearer\s+(.+)/i);
      if (m) return m[1];
    }

    // NextRequest has cookies.get(name) -> Cookie | undefined
    if ((req as NextRequest).cookies && typeof (req as NextRequest).cookies.get === "function") {
      const c = (req as NextRequest).cookies.get("session") ?? (req as NextRequest).cookies.get("token");
      if (c) {
        // NextRequest cookie object has .value
        return (c as any).value ?? null;
      }
    }

    // Fallback to raw cookie header parsing (for plain Node req)
    const cookieHeader = (req as any).headers?.cookie ?? null;
    if (cookieHeader && typeof cookieHeader === "string") {
      // simple parse; do not rely on fragile parsing for production - use cookie lib if needed
      const cookies = Object.fromEntries(cookieHeader.split(";").map((c: string) => {
        const [k, ...v] = c.split("=");
        return [k.trim(), decodeURIComponent((v || []).join("="))];
      }));
      return cookies["session"] ?? cookies["token"] ?? null;
    }
  } catch (e) {
    // swallow errors, return null
    return null;
  }
  return null;
}

/**
 * getUserFromReq: convenience helper used in API routes.
 * - Accepts NextRequest (App Router) or Node req-like object.
 * - Returns { id, email?, iat?, exp? } or null.
 *
 * Note: this only verifies the JWT and returns the identity from it.
 * If you need the full User row from DB, fetch via prisma after calling this.
 */
export async function getUserFromReq(req: Request | { headers?: any; cookies?: any } | NextRequest): Promise<NormalizedSession | null> {
  const token = getTokenFromReq(req);
  if (!token) return null;
  const verified = verifySessionToken(token);
  if (!verified) return null;
  return verified;
}

/* --------------------------- Exports --------------------------- */

export default {
  createSessionToken,
  verifySessionToken,
  createMagicToken,
  verifyMagicToken,
  getTokenFromReq,
  getUserFromReq,
};
