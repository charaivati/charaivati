import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStoreSlugs } from "@/lib/store/getStoreSlugs";
import { getStoreGeo } from "@/lib/store/getStoreGeo";
import { haversineKm } from "@/lib/geo/haversine";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const categoryIds = (url.searchParams.get("categoryIds") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const tagIds = (url.searchParams.get("tagIds") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const addressLat = url.searchParams.get("addressLat");
  const addressLng = url.searchParams.get("addressLng");

  const and: Prisma.StoreWhereInput[] = [];
  if (categoryIds.length) {
    and.push({ categories: { some: { categoryId: { in: categoryIds } } } });
  }
  if (tagIds.length) {
    and.push({ tags: { some: { tagId: { in: tagIds } } } });
  }

  // Fleet ventures have their own dedicated page (/fleet/[pageId]) with a booking
  // flow — their backing Store row has no customer-orderable products and must
  // not surface in general store discovery (FLEET-ORDER-1 fix).
  const fleetPages = await prisma.page.findMany({ where: { pageType: "fleet" }, select: { id: true } });
  if (fleetPages.length) {
    const fleetPageIds = fleetPages.map((p) => p.id);
    and.push({ OR: [{ pageId: null }, { pageId: { notIn: fleetPageIds } }] });
  }

  const stores = await prisma.store.findMany({
    where: { deletedAt: null, ...(and.length ? { AND: and } : {}) },
    select: {
      id: true,
      name: true,
      description: true,
      sections: {
        take: 1,
        include: {
          tiles: {
            take: 1,
            orderBy: { order: "asc" },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const ids = stores.map((s) => s.id);
  const [slugs, geo, categoryLinks, tagLinks] = await Promise.all([
    getStoreSlugs(ids),
    getStoreGeo(ids),
    prisma.storeCategoryLink.findMany({ where: { storeId: { in: ids } } }),
    prisma.storeTagLink.findMany({ where: { storeId: { in: ids } } }),
  ]);

  const categoryMap: Record<string, string[]> = {};
  for (const l of categoryLinks) {
    (categoryMap[l.storeId] ??= []).push(l.categoryId);
  }
  const tagMap: Record<string, string[]> = {};
  for (const l of tagLinks) {
    (tagMap[l.storeId] ??= []).push(l.tagId);
  }

  const lat = addressLat ? parseFloat(addressLat) : null;
  const lng = addressLng ? parseFloat(addressLng) : null;

  let result = stores.map((s) => {
    const g = geo[s.id] ?? { lat: null, lng: null, acceptingOrders: false };
    const distanceKm =
      lat != null && lng != null && g.lat != null && g.lng != null
        ? haversineKm(lat, lng, g.lat, g.lng)
        : null;
    return {
      id: s.id,
      name: s.name,
      slug: slugs[s.id] ?? null,
      description: s.description,
      previewImage: s.sections[0]?.tiles[0]?.imageUrl ?? null,
      lat: g.lat,
      lng: g.lng,
      acceptingOrders: g.acceptingOrders,
      categoryIds: categoryMap[s.id] ?? [],
      tagIds: tagMap[s.id] ?? [],
      distanceKm,
    };
  });

  if (lat != null && lng != null) {
    result = result.sort(
      (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
    );
  }

  return NextResponse.json({ stores: result });
}
