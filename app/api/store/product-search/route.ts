import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";
import { getStoreSlugs } from "@/lib/store/getStoreSlugs";
import { haversineKm } from "@/lib/geo/haversine";
import { Prisma } from "@prisma/client";

type BlockRow = {
  blockId: string;
  title: string;
  description: string | null;
  price: number | null;
  mediaUrl: string | null;
  storeId: string;
  storeLat: number | null;
  storeLng: number | null;
};

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const addressLat = parseFloat(url.searchParams.get("addressLat") || "");
  const addressLng = parseFloat(url.searchParams.get("addressLng") || "");
  const hasCoords = !isNaN(addressLat) && !isNaN(addressLng);

  const categoryIds = (url.searchParams.get("categoryIds") || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "30"), 100);
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0"), 0);

  // Resolve the current user's own store IDs so we can exclude them
  const myStores = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT id FROM "Store" WHERE "ownerId" = ${payload.userId} AND "deletedAt" IS NULL`
  );
  const myStoreIds = myStores.map((s) => s.id);

  // Resolve storeIds that carry the requested categories (category proxy)
  let categoryStoreIds: string[] | null = null;
  if (categoryIds.length) {
    const rows = await prisma.$queryRaw<{ storeId: string }[]>(
      Prisma.sql`
        SELECT DISTINCT "storeId"
        FROM "StoreCategoryLink"
        WHERE "categoryId" = ANY(${categoryIds}::text[])
          AND "storeId" NOT IN (
            SELECT id FROM "Store" WHERE "deletedAt" IS NOT NULL
          )
      `
    );
    categoryStoreIds = rows.map((r) => r.storeId);
    if (categoryStoreIds.length === 0) {
      return NextResponse.json({ products: [] });
    }
  }

  // Build the core query
  // Conditions: serviceType='product', visibility='public', price IS NOT NULL,
  //             store not deleted, store not owned by caller
  const conditions: Prisma.Sql[] = [
    Prisma.sql`b."serviceType" = 'product'`,
    Prisma.sql`b."visibility" = 'public'`,
    Prisma.sql`b.price IS NOT NULL`,
    Prisma.sql`b."storeId" IS NOT NULL`,
    Prisma.sql`s."deletedAt" IS NULL`,
  ];

  if (myStoreIds.length) {
    conditions.push(
      Prisma.sql`b."storeId" NOT IN (${Prisma.join(myStoreIds.map((id) => Prisma.sql`${id}`))})`
    );
  }

  if (q) {
    conditions.push(
      Prisma.sql`b.search_vector @@ websearch_to_tsquery('english', ${q})`
    );
  }

  if (categoryStoreIds !== null) {
    conditions.push(
      Prisma.sql`b."storeId" = ANY(${categoryStoreIds}::text[])`
    );
  }

  const whereClause = Prisma.sql`${Prisma.join(conditions, " AND ")}`;

  const rows = await prisma.$queryRaw<BlockRow[]>(
    Prisma.sql`
      SELECT DISTINCT ON (b.id)
        b.id         AS "blockId",
        b.title,
        b.description,
        b.price,
        b."mediaUrl",
        b."storeId",
        s.lat        AS "storeLat",
        s.lng        AS "storeLng"
      FROM "Block" b
      JOIN "Store" s ON s.id = b."storeId"
      WHERE ${whereClause}
      ORDER BY b.id
      LIMIT ${limit} OFFSET ${offset}
    `
  );

  if (!rows.length) return NextResponse.json({ products: [] });

  // Inject slugs and store names
  const storeIds = [...new Set(rows.map((r) => r.storeId))];
  const [slugMap, storeNameRows] = await Promise.all([
    getStoreSlugs(storeIds),
    prisma.$queryRaw<{ id: string; name: string }[]>(
      Prisma.sql`SELECT id, name FROM "Store" WHERE id IN (${Prisma.join(storeIds.map((id) => Prisma.sql`${id}`))})`
    ),
  ]);
  const storeNames = Object.fromEntries(storeNameRows.map((r) => [r.id, r.name]));

  const products = rows.map((r) => {
    let distanceKm: number | null = null;
    if (hasCoords && r.storeLat != null && r.storeLng != null) {
      distanceKm = Math.round(haversineKm(addressLat, addressLng, r.storeLat, r.storeLng) * 10) / 10;
    }
    return {
      blockId: r.blockId,
      title: r.title,
      description: r.description,
      price: r.price,
      mediaUrl: r.mediaUrl,
      storeId: r.storeId,
      storeName: storeNames[r.storeId] ?? null,
      storeSlug: slugMap[r.storeId] ?? null,
      distanceKm,
    };
  });

  // Sort by distance when coords are present (nulls last)
  if (hasCoords) {
    products.sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });
  }

  return NextResponse.json({ products });
}
