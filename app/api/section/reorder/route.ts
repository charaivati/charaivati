import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

// PATCH /api/section/reorder
// Body: { storeId: string, orderedIds: string[] }
export async function PATCH(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeId, orderedIds } = await req.json();
  if (!storeId || !Array.isArray(orderedIds))
    return NextResponse.json({ error: "storeId and orderedIds required" }, { status: 400 });

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store || store.ownerId !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.$transaction(
    orderedIds.map((id: string, index: number) =>
      prisma.section.update({ where: { id }, data: { order: index } })
    )
  );

  return NextResponse.json({ ok: true });
}
