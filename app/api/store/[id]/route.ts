import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Resolve slug → real cuid if needed. A cuid is 25 chars starting with 'c',
  // all alphanumeric. Anything else is treated as a potential slug.
  const isCuid = /^c[a-z0-9]{24}$/i.test(id);
  let storeId = id;
  if (!isCuid) {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Store" WHERE slug = ${id} LIMIT 1
    `;
    if (!rows[0]?.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
    storeId = rows[0].id;
  }

  const [store, user] = await Promise.all([
    prisma.store.findUnique({
      where: { id: storeId },
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: {
            subsections: {
              orderBy: { order: "asc" },
              include: { blocks: { orderBy: { order: "asc" } } },
            },
            blocks: { where: { subsectionId: null }, orderBy: { order: "asc" } },
            filterLinks: { select: { filterId: true } },
            tiles: { orderBy: { order: "asc" } },
          },
        },
        filters: {
          orderBy: { order: "asc" },
          include: { banner: true, sections: { select: { sectionId: true } } },
        },
        banners: { where: { isGlobal: true }, take: 1 },
      },
    }),
    getServerUser(req),
  ]);

  if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch slug via raw SQL — safe with stale Prisma client
  const slugRow = await prisma.$queryRaw<{ slug: string | null }[]>`
    SELECT slug FROM "Store" WHERE id = ${storeId} LIMIT 1
  `;
  const slug = slugRow[0]?.slug ?? null;

  let pageType = "store";
  if (store.pageId) {
    const page = await prisma.page.findUnique({
      where: { id: store.pageId },
      select: { pageType: true },
    });
    pageType = page?.pageType ?? "store";
  }

  const filters = (store.filters ?? []).map((f) => ({
    ...f,
    sectionIds: f.sections.map((s) => s.sectionId),
  }));

  const globalBanner = store.banners?.[0] ?? null;

  const sections = (store.sections ?? []).map((s) => ({
    ...s,
    filterIds: s.filterLinks.map((fl) => fl.filterId),
  }));

  // Reassign rowIndex for legacy sections: if all sections
  // have rowIndex=0, treat each as its own row based on order
  const allRowZero = sections.every((s) => (s.rowIndex ?? 0) === 0);

  const processedSections =
    allRowZero && sections.length > 1
      ? sections.map((s, i) => ({ ...s, rowIndex: i }))
      : sections;

  return NextResponse.json({
    ...store,
    slug,
    sections: processedSections,
    filters,
    globalBanner,
    pageType,
    isOwner: user?.id === store.ownerId,
  });
}
