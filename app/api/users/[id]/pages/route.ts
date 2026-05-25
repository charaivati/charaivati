import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

const SHOWN_PAGE_TYPES = ["store", "fleet", "service", "helping"];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const pages = await db.page.findMany({
    where: {
      ownerId: id,
      status: "active",
      pageType: { in: SHOWN_PAGE_TYPES },
    },
    select: {
      id: true,
      title: true,
      description: true,
      avatarUrl: true,
      pageType: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (pages.length === 0) {
    return NextResponse.json({ pages: [] });
  }

  const storePageIds = pages.filter((p) => p.pageType === "store").map((p) => p.id);
  const storeByPageId: Record<string, { id: string; slug: string | null }> = {};

  if (storePageIds.length > 0) {
    const rows = await db.$queryRaw<{ pageId: string; id: string; slug: string | null }[]>`
      SELECT "pageId", id, slug FROM "Store"
      WHERE "pageId" IN (${Prisma.join(storePageIds)})
    `;
    for (const row of rows) {
      storeByPageId[row.pageId] = { id: row.id, slug: row.slug };
    }
  }

  const result = pages.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description ?? null,
    avatarUrl: p.avatarUrl ?? null,
    pageType: p.pageType,
    storeSlug: p.pageType === "store" ? (storeByPageId[p.id]?.slug ?? null) : null,
    storeId: p.pageType === "store" ? (storeByPageId[p.id]?.id ?? null) : null,
  }));

  return NextResponse.json({ pages: result });
}
