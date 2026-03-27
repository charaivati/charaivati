// app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { createSessionToken, COOKIE_NAME } from "@/lib/session";

type Body = { email?: string; password?: string };

const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (!body?.email || !body?.password) {
      return NextResponse.json({ ok: false, error: "Missing credentials" }, { status: 400 });
    }

    const email = String(body.email).trim().toLowerCase();
    const user  = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash) {
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    const token = await createSessionToken(
      { userId: user.id, email: user.email ?? undefined },
      { expiresIn: "7d" }
    );

    // Audit log — non-fatal
    try {
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action:  "session.create",
          entity:  "session",
          entityId: token,
          data:    { ip: req.headers.get("x-forwarded-for") ?? "unknown" },
        },
      });
    } catch (err) {
      console.warn("auditLog write failed:", err);
    }

    // Build response manually — do NOT use setSessionCookie(NextResponse.json(...))
    // because Next.js can silently drop cookie mutations on frozen response objects.
    const response = new NextResponse(
      JSON.stringify({ ok: true, redirect: "/self" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      // __Host- prefix (production) requires secure:true + path:"/" + no domain
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    });

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}