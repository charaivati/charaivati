//app/api/login/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSessionToken, setSessionCookie } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email || "").trim();

    // For now: just find user by email (no password check)
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    // Create JWT token
    const token = await createSessionToken({ userId: user.id, email: user.email ?? undefined });

    // Prepare response
    const res = NextResponse.json({ ok: true, user });
    setSessionCookie(res, token); // sets the cookie in response
    return res;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
