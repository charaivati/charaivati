import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ stores: [] });

  const stores = await prisma.store.findMany({
    where: { ownerId: user.id },
    select: {
      id: true,
      name: true,
      pageId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ stores });
}

export async function DELETE(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const storeId = (body.id || "").trim();
  if (!storeId) return NextResponse.json({ error: "store_id_required" }, { status: 400 });

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { ownerId: true, pageId: true },
  });

  if (!store) return NextResponse.json({ error: "store_not_found" }, { status: 404 });
  if (store.ownerId !== user.id) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

  // Orders have no cascade from Store, so delete them first
  await prisma.order.deleteMany({ where: { storeId } });

  // Delete the store (cascades sections, blocks, cart items, wishlists, pins, etc.)
  await prisma.store.delete({ where: { id: storeId } });

  // Delete the linked page if one exists (cascades follows, initiatives, etc.)
  if (store.pageId) {
    await prisma.page.delete({ where: { id: store.pageId } }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
