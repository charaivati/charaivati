// app/api/user/selection/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session"; // use your existing helper

export async function POST(req: Request) {
  try {
    // get user from request using your existing session helper
    const session = await getUserFromRequest(req);
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { localAreaId } = body;

    if (!localAreaId) {
      return NextResponse.json({ error: "localAreaId required" }, { status: 400 });
    }

    // update user with lastSelectedLocalAreaId
    // NOTE: ensure you've run prisma migrate/db push + prisma generate so this field exists in the client
    const updated = await prisma.user.update({
      where: { id: session.userId },
      data: {
        lastSelectedLocalAreaId: Number(localAreaId),
      },
      select: {
        id: true,
        email: true,
        lastSelectedLocalAreaId: true,
      },
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch (err) {
    console.error("save selection error", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
