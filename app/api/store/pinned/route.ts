import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ pinned: [] });

  const pinned = await prisma.pinnedStore.findMany({
    where: { userId: user.id },
    include: {
      store: {
        select: {
          id: true, name: true,
          description: true,
          sections: {
            take: 1,
            include: {
              tiles: { take: 1, orderBy: { order: "asc" } }
            }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    pinned: pinned.map(p => ({
      storeId: p.storeId,
      storeName: p.store.name,
      description: p.store.description,
      previewImage: p.store.sections[0]?.tiles[0]?.imageUrl ?? null,
      pinnedAt: p.createdAt,
    }))
  });
}

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeId } = await req.json();
  if (!storeId)
    return NextResponse.json({ error: "storeId required" }, { status: 400 });

  const existing = await prisma.pinnedStore.findUnique({
    where: { userId_storeId: { userId: user.id, storeId } }
  });

  if (existing) {
    await prisma.pinnedStore.delete({
      where: { userId_storeId: { userId: user.id, storeId } }
    });
    return NextResponse.json({ pinned: false });
  }

  await prisma.pinnedStore.create({
    data: { userId: user.id, storeId }
  });
  return NextResponse.json({ pinned: true });
}
