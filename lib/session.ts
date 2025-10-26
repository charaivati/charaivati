// lib/session.ts
import { SignJWT, jwtVerify, JWTPayload } from "jose";
import { NextResponse } from "next/server";
import { db } from "./db"; // your prisma client
import { SITE_URL } from "./config";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET missing in production environment");
}
const key = new TextEncoder().encode(JWT_SECRET ?? "dev_secret");

// Use canonical SITE_URL for issuer/audience when available, otherwise fallback to 'app'
const APP_ORIGIN = SITE_URL ?? process.env.APP_ORIGIN ?? "app";
const ISSUER = APP_ORIGIN;
const AUDIENCE = APP_ORIGIN;

// Use secure __Host- cookie prefix in production (requires path=/ and secure)
export const COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Host-session" : "charaivati.session";

/* ------------------------
   Types
   ------------------------ */
export interface SessionPayload extends JWTPayload {
  userId: string;
  email?: string;
  role?: string;
  [k: string]: any;
}

export type CurrentUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

/* ------------------------
   JWT helpers
   ------------------------ */
export async function createSessionToken(
  payload: SessionPayload,
  opts?: { expiresIn?: string }
) {
  const exp = opts?.expiresIn ?? "7d";
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(exp)
    .sign(key);
}

export async function verifySessionToken(
  token?: string | null
): Promise<SessionPayload | false> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const p = payload as any;
    if (!p.userId && typeof p.sub === "string") p.userId = p.sub;
    return p as SessionPayload;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[session] verifySessionToken error:", err);
    return false;
  }
}

/* ------------------------
   Cookie helpers
   ------------------------ */
export function getTokenFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${COOKIE_NAME}=`));
  return match ? match.slice(COOKIE_NAME.length + 1) : null;
}

export function setSessionCookie<T = unknown>(
  res: NextResponse<T>,
  token: string,
  opts?: { maxAge?: number }
): NextResponse<T> {
  const maxAge = opts?.maxAge ?? 60 * 60 * 24 * 7;
  const secure = process.env.NODE_ENV === "production";

  res.headers.set("Cache-Control", "no-store");
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure,
    maxAge,
    expires: new Date(Date.now() + maxAge * 1000),
    priority: "high",
  });

  return res;
}

export function clearSessionCookie<T = unknown>(res: NextResponse<T>): NextResponse<T> {
  res.headers.set("Cache-Control", "no-store");
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    expires: new Date(0),
    priority: "high",
  });
  return res;
}

/* ------------------------
   Get current user (JWT-based)
   ------------------------ */
// If you have other helpers feel free to replace the below resolver.
export async function getCurrentUser(req?: Request): Promise<CurrentUser | null> {
  try {
    if (!req) return null;

    const token = getTokenFromRequest(req);
    if (!token) return null;

    const payload = await verifySessionToken(token);
    if (!payload || !payload.userId) return null;

    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });

    return (user as CurrentUser) ?? null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[session] getCurrentUser error:", err);
    return null;
  }
}

export const getUserFromRequest = getCurrentUser;
