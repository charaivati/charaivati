// app/api/user/status/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get("email") || undefined;
    if (!email) return NextResponse.json({ exists: false });

    // Include profile and the lastSelectedLocalAreaId (make sure client is generated)
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        avatarUrl: true,
        status: true,
        deletionScheduledAt: true,
        updatedAt: true,
        // new field - ensure prisma client is up-to-date (run prisma migrate/generate)
        lastSelectedLocalAreaId: true,
        // include profile's displayName
        profile: { select: { displayName: true } },
      },
    });

    if (!user) return NextResponse.json({ exists: false });

    return NextResponse.json({
      exists: true,
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
