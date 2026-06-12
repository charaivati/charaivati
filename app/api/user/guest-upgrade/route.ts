import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/hash";
import { getTokenFromRequest, verifySessionToken, createSessionToken, setSessionCookie } from "@/lib/session";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export async function POST(req: Request) {
  try {
    const token = getTokenFromRequest(req);
    const payload = await verifySessionToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.status !== "guest") {
      return NextResponse.json({ error: "Only guest accounts can be upgraded" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const username: string = String(body.username ?? "").trim();
    const password: string = String(body.password ?? "");

    if (!USERNAME_RE.test(username)) {
      return NextResponse.json(
        { error: "Username must be 3–20 characters and contain only letters, numbers, or underscores" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const existing = await prisma.user.findFirst({
      where: { name: { equals: username, mode: "insensitive" } },
    });
    if (existing) {
      return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    await prisma.user.update({
      where: { id: user.id },
      data: { name: username, passwordHash, status: "lite" },
    });

    // Re-mint the session token with updated role ("lite" instead of "guest")
    const newToken = await createSessionToken({ userId: user.id, role: "lite" });
    let res = NextResponse.json({ success: true, name: username });
    res = setSessionCookie(res, newToken);
    return res;
  } catch (err) {
    console.error("[guest-upgrade] Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
