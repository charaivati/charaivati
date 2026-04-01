import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeId, title, type } = await req.json();
  if (!storeId || !title?.trim())
    return NextResponse.json({ error: "storeId and title required" }, { status: 400 });

  // Only owner can add sections
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store || store.ownerId !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const maxOrder = await prisma.section.aggregate({
    where: { storeId },
    _max: { order: true },
  });

  const section = await prisma.section.create({
    data: {
      storeId,
      title: title.trim(),
      type: type ?? "list",
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  return NextResponse.json(section, { status: 201 });
}
