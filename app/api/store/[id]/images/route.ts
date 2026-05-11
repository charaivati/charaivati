import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

async function ownerCheck(storeId: string, userId: string) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { ownerId: true } });
  return store?.ownerId === userId;
}

// GET /api/store/[id]/images — returns all images in the store's library
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await ownerCheck(id, user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const images = await prisma.storeImage.findMany({
    where: { storeId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, imageUrl: true, imageKey: true, createdAt: true },
  });

  return NextResponse.json({ images });
}

// POST /api/store/[id]/images — save an uploaded image to the library
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await ownerCheck(id, user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, imageUrl, imageKey } = await req.json();
  if (!name?.trim() || !imageUrl) {
    return NextResponse.json({ error: "name and imageUrl required" }, { status: 400 });
  }

  const image = await prisma.storeImage.create({
    data: {
      storeId: id,
      name: name.trim(),
      imageUrl,
      imageKey: imageKey ?? null,
    },
    select: { id: true, name: true, imageUrl: true, imageKey: true, createdAt: true },
  });

  return NextResponse.json({ image }, { status: 201 });
}
