import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

// PATCH /api/section/reorder
// New body: { storeId, sections: [{ id, order, rowIndex }] }
// Legacy body: { storeId, orderedIds: string[] }
export async function PATCH(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { storeId } = body;
  if (!storeId) return NextResponse.json({ error: "storeId required" }, { status: 400 });

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store || store.ownerId !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (Array.isArray(body.sections)) {
    const sections: { id: string; order: number; rowIndex: number }[] = body.sections;
    await prisma.$transaction(
      sections.map(({ id, order, rowIndex }) =>
        prisma.storeSection.update({ where: { id }, data: { order, rowIndex } })
      )
    );
    return NextResponse.json({ ok: true });
  }

  if (Array.isArray(body.orderedIds)) {
    await prisma.$transaction(
      (body.orderedIds as string[]).map((id, index) =>
        prisma.storeSection.update({ where: { id }, data: { order: index } })
      )
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "sections or orderedIds required" }, { status: 400 });
}
