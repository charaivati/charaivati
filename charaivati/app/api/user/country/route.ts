// app/api/user/country/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

function parseCookies(cookieHeader: string | null) {
  const obj: Record<string, string> = {};
  if (!cookieHeader) return obj;
  cookieHeader.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    try { obj[key] = decodeURIComponent(val); } catch { obj[key] = val; }
  });
  return obj;
}

function extractUserIdFromSessionCookie(req: Request): string | null {
  try {
    const cookieHeader = req.headers.get("cookie");
    const cookies = parseCookies(cookieHeader);
    const token = cookies["session"] || cookies["__Host-session"] || cookies["session_token"] || cookies["sess"];
    console.debug("[extractUserIdFromSessionCookie] token found?", !!token, "cookies:", Object.keys(cookies));
    if (!token) return null;
    const payload = jwt.decode(token);
    if (!payload || typeof payload !== "object") return null;
    for (const key of ["userId", "sub", "id", "uid", "user_id"]) {
      if (key in payload) {
        const v = (payload as any)[key];
        if (typeof v === "string" && v.length) {
          console.debug("[extractUserIdFromSessionCookie] found userId via key", key, v);
          return v;
        }
        if (typeof v === "number") return String(v);
      }
    }
    if ("email" in payload && typeof (payload as any).email === "string") {
      console.debug("[extractUserIdFromSessionCookie] found email in token payload");
      return String((payload as any).email);
    }
    console.warn("[extractUserIdFromSessionCookie] no user id in token payload", payload);
    return null;
  } catch (err) {
    console.warn("extractUserIdFromSessionCookie error:", err);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const country = String(body?.country ?? "").trim();
    if (!country) {
      return NextResponse.json({ ok: false, error: "missing_country" }, { status: 400 });
    }

    const userIdOrEmail = extractUserIdFromSessionCookie(req);

    if (!userIdOrEmail) {
      console.debug("[POST /api/user/country] unauthenticated - not persisting");
      return NextResponse.json({ ok: true, persisted: false, userId: null, note: "no-auth" });
    }

    // resolve user by id or email
    let user = null;
    if (userIdOrEmail.includes("@")) {
      user = await prisma.user.findUnique({ where: { email: userIdOrEmail } });
    } else {
      user = await prisma.user.findUnique({ where: { id: userIdOrEmail } });
    }

    if (!user) {
      console.warn("[POST /api/user/country] user not found for", userIdOrEmail);
      return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
    }

    console.info(`[POST /api/user/country] updating userId=${user.id} selectedCountry=${country}`);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { selectedCountry: country } as any,
    });

    console.info(`[POST /api/user/country] persisted for userId=${user.id}`);
    return NextResponse.json({ ok: true, persisted: true, userId: user.id, country });
  } catch (err) {
    console.error("POST /api/user/country error:", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const userIdOrEmail = extractUserIdFromSessionCookie(req);
    if (!userIdOrEmail) {
      return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
    }
    let user = null;
    if (userIdOrEmail.includes("@")) {
      user = await prisma.user.findUnique({ where: { email: userIdOrEmail }, select: { selectedCountry: true } });
    } else {
      user = await prisma.user.findUnique({ where: { id: userIdOrEmail }, select: { selectedCountry: true } });
    }
    return NextResponse.json({ ok: true, selectedCountry: user?.selectedCountry ?? null });
  } catch (err) {
    console.error("GET /api/user/country error:", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
