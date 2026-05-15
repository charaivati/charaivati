import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import getServerUser from "@/lib/serverAuth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { id, imageId } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const image = await db.storeImage.findUnique({
    where: { id: imageId },
    select: { storeId: true, store: { select: { ownerId: true } } },
  });

  if (!image || image.storeId !== id || image.store.ownerId !== user.id) {
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 403 });
  }

  await db.storeImage.delete({ where: { id: imageId } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { id, imageId } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const image = await db.storeImage.findUnique({
    where: { id: imageId },
    select: { storeId: true, store: { select: { ownerId: true } } },
  });

  if (!image || image.storeId !== id || image.store.ownerId !== user.id) {
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 403 });
  }

  const { fileName } = await req.json();
  if (!fileName?.trim()) return NextResponse.json({ error: "fileName required" }, { status: 400 });

  const updated = await db.storeImage.update({
    where: { id: imageId },
    data: { fileName: fileName.trim() },
    select: { id: true, url: true, cloudinaryId: true, fileHash: true, fileName: true, uploadedAt: true },
  });

  return NextResponse.json({ image: updated });
}
