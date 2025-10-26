// app/api/user/cancel-delete/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // cancel scheduled deletion for this user
    const u = await prisma.user.update({
      where: { id: user.id },
      data: { deletionScheduledAt: null, status: "active" },
    });

    return NextResponse.json({ ok: true, user: { id: u.id, name: u.name } });
  } catch (err) {
    console.error("cancel-delete err", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
