import { db } from "@/lib/db";

/**
 * Re-parents all BusinessIdea rows owned by a guest session to a real userId.
 * Idempotent — safe to call twice; already-claimed ideas are skipped.
 * Only reassigns ideas that have no userId yet (anonymous/guest-only ideas).
 */
export async function claimGuestIdeas(
  guestSessionId: string,
  realUserId: string
): Promise<void> {
  if (!guestSessionId || !realUserId) return;

  await (db as any).businessIdea.updateMany({
    where: {
      guestSessionId,
      userId: null,
    },
    data: {
      userId: realUserId,
    },
  });
}
