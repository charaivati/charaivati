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
  const { pageId: rawParam } = await params;

  // Resolve slug or cuid
  const isCuid = /^c[a-z0-9]{24}$/i.test(rawParam);
  let resolvedId = rawParam;
  if (!isCuid) {
    const rows = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "Page" WHERE slug = ${rawParam} LIMIT 1`;
    if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
    resolvedId = rows[0].id;
  }

  const page = await prisma.page.findUnique({
    where: { id: resolvedId },
    select: { id: true, title: true, description: true, avatarUrl: true, ownerId: true, pageType: true, deletedAt: true },
  });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (page.pageType !== "fleet") return NextResponse.json({ error: "Not a fleet page" }, { status: 400 });

  const user = await getServerUser(req);
  const isOwner = !!user && page.ownerId === user.id;
  // A deleted fleet venture is invisible to the public; owner still sees it (manages restore via Initiative Hub / my-stores).
  if (page.deletedAt && !isOwner) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch slug (post-generate column — raw SQL)
  const slugRows = await prisma.$queryRaw<{ slug: string | null }[]>`SELECT slug FROM "Page" WHERE id = ${page.id} LIMIT 1`;
  const pageSlug = slugRows[0]?.slug ?? null;

  // Find or create the backing store
  let store = await prisma.store.findFirst({ where: { pageId: page.id } });
  if (!store && isOwner) {
    store = await prisma.store.create({
      data: { name: page.title, description: page.description ?? null, ownerId: page.ownerId!, pageId: page.id },
    });
  }

  if (!store) {
    // Public visitor, no store yet → empty list
    return NextResponse.json({ page: { title: page.title, description: page.description, avatarUrl: page.avatarUrl, slug: pageSlug }, blocks: [] });
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
    page: { title: page.title, description: page.description, avatarUrl: page.avatarUrl, slug: pageSlug },
    storeId: store.id,
    sectionId: section?.id ?? null,
    deliveryFee: (store as any).deliveryFee ?? null,
    freeDeliveryAbove: (store as any).freeDeliveryAbove ?? null,
    acceptingOrders: (store as any).acceptingOrders ?? false,
    blocks,
  });
}
