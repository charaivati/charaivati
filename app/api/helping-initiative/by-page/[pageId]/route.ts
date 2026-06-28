import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ pageId: string }> }) {
  try {
    const { pageId: rawParam } = await params;

    // Resolve slug or cuid
    const isCuid = /^c[a-z0-9]{24}$/i.test(rawParam);
    let resolvedPageId = rawParam;
    if (!isCuid) {
      const rows = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "Page" WHERE slug = ${rawParam} LIMIT 1`;
      if (!rows[0]) return NextResponse.json({ error: "not_found" }, { status: 404 });
      resolvedPageId = rows[0].id;
    }

    const initiative = await prisma.helpingInitiative.findUnique({
      where: { pageId: resolvedPageId },
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

    // Include slug in response
    const slugRows = await prisma.$queryRaw<{ slug: string | null }[]>`SELECT slug FROM "Page" WHERE id = ${initiative.pageId} LIMIT 1`;
    return NextResponse.json({ ok: true, initiative: { ...initiative, slug: slugRows[0]?.slug ?? null } });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
