// Handoff resolver (REQBCAST-1b) — returns a provider's pay-to UPI VPA so a
// paying party can pay them directly. DISPLAY/HANDOFF ONLY: nothing here moves
// money, validates payment, or escrows. The coming broadcast engine (REQBCAST-1c)
// is the intended consumer; there is no live consumer yet.
//
// Raw SQL because `upiVpa` was added after the last full `prisma generate`
// (same stale-client pattern as Store.line1/lat).
import { prisma } from "@/lib/prisma";

async function userVpa(userId: string): Promise<string | null> {
  const r = await prisma.$queryRaw<{ upiVpa: string | null }[]>`
    SELECT "upiVpa" FROM "Profile" WHERE "userId" = ${userId} LIMIT 1
  `;
  return r[0]?.upiVpa ?? null;
}

// Store handle first; fall back to the store owner's personal handle.
export async function getPayToVpa(opts: { storeId?: string; userId?: string }): Promise<string | null> {
  if (opts.storeId) {
    const r = await prisma.$queryRaw<{ upiVpa: string | null; ownerId: string }[]>`
      SELECT "upiVpa", "ownerId" FROM "Store" WHERE id = ${opts.storeId} LIMIT 1
    `;
    if (r[0]?.upiVpa) return r[0].upiVpa;
    if (r[0]?.ownerId) return userVpa(r[0].ownerId);
    return null;
  }
  if (opts.userId) return userVpa(opts.userId);
  return null;
}
