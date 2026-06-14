import { prisma } from "@/lib/prisma";

export async function mergeGuestToReal(
  guestId: string,
  realId: string
): Promise<void> {
  if (!guestId || !realId || guestId === realId) return;

  // Verify it is actually a guest account before merging
  const guestUser = await prisma.user.findUnique({
    where: { id: guestId },
    select: { status: true, email: true },
  });

  if (!guestUser || guestUser.status !== "guest" || guestUser.email !== null) {
    return;
  }

  try {
    // --- Pre-compute conflict sets OUTSIDE the transaction (read-only) ---
    const [guestCart, realCart, realWishlist, realPinned, realFollows] =
      await Promise.all([
        prisma.cartItem.findMany({ where: { userId: guestId } }),
        prisma.cartItem.findMany({ where: { userId: realId } }),
        prisma.wishlistItem.findMany({
          where: { userId: realId },
          select: { blockId: true },
        }),
        prisma.pinnedStore.findMany({
          where: { userId: realId },
          select: { storeId: true },
        }),
        prisma.pageFollow.findMany({
          where: { userId: realId },
          select: { pageId: true },
        }),
      ]);

    const realCartByBlock = new Map(realCart.map((c) => [c.blockId, c]));
    const overlappingCart = guestCart.filter((g) => realCartByBlock.has(g.blockId));
    const nonOverlappingCart = guestCart.filter((g) => !realCartByBlock.has(g.blockId));
    const realWishlistBlockIds = realWishlist.map((w) => w.blockId);
    const realPinnedStoreIds = realPinned.map((p) => p.storeId);
    const realFollowPageIds = realFollows.map((f) => f.pageId);

    // --- Transaction: only the conflict-aware merges (cart/wishlist/pinned/follows) ---
    await prisma.$transaction(async (tx) => {
      // Cart — bump quantities for overlaps, then drop guest's overlapping rows
      for (const item of overlappingCart) {
        const existing = realCartByBlock.get(item.blockId)!;
        await tx.cartItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + item.quantity },
        });
      }
      if (overlappingCart.length) {
        await tx.cartItem.deleteMany({
          where: { id: { in: overlappingCart.map((i) => i.id) } },
        });
      }
      if (nonOverlappingCart.length) {
        await tx.cartItem.updateMany({
          where: { id: { in: nonOverlappingCart.map((i) => i.id) } },
          data: { userId: realId },
        });
      }

      // Wishlist — drop guest dupes, reassign the rest
      await tx.wishlistItem.deleteMany({
        where: { userId: guestId, blockId: { in: realWishlistBlockIds } },
      });
      await tx.wishlistItem.updateMany({
        where: { userId: guestId, blockId: { notIn: realWishlistBlockIds } },
        data: { userId: realId },
      });

      // Pinned stores — drop guest dupes, reassign the rest
      await tx.pinnedStore.deleteMany({
        where: { userId: guestId, storeId: { in: realPinnedStoreIds } },
      });
      await tx.pinnedStore.updateMany({
        where: { userId: guestId, storeId: { notIn: realPinnedStoreIds } },
        data: { userId: realId },
      });

      // Page follows — drop guest dupes, reassign the rest
      await tx.pageFollow.deleteMany({
        where: { userId: guestId, pageId: { in: realFollowPageIds } },
      });
      await tx.pageFollow.updateMany({
        where: { userId: guestId, pageId: { notIn: realFollowPageIds } },
        data: { userId: realId },
      });
    }, { timeout: 15000 });

    // --- Plain bulk reassignments (no conflict logic) — run outside the transaction ---
    await prisma.address.updateMany({
      where: { userId: guestId },
      data: { userId: realId },
    });

    await prisma.order.updateMany({
      where: { userId: guestId },
      data: { userId: realId },
    });

    await prisma.page.updateMany({
      where: { ownerId: guestId },
      data: { ownerId: realId },
    });

    await prisma.store.updateMany({
      where: { ownerId: guestId },
      data: { ownerId: realId },
    });

    // ConsultSession and messages (Listener / Saathi) — move all (UCTX-2)
    // Delete any existing real user's ConsultSession first (should be rare, but safe)
    try {
      await (prisma as any).consultSession.deleteMany({
        where: { userId: realId },
      });
    } catch (e) {
      // Stale Prisma client (model not generated yet) is the only expected cause —
      // anything else should be visible, not swallowed.
      console.error("mergeGuestToReal: consultSession deleteMany (real) failed", e);
    }

    try {
      await (prisma as any).consultSession.updateMany({
        where: { userId: guestId },
        data: { userId: realId },
      });
    } catch (e) {
      console.error("mergeGuestToReal: consultSession updateMany (guest->real) failed", e);
    }

    // Finally delete the guest user — must run only after every guestId
    // reference above has been reassigned, since cascade-deletes would
    // otherwise take any not-yet-moved rows with it.
    await prisma.user.delete({ where: { id: guestId } });
  } catch (e) {
    console.error(
      `mergeGuestToReal failed for guest ${guestId} -> real ${realId}:`,
      e
    );
    throw e;
  }
}
