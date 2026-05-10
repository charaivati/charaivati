import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  const { storeId } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.cartItem.findMany({
    where: { userId: user.id, storeId },
    include: {
      block: {
        select: {
          id: true,
          title: true,
          price: true,
          mediaUrl: true,
          mediaType: true,
          description: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(items);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  const { storeId } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { blockId, quantity = 1 } = await req.json();
  if (!blockId) return NextResponse.json({ error: "blockId required" }, { status: 400 });

  const item = await prisma.cartItem.upsert({
    where: { userId_blockId: { userId: user.id, blockId } },
    update: { quantity: { increment: quantity } },
    create: { userId: user.id, storeId, blockId, quantity },
    include: {
      block: {
        select: {
          id: true,
          title: true,
          price: true,
          mediaUrl: true,
          mediaType: true,
          description: true,
        },
      },
    },
  });

  return NextResponse.json(item);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  const { storeId } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { blockId } = await req.json();
  if (!blockId) return NextResponse.json({ error: "blockId required" }, { status: 400 });

  await prisma.cartItem.deleteMany({
    where: { userId: user.id, storeId, blockId },
  });

  return NextResponse.json({ ok: true });
}
