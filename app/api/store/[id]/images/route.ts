import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import getServerUser from "@/lib/serverAuth";

async function ownerCheck(storeId: string, userId: string) {
  const store = await db.store.findUnique({ where: { id: storeId }, select: { ownerId: true } });
  return store?.ownerId === userId;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await ownerCheck(id, user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const images = await db.storeImage.findMany({
    where: { storeId: id },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, url: true, cloudinaryId: true, fileHash: true, fileName: true, uploadedAt: true },
  });

  return NextResponse.json({ images });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await ownerCheck(id, user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { url, cloudinaryId, fileHash, fileName } = await req.json();
  if (!url || !fileHash) {
    return NextResponse.json({ error: "url and fileHash required" }, { status: 400 });
  }

  const image = await db.storeImage.upsert({
    where: { storeId_fileHash: { storeId: id, fileHash } },
    create: { storeId: id, url, cloudinaryId: cloudinaryId ?? null, fileHash, fileName: fileName ?? null },
    update: { url, cloudinaryId: cloudinaryId ?? null, fileName: fileName ?? null },
    select: { id: true, url: true, cloudinaryId: true, fileHash: true, fileName: true, uploadedAt: true },
  });

  return NextResponse.json({ image }, { status: 201 });
}
