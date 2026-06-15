import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/createNotification";

const OPEN_ORDER_STATUSES = ["pending", "confirmed", "shipped"];
const ACTIVE_DELIVERY_STATUSES = ["confirmed", "processing", "out_for_delivery"];

export type BlockingOrder = { id: string; reason: string };

export type SoftDeleteResult =
  | { ok: true; pageId: string | null }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "forbidden" }
  | { ok: false; reason: "open_orders"; blockingOrders: BlockingOrder[] };

/**
 * Soft-deletes a store + its linked Page (whole-venture delete).
 * Mirrors the User soft-delete precedent (status + scheduled flag) but uses a
 * single deletedAt marker since there is no grace-period requirement here.
 *
 * Refuses when any order (including sub-orders) for this store is still open —
 * "open" = status is non-terminal (pending/confirmed/shipped), OR status is
 * terminal (delivered/cancelled) but deliveryStatus is actively mid-delivery
 * (confirmed/processing/out_for_delivery). deliveryStatus="pending" on a
 * terminal-status order means delivery was never initiated and does NOT block.
 * Nothing is deleted; order/quote/OSP rows are never touched, only deletedAt
 * flags + the collaborations that must end as a result.
 */
export async function softDeleteStore(storeId: string, ownerId: string): Promise<SoftDeleteResult> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, name: true, ownerId: true, pageId: true },
  });
  if (!store) return { ok: false, reason: "not_found" };
  if (store.ownerId !== ownerId) return { ok: false, reason: "forbidden" };

  const openOrders = await prisma.order.findMany({
    where: {
      storeId,
      OR: [
        { status: { in: OPEN_ORDER_STATUSES } },
        {
          status: { in: ["delivered", "cancelled"] },
          deliveryStatus: { in: ACTIVE_DELIVERY_STATUSES },
        },
      ],
    },
    select: { id: true, status: true, deliveryStatus: true, parentOrderId: true },
  });

  if (openOrders.length > 0) {
    return {
      ok: false,
      reason: "open_orders",
      blockingOrders: openOrders.map((o) => ({
        id: o.id,
        reason: `${o.parentOrderId ? "sub-order" : "order"} still open (status: ${o.status}, delivery: ${o.deliveryStatus})`,
      })),
    };
  }

  const now = new Date();
  const pageId = store.pageId;

  // Snapshot affected collaborations before ending them, for the notification fan-out below.
  const collabs = pageId
    ? await prisma.collaboration.findMany({
        where: {
          status: "accepted",
          OR: [{ requesterId: pageId }, { receiverPageId: pageId }],
        },
        select: {
          id: true,
          requesterId: true,
          receiverPageId: true,
          receiverUserId: true,
          requester: { select: { ownerId: true } },
          receiverPage: { select: { ownerId: true } },
        },
      })
    : [];

  await prisma.$transaction(async (tx) => {
    await tx.store.update({ where: { id: storeId }, data: { deletedAt: now } });
    if (pageId) {
      await tx.page.update({ where: { id: pageId }, data: { deletedAt: now } });
      // End collaborations — Collaboration.status already has a "cancelled" terminal
      // state used elsewhere as the "ended" marker; reuse it rather than inventing a field.
      await tx.collaboration.updateMany({
        where: {
          status: "accepted",
          OR: [{ requesterId: pageId }, { receiverPageId: pageId }],
        },
        data: { status: "cancelled" },
      });
    }
  });

  // Notify the other side of each ended collaboration. Fire-and-forget per row —
  // one failing notification must never roll back or block the delete.
  for (const collab of collabs) {
    try {
      const otherOwnerId =
        collab.requesterId === pageId
          ? (collab.receiverPage?.ownerId ?? collab.receiverUserId ?? null)
          : (collab.requester?.ownerId ?? null);
      if (otherOwnerId && otherOwnerId !== ownerId) {
        await createNotification({
          userId: otherOwnerId,
          type: "collaboration_ended",
          title: "Partnership ended",
          body: `Store "${store.name}" has closed; your role there has ended.`,
        });
      }
    } catch (e) {
      console.error("softDeleteStore: notify collaborator failed:", e);
    }
  }

  return { ok: true, pageId };
}
