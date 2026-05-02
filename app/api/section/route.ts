import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeId, title, type, sectionType, prereqIds } = await req.json();
  if (!storeId || !title?.trim())
    return NextResponse.json({ error: "storeId and title required" }, { status: 400 });

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store || store.ownerId !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const maxOrder = await prisma.storeSection.aggregate({
    where: { storeId },
    _max: { order: true },
  });

  const section = await prisma.storeSection.create({
    data: {
      storeId,
      title: title.trim(),
      type: type ?? "list",
      sectionType: sectionType ?? "module",
      prereqIds: Array.isArray(prereqIds) ? prereqIds : [],
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  return NextResponse.json(section, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sectionId } = await req.json().catch(() => ({}));
  if (!sectionId) return NextResponse.json({ error: "sectionId required" }, { status: 400 });

  const section = await prisma.storeSection.findUnique({
    where: { id: sectionId },
    include: { store: true },
  });
  if (!section || section.store.ownerId !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.storeSection.delete({ where: { id: sectionId } });
  return NextResponse.json({ ok: true });
}
