// app/api/user/status/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get("email") || undefined;
    if (!email) return NextResponse.json({ exists: false });

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        emailVerified: true,  // ← ADD THIS
        verified: true,       // ← ADD THIS too (if you have it)
        avatarUrl: true,
        status: true,
        deletionScheduledAt: true,
        updatedAt: true,
        lastSelectedLocalAreaId: true,
        profile: { select: { displayName: true } },
      },
    });

    if (!user) return NextResponse.json({ exists: false });

    return NextResponse.json({
      exists: true,
      emailVerified: user.emailVerified,  // ← RETURN THIS
      verified: user.verified,            // ← RETURN THIS too
      deletionScheduledAt: user.deletionScheduledAt,
      deletedAt: user.status === "deleted" ? user.updatedAt : null,
      avatarUrl: user.avatarUrl ?? null,
      name: user.profile?.displayName ?? null,
      status: user.status,
      lastSelectedLocalAreaId: user.lastSelectedLocalAreaId ?? null,
    });
  } catch (err) {
    console.error("user/status error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}