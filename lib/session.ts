import { SignJWT, jwtVerify, JWTPayload } from "jose";
import { NextResponse } from "next/server";
import { db } from "./db";
import { SITE_URL } from "./config";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable must be set in production.");
  }
  console.warn("JWT_SECRET is not set. Using insecure fallback — development only.");
}
const _jwtSecret = JWT_SECRET ?? "dev_insecure_fallback_not_for_prod";
const key = new TextEncoder().encode(_jwtSecret);

const APP_ORIGIN = SITE_URL ?? process.env.APP_ORIGIN ?? "app";

export const COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Host-session"
    : "charaivati.session";

export interface SessionPayload extends JWTPayload {
  userId: string;
  email?: string;
  role?: string;
}

export async function createSessionToken(
  payload: SessionPayload,
  opts?: { expiresIn?: string }
) {
  const exp = opts?.expiresIn ?? "7d";

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setIssuer(APP_ORIGIN)
    .setAudience(APP_ORIGIN)
    .setExpirationTime(exp)
    .sign(key);
}

export async function verifySessionToken(
  token?: string | null
): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      issuer: APP_ORIGIN,
      audience: APP_ORIGIN,
    });

    const p = payload as any;

    if (!p.userId && typeof p.sub === "string") {
      p.userId = p.sub;
    }

    return p as SessionPayload;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") || "";

  const match = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${COOKIE_NAME}=`));

  return match ? match.slice(COOKIE_NAME.length + 1) : null;
}

export function setSessionCookie<T>(
  res: NextResponse<T>,
  token: string,
  opts?: { maxAge?: number }
) {
  const maxAge = opts?.maxAge ?? 60 * 60 * 24 * 7;

  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  return res;
}

export function clearSessionCookie<T>(res: NextResponse<T>) {
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });

  return res;
}

export async function getCurrentUser(req?: Request) {
  if (!req) return null;

  const token = getTokenFromRequest(req);

  const payload = await verifySessionToken(token);

  if (!payload?.userId) return null;

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
    },
  });

  return user ?? null;
}