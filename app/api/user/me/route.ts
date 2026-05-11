// app/api/user/me/route.ts
import { NextResponse } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const cookie = req.headers.get("cookie") || "";

  // Try the canonical session cookie name first, fall back to bare "session="
  const canonicalMatch = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const fallbackMatch = cookie.match(/session=([^;]+)/);
  const raw = canonicalMatch?.[1] ?? fallbackMatch?.[1] ?? null;
  const token = raw ? decodeURIComponent(raw) : null;

  const payload = await verifySessionToken(token);
  if (!payload?.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = String(payload.userId);

  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, avatarUrl: true },
    }),
    prisma.profile.findUnique({
      where: { userId },
      select: { displayName: true },
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      name: profile?.displayName || user.name || null,
      email: user.email,
      avatarUrl: user.avatarUrl ?? null,
    },
  });
}
