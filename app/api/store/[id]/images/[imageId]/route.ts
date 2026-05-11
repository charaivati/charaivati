import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

// DELETE /api/store/[id]/images/[imageId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { id, imageId } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const image = await prisma.storeImage.findUnique({
    where: { id: imageId },
    select: { storeId: true, store: { select: { ownerId: true } } },
  });

  if (!image || image.storeId !== id || image.store.ownerId !== user.id) {
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 403 });
  }

  await prisma.storeImage.delete({ where: { id: imageId } });
  return NextResponse.json({ ok: true });
}

// PATCH /api/store/[id]/images/[imageId] — rename
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { id, imageId } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const image = await prisma.storeImage.findUnique({
    where: { id: imageId },
    select: { storeId: true, store: { select: { ownerId: true } } },
  });

  if (!image || image.storeId !== id || image.store.ownerId !== user.id) {
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 403 });
  }

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const updated = await prisma.storeImage.update({
    where: { id: imageId },
    data: { name: name.trim() },
    select: { id: true, name: true, imageUrl: true, imageKey: true, createdAt: true },
  });

  return NextResponse.json({ image: updated });
}
