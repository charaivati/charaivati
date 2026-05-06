import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ pageId: string }> }) {
  try {
    const { pageId } = await params;
    const initiative = await prisma.helpingInitiative.findUnique({
      where: { pageId },
      include: {
        objectives: {
          orderBy: { order: "asc" },
          include: { actions: { orderBy: { order: "asc" } } },
        },
        metrics: { orderBy: { createdAt: "asc" } },
        page: { select: { title: true, ownerId: true, owner: { select: { name: true, avatarUrl: true } } } },
      },
    });
    if (!initiative) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, initiative });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
