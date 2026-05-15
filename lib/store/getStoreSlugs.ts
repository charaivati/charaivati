import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Given a list of store IDs, returns a map { storeId → slug | null }.
 * Uses $queryRaw so it works even when the Prisma client's generated types
 * don't yet include the slug field (stale generate after schema push).
 */
export async function getStoreSlugs(
  ids: string[]
): Promise<Record<string, string | null>> {
  if (!ids.length) return {};
  const rows = await prisma.$queryRaw<{ id: string; slug: string | null }[]>(
    Prisma.sql`SELECT id, slug FROM "Store" WHERE id IN (${Prisma.join(ids)})`
  );
  return Object.fromEntries(rows.map((r) => [r.id, r.slug]));
}
