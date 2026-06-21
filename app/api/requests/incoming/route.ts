import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { authUserId, expireStale, categoryTitles } from "@/lib/requests/common";
import { haversineKm } from "@/lib/geo/haversine";

// GET /api/requests/incoming?locale=xx — open broadcasts the current user is an
// eligible provider for (reverse of the fan-out eligibility query). One card per
// broadcast, nearest matching store chosen as the default respond-as store.
export async function GET(req: NextRequest) {
  const userId = await authUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const locale = (new URL(req.url).searchParams.get("locale") || "en").trim() || "en";

  await expireStale();

  // My (store, category) offerings with coordinates. REQBCAST-1e: track service vs
  // delivery capability per store — service broadcasts need a service block; errands
  // accept either (delivery runners qualify).
  // FLEET-STATE-1b P1 — ADDITIVE live presence (mirror of findEligibleProviders):
  // if I have a fresh available presence, all my stores effectively report from my
  // live position; otherwise each store's static coords. No presence row → unchanged.
  const offerings = await prisma.$queryRaw<{ storeId: string; storeName: string; lat: number; lng: number; categoryId: string; hasService: boolean; hasDelivery: boolean }[]>(
    Prisma.sql`
      SELECT s.id AS "storeId", s.name AS "storeName",
             COALESCE(pp.lat, s.lat) AS lat, COALESCE(pp.lng, s.lng) AS lng,
             scl."categoryId",
             EXISTS (SELECT 1 FROM "Block" b WHERE b."storeId" = s.id AND b."serviceType" = 'service') AS "hasService",
             EXISTS (SELECT 1 FROM "Block" b WHERE b."storeId" = s.id AND b."serviceType" = 'delivery') AS "hasDelivery"
      FROM "Store" s
      JOIN "StoreCategoryLink" scl ON scl."storeId" = s.id
      LEFT JOIN "ProviderPresence" pp ON pp."userId" = s."ownerId"
        AND pp.mode = 'available'
        AND pp."seenAt" > NOW() - INTERVAL '5 minutes'
        AND pp.lat IS NOT NULL AND pp.lng IS NOT NULL
      WHERE s."ownerId" = ${userId} AND s."deletedAt" IS NULL
        AND COALESCE(pp.lat, s.lat) IS NOT NULL AND COALESCE(pp.lng, s.lng) IS NOT NULL
        AND EXISTS (SELECT 1 FROM "Block" b WHERE b."storeId" = s.id AND b."serviceType" IN ('service','delivery'))
    `
  );
  if (!offerings.length) return NextResponse.json({ broadcasts: [] });

  const byCategory: Record<string, typeof offerings> = {};
  for (const o of offerings) (byCategory[o.categoryId] ||= []).push(o);
  const myCategoryIds = Object.keys(byCategory);

  const open = await prisma.$queryRaw<{
    id: string; requesterId: string; requesterName: string | null; categoryId: string; kind: string;
    title: string; description: string | null; addressLat: number | null; addressLng: number | null;
    radiusKm: number; createdAt: Date; expiresAt: Date | null;
    pickupLabel: string | null; dropLabel: string | null; suggestedPrice: number | null;
  }[]>(
    Prisma.sql`
      SELECT rb.id, rb."requesterId", u.name AS "requesterName", rb."categoryId", rb.kind, rb.title, rb.description,
             rb."addressLat", rb."addressLng", rb."radiusKm", rb."createdAt", rb."expiresAt",
             rb."pickupLabel", rb."dropLabel", rb."suggestedPrice"
      FROM "RequestBroadcast" rb
      JOIN "User" u ON u.id = rb."requesterId"
      WHERE rb.status = 'open' AND rb."requesterId" <> ${userId}
        AND rb."categoryId" = ANY(${myCategoryIds}::text[])
      ORDER BY rb."createdAt" DESC
      LIMIT 100
    `
  );
  if (!open.length) return NextResponse.json({ broadcasts: [] });

  // My existing responses on these broadcasts.
  const myResponses = await prisma.$queryRaw<{ broadcastId: string; status: string }[]>(
    Prisma.sql`SELECT "broadcastId", status FROM "RequestResponse" WHERE "providerId" = ${userId} AND "broadcastId" = ANY(${open.map((o) => o.id)}::text[])`
  );
  const respStatus = Object.fromEntries(myResponses.map((r) => [r.broadcastId, r.status]));

  const eligible = open
    .map((b) => {
      // For errands addressLat/Lng = pickup (set at create) — distance is from pickup.
      if (b.addressLat == null || b.addressLng == null) return null;
      // nearest of my stores that serves this category, qualifies for the kind, and is within radius
      let best: { storeId: string; storeName: string; distanceKm: number } | null = null;
      for (const o of byCategory[b.categoryId] || []) {
        const qualifies = b.kind === "errand" ? (o.hasService || o.hasDelivery) : o.hasService;
        if (!qualifies) continue;
        const d = Math.round(haversineKm(b.addressLat, b.addressLng, o.lat, o.lng) * 10) / 10;
        if (d <= b.radiusKm && (!best || d < best.distanceKm)) best = { storeId: o.storeId, storeName: o.storeName, distanceKm: d };
      }
      if (!best) return null;
      return { ...b, ...best, myResponseStatus: respStatus[b.id] ?? null };
    })
    .filter(Boolean) as (typeof open[number] & { storeId: string; storeName: string; distanceKm: number; myResponseStatus: string | null })[];

  const titles = await categoryTitles([...new Set(eligible.map((b) => b.categoryId))], locale);
  const out = eligible.map((b) => ({ ...b, categoryTitle: titles[b.categoryId] ?? b.categoryId }));

  return NextResponse.json({ broadcasts: out });
}
