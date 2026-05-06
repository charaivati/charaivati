import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [store, user] = await Promise.all([
    prisma.store.findUnique({
      where: { id },
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
  return NextResponse.json({ ...store, sections, filters, globalBanner, pageType, isOwner: user?.id === store.ownerId });
}
