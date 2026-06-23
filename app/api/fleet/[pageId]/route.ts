import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

// GET /api/fleet/[pageId]
// Owner: returns storeId, default sectionId, and all delivery blocks.
// Creates the store and a default section if they don't exist yet.
// Public: called without auth returns only public blocks + page info.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const { pageId } = await params;

  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { id: true, title: true, description: true, avatarUrl: true, ownerId: true, pageType: true, deletedAt: true },
  });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (page.pageType !== "fleet") return NextResponse.json({ error: "Not a fleet page" }, { status: 400 });

  const user = await getServerUser(req);
  const isOwner = !!user && page.ownerId === user.id;
  // A deleted fleet venture is invisible to the public; owner still sees it (manages restore via Initiative Hub / my-stores).
  if (page.deletedAt && !isOwner) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Find or create the backing store
  let store = await prisma.store.findFirst({ where: { pageId } });
  if (!store && isOwner) {
    store = await prisma.store.create({
      data: { name: page.title, description: page.description ?? null, ownerId: page.ownerId!, pageId },
    });
  }

  if (!store) {
    // Public visitor, no store yet → empty list
    return NextResponse.json({ page: { title: page.title, description: page.description, avatarUrl: page.avatarUrl }, blocks: [] });
  }

  // Ensure a default section exists (hidden from normal store view)
  let section = await prisma.storeSection.findFirst({ where: { storeId: store.id }, orderBy: { order: "asc" } });
  if (!section && isOwner) {
    section = await prisma.storeSection.create({
      data: { storeId: store.id, title: "Fleet Services", order: 0 },
    });
  }

  // Fetch all delivery blocks from all sections of this store
  const blocks = await prisma.storeBlock.findMany({
    where: {
      section: { storeId: store.id },
      serviceType: "delivery",
      ...(isOwner ? {} : { visibility: "public" }),
    },
    orderBy: { order: "asc" },
  });

  return NextResponse.json({
    page: { title: page.title, description: page.description, avatarUrl: page.avatarUrl },
    storeId: store.id,
    sectionId: section?.id ?? null,
    deliveryFee: (store as any).deliveryFee ?? null,
    freeDeliveryAbove: (store as any).freeDeliveryAbove ?? null,
    acceptingOrders: (store as any).acceptingOrders ?? false,
    blocks,
  });
}
