// app/api/health-business/suggestions/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function lowestTierPrice(tiers: unknown): number | null {
  if (!Array.isArray(tiers) || tiers.length === 0) return null;
  const prices = (tiers as { price?: string | number }[])
    .map((t) => parseFloat(String(t.price ?? "")))
    .filter((p) => !isNaN(p) && p > 0);
  return prices.length > 0 ? Math.min(...prices) : null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rawTags = url.searchParams.get("tags") ?? "";
    const tags = rawTags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    if (tags.length === 0) {
      return NextResponse.json({ ok: true, experts: [] });
    }

    const healthBusinesses = await prisma.healthBusiness.findMany({
      where: {
        OR: [
          { specialty: { in: tags } },
          { searchTags: { hasSome: tags } },
        ],
        page: { status: "active", id: { not: "charaivati-health" } },
      },
      select: {
        id: true,
        specialty: true,
        tiers: true,
        page: {
          select: {
            id: true,
            title: true,
            avatarUrl: true,
            viewCount: true,
            _count: { select: { followers: true } },
          },
        },
      },
      orderBy: { page: { viewCount: "desc" } },
      take: 4,
    });

    // Look up store IDs for the matched pages
    const pageIds = healthBusinesses.map((hb) => hb.page.id);
    const stores = await prisma.store.findMany({
      where: { pageId: { in: pageIds } },
      select: { id: true, pageId: true },
    });
    const storeMap = new Map(stores.map((s) => [s.pageId!, s.id]));

    const experts = healthBusinesses.map((hb) => ({
      pageId: hb.page.id,
      storeId: storeMap.get(hb.page.id) ?? null,
      title: hb.page.title,
      avatarUrl: hb.page.avatarUrl ?? null,
      specialty: hb.specialty,
      followerCount: hb.page._count.followers,
      lowestTierPrice: lowestTierPrice(hb.tiers),
    }));

    return NextResponse.json({ ok: true, experts });
  } catch (err: any) {
    console.error("GET suggestions error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
