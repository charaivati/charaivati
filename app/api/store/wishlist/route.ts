import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.wishlistItem.findMany({
    where: { userId: user.id },
    include: {
      block: {
        select: {
          id: true,
          title: true,
          price: true,
          mediaUrl: true,
          mediaType: true,
        },
      },
      store: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { blockId, storeId } = await req.json();
  if (!blockId || !storeId) {
    return NextResponse.json({ error: "blockId and storeId required" }, { status: 400 });
  }

  const existing = await prisma.wishlistItem.findUnique({
    where: { userId_blockId: { userId: user.id, blockId } },
  });

  if (existing) {
    await prisma.wishlistItem.delete({
      where: { userId_blockId: { userId: user.id, blockId } },
    });
    return NextResponse.json({ wishlisted: false });
  }

  await prisma.wishlistItem.create({
    data: { userId: user.id, blockId, storeId },
  });

  return NextResponse.json({ wishlisted: true });
}
