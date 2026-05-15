import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import getServerUser from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storeId = new URL(req.url).searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ error: "storeId required" }, { status: 400 });

  const store = await db.store.findUnique({ where: { id: storeId }, select: { ownerId: true } });
  if (!store || store.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const images = await db.storeImage.findMany({
    where: { storeId },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, url: true, cloudinaryId: true, fileHash: true, fileName: true, uploadedAt: true },
  });

  return NextResponse.json(images);
}
