// REQBCAST-1c — nearby-eligibility query: providers within radiusKm offering a
// given service category. Bounding-box pre-filter in SQL FIRST (cheap, index-able),
// THEN Haversine refine in JS, THEN the service-block filter.
//
// Provider eligibility (v1, store-declared): a Store with a StoreCategoryLink to
// categoryId, not soft-deleted, that has at least one StoreBlock with
// serviceType='service'. No user-level service declaration exists yet — see
// TECH_DEBT.md.
//
// FLEET-STATE-1b P1 — ADDITIVE live presence: the matched position is a FRESH
// AVAILABLE ProviderPresence (mode='available' AND seenAt within 5 min) if one
// exists, ELSE the static Store.lat/lng. COALESCE(presence, store) does this —
// a provider with NO presence row behaves EXACTLY as before. Presence is never
// required (that would silently un-match every non-moving provider). The 5-min
// freshness is judged here at read time, not by a scheduler.
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
  // REQBCAST-1e: service requests match 'service' providers (unchanged); errands
  // also match 'delivery' providers (the runners). Defaults keep service behavior.
  serviceTypes?: string[];
}): Promise<EligibleProvider[]> {
  const { categoryId, lat, lng, radiusKm, excludeUserId, serviceTypes = ["service"] } = opts;

  // Bounding box from origin + radius (1° lat ≈ 111.32 km; lng scaled by cos(lat)).
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180) || 1e-6);
  const latMin = lat - latDelta, latMax = lat + latDelta;
  const lngMin = lng - lngDelta, lngMax = lng + lngDelta;

  // pp.* is non-null ONLY for a fresh available presence (the JOIN gates it).
  // COALESCE(pp, store) = live position when fresh, else the static store coords.
  const rows = await prisma.$queryRaw<{ ownerId: string; storeId: string; lat: number; lng: number }[]>(
    Prisma.sql`
      SELECT s."ownerId", s.id AS "storeId",
             COALESCE(pp.lat, s.lat) AS lat,
             COALESCE(pp.lng, s.lng) AS lng
      FROM "Store" s
      JOIN "StoreCategoryLink" scl ON scl."storeId" = s.id AND scl."categoryId" = ${categoryId}
      LEFT JOIN "ProviderPresence" pp ON pp."userId" = s."ownerId"
        AND pp.mode = 'available'
        AND pp."seenAt" > NOW() - INTERVAL '5 minutes'
        AND pp.lat IS NOT NULL AND pp.lng IS NOT NULL
      WHERE s."deletedAt" IS NULL
        AND COALESCE(pp.lat, s.lat) IS NOT NULL
        AND COALESCE(pp.lng, s.lng) IS NOT NULL
        AND COALESCE(pp.lat, s.lat) BETWEEN ${latMin} AND ${latMax}
        AND COALESCE(pp.lng, s.lng) BETWEEN ${lngMin} AND ${lngMax}
        ${excludeUserId ? Prisma.sql`AND s."ownerId" <> ${excludeUserId}` : Prisma.empty}
        AND EXISTS (
          SELECT 1 FROM "Block" b
          WHERE b."storeId" = s.id AND b."serviceType" = ANY(${serviceTypes}::text[])
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
