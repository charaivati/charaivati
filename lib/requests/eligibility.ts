// REQBCAST-1c — nearby-eligibility query: providers within radiusKm offering a
// given service category. Bounding-box pre-filter in SQL FIRST (cheap, index-able),
// THEN Haversine refine in JS, THEN the service-block filter.
//
// Provider eligibility (v1, store-declared): a Store with a StoreCategoryLink to
// categoryId, not soft-deleted, that has at least one StoreBlock with
// serviceType='service'. No user-level service declaration exists yet — see
// TECH_DEBT.md. Stores without lat/lng are excluded (can't measure distance).
//
// ponytail: bounding box is the v1 spatial filter — no PostGIS/GiST index yet.
// Fine until store counts grow; upgrade path is a real spatial index.
import { prisma } from "@/lib/prisma";
import { haversineKm } from "@/lib/geo/haversine";
import { Prisma } from "@prisma/client";

export type EligibleProvider = { userId: string; storeId: string; distanceKm: number };

export async function findEligibleProviders(opts: {
  categoryId: string;
  lat: number;
  lng: number;
  radiusKm: number;
  excludeUserId?: string;
}): Promise<EligibleProvider[]> {
  const { categoryId, lat, lng, radiusKm, excludeUserId } = opts;

  // Bounding box from origin + radius (1° lat ≈ 111.32 km; lng scaled by cos(lat)).
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180) || 1e-6);
  const latMin = lat - latDelta, latMax = lat + latDelta;
  const lngMin = lng - lngDelta, lngMax = lng + lngDelta;

  const rows = await prisma.$queryRaw<{ ownerId: string; storeId: string; lat: number; lng: number }[]>(
    Prisma.sql`
      SELECT s."ownerId", s.id AS "storeId", s.lat, s.lng
      FROM "Store" s
      JOIN "StoreCategoryLink" scl ON scl."storeId" = s.id AND scl."categoryId" = ${categoryId}
      WHERE s."deletedAt" IS NULL
        AND s.lat IS NOT NULL AND s.lng IS NOT NULL
        AND s.lat BETWEEN ${latMin} AND ${latMax}
        AND s.lng BETWEEN ${lngMin} AND ${lngMax}
        ${excludeUserId ? Prisma.sql`AND s."ownerId" <> ${excludeUserId}` : Prisma.empty}
        AND EXISTS (
          SELECT 1 FROM "Block" b
          WHERE b."storeId" = s.id AND b."serviceType" = 'service'
        )
    `
  );

  return rows
    .map((r) => ({
      userId: r.ownerId,
      storeId: r.storeId,
      distanceKm: Math.round(haversineKm(lat, lng, r.lat, r.lng) * 10) / 10,
    }))
    .filter((p) => p.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
