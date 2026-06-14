// lib/users/searchUsers.ts
//
// PRIV-ACT-1: shared name(+location) search used by both GET /api/users/search
// and the Listener's friend-request action flow. Returns ONLY id/name/avatarUrl/
// location — never email or phone. Filters: discoverable=true, status != "guest".
import { db } from "@/lib/db";

export const SEARCH_MAX_RESULTS = 5;

export interface SearchedUser {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  location: string | null;
}

export async function searchUsers({
  q,
  location,
  excludeUserId,
  limit = SEARCH_MAX_RESULTS,
}: {
  q: string;
  location?: string | null;
  excludeUserId?: string | null;
  limit?: number;
}): Promise<SearchedUser[]> {
  const query = q.trim();
  if (!query) return [];

  const loc = location?.trim();

  const users = await db.user.findMany({
    where: {
      discoverable: true,
      status: { not: "guest" },
      name: { contains: query, mode: "insensitive" },
      ...(excludeUserId
        ? {
            id: { not: excludeUserId },
            // ACTION-INTENT-6: bilateral block effect — exclude this user if
            // either side has blocked the other.
            blocksReceived: { none: { blockerId: excludeUserId } },
            blocksMade: { none: { blockedId: excludeUserId } },
          }
        : {}),
      ...(loc
        ? {
            addresses: {
              some: {
                isDefault: true,
                OR: [
                  { city: { contains: loc, mode: "insensitive" } },
                  { state: { contains: loc, mode: "insensitive" } },
                ],
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      addresses: {
        where: { isDefault: true },
        select: { city: true, state: true },
        take: 1,
      },
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  return users.map((u) => {
    const addr = u.addresses[0];
    return {
      id: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      location: addr ? [addr.city, addr.state].filter(Boolean).join(", ") || null : null,
    };
  });
}
