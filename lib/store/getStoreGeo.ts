import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Given a list of store IDs, returns a map { storeId → { lat, lng, acceptingOrders } }.
 * Uses $queryRaw so it works even when the Prisma client's generated types
 * don't yet include the lat/lng fields (stale generate after schema push).
 */
export async function getStoreGeo(
  ids: string[]
): Promise<Record<string, { lat: number | null; lng: number | null; acceptingOrders: boolean }>> {
  if (!ids.length) return {};
  const rows = await prisma.$queryRaw<
    { id: string; lat: number | null; lng: number | null; acceptingOrders: boolean }[]
  >(
    Prisma.sql`SELECT id, lat, lng, "acceptingOrders" FROM "Store" WHERE id IN (${Prisma.join(ids)})`
  );
  return Object.fromEntries(
    rows.map((r) => [r.id, { lat: r.lat, lng: r.lng, acceptingOrders: r.acceptingOrders }])
  );
}
