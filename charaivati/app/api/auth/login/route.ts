// app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { createSessionToken, setSessionCookie } from "@/lib/session";

type Body = { email?: string; password?: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (!body?.email || !body?.password) {
      return NextResponse.json({ ok: false, error: "Missing credentials" }, { status: 400 });
    }

    const email = String(body.email).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    // create JWT session token
    const token = await createSessionToken({ userId: user.id, email: user.email ?? undefined }, { expiresIn: "7d" });

    // Optional: write an audit log row referencing the token for debugging / ability to list sessions
    // This stores the JWT in AuditLog.entityId — safe but optional. Remove if you don't want tokens in DB.
    try {
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: "session.create",
          entity: "session",
          entityId: token,
          data: { ip: "local" },
        },
      });
    } catch (err) {
      // non-fatal — don't block login if audit write fails
      console.warn("auditLog write failed:", err);
    }

    let res = NextResponse.json({ ok: true, user: { id: user.id, name: user.name }, redirect: "/user" });

    // Set cookie via helper (ensures same cookie name and attributes as verify/create use)
    res = setSessionCookie(res, token);

    return res;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
