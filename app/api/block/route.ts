import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sectionId, subsectionId, title, description, mediaType, mediaUrl, actionType, price } =
    await req.json();

  if (!title?.trim())
    return NextResponse.json({ error: "title required" }, { status: 400 });
  if (!sectionId && !subsectionId)
    return NextResponse.json({ error: "sectionId or subsectionId required" }, { status: 400 });

  // Verify ownership via the section → store chain
  if (sectionId) {
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: { store: true },
    });
    if (!section || section.store.ownerId !== user.id)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const maxOrder = await prisma.block.aggregate({
    where: sectionId ? { sectionId } : { subsectionId },
    _max: { order: true },
  });

  const block = await prisma.block.create({
    data: {
      sectionId: sectionId ?? null,
      subsectionId: subsectionId ?? null,
      title: title.trim(),
      description: description?.trim() ?? null,
      mediaType: mediaType ?? "image",
      mediaUrl: mediaUrl?.trim() ?? null,
      actionType: actionType ?? "view",
      price: price != null ? Number(price) : null,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  return NextResponse.json(block, { status: 201 });
}
