import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

// PATCH /api/block/reorder
// Body: { sectionId: string, orderedIds: string[] }
export async function PATCH(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sectionId, orderedIds } = await req.json();
  if (!sectionId || !Array.isArray(orderedIds))
    return NextResponse.json({ error: "sectionId and orderedIds required" }, { status: 400 });

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: { store: true },
  });
  if (!section || section.store.ownerId !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.$transaction(
    orderedIds.map((id: string, index: number) =>
      prisma.block.update({ where: { id }, data: { order: index } })
    )
  );

  return NextResponse.json({ ok: true });
}
