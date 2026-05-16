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

  await prisma.$transaction(async (tx) => {
    // Cart — merge quantities if same product exists
    const guestCart = await tx.cartItem.findMany({
      where: { userId: guestId },
    });
    for (const item of guestCart) {
      const existing = await tx.cartItem.findUnique({
        where: {
          userId_blockId: { userId: realId, blockId: item.blockId },
        },
      });
      if (existing) {
        await tx.cartItem.update({
          where: {
            userId_blockId: { userId: realId, blockId: item.blockId },
          },
          data: { quantity: existing.quantity + item.quantity },
        });
        await tx.cartItem.delete({ where: { id: item.id } });
      } else {
        await tx.cartItem.update({
          where: { id: item.id },
          data: { userId: realId },
        });
      }
    }

    // Wishlist — skip duplicates
    const guestWishlist = await tx.wishlistItem.findMany({
      where: { userId: guestId },
    });
    for (const item of guestWishlist) {
      const existing = await tx.wishlistItem.findUnique({
        where: {
          userId_blockId: { userId: realId, blockId: item.blockId },
        },
      });
      if (!existing) {
        await tx.wishlistItem.update({
          where: { id: item.id },
          data: { userId: realId },
        });
      } else {
        await tx.wishlistItem.delete({ where: { id: item.id } });
      }
    }

    // Pinned stores — skip duplicates
    const guestPinned = await tx.pinnedStore.findMany({
      where: { userId: guestId },
    });
    for (const item of guestPinned) {
      const existing = await tx.pinnedStore.findUnique({
        where: {
          userId_storeId: { userId: realId, storeId: item.storeId },
        },
      });
      if (!existing) {
        await tx.pinnedStore.update({
          where: { id: item.id },
          data: { userId: realId },
        });
      } else {
        await tx.pinnedStore.delete({ where: { id: item.id } });
      }
    }

    // Page follows (initiatives, stores, courses) — skip duplicates
    const guestFollows = await tx.pageFollow.findMany({
      where: { userId: guestId },
    });
    for (const item of guestFollows) {
      const existing = await tx.pageFollow.findUnique({
        where: {
          userId_pageId: { userId: realId, pageId: item.pageId },
        },
      });
      if (!existing) {
        await tx.pageFollow.update({
          where: { id: item.id },
          data: { userId: realId },
        });
      } else {
        await tx.pageFollow.delete({ where: { id: item.id } });
      }
    }

    // Addresses — move all
    await tx.address.updateMany({
      where: { userId: guestId },
      data: { userId: realId },
    });

    // Orders — move all (address rows already re-owned above)
    await tx.order.updateMany({
      where: { userId: guestId },
      data: { userId: realId },
    });

    // Delete the guest user record
    await tx.user.delete({ where: { id: guestId } });
  });
}
