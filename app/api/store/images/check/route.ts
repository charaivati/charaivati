import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import getServerUser from "@/lib/serverAuth";

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeId, fileHash } = await req.json();
  if (!storeId || !fileHash) {
    return NextResponse.json({ error: "storeId and fileHash required" }, { status: 400 });
  }

  const store = await db.store.findUnique({ where: { id: storeId }, select: { ownerId: true } });
  if (!store || store.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await db.storeImage.findUnique({
    where: { storeId_fileHash: { storeId, fileHash } },
    select: { id: true, url: true, cloudinaryId: true, fileHash: true, fileName: true, uploadedAt: true },
  });

  if (existing) return NextResponse.json({ exists: true, image: existing });
  return NextResponse.json({ exists: false });
}
