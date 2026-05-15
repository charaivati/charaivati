import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import getServerUser from "@/lib/serverAuth";

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeId, url, cloudinaryId, fileHash, fileName } = await req.json();
  if (!storeId || !url || !fileHash) {
    return NextResponse.json({ error: "storeId, url, and fileHash required" }, { status: 400 });
  }

  const store = await db.store.findUnique({ where: { id: storeId }, select: { ownerId: true } });
  if (!store || store.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const image = await db.storeImage.upsert({
    where: { storeId_fileHash: { storeId, fileHash } },
    create: { storeId, url, cloudinaryId: cloudinaryId ?? null, fileHash, fileName: fileName ?? null },
    update: { url, cloudinaryId: cloudinaryId ?? null, fileName: fileName ?? null },
    select: { id: true, url: true, cloudinaryId: true, fileHash: true, fileName: true, uploadedAt: true },
  });

  return NextResponse.json(image, { status: 201 });
}
