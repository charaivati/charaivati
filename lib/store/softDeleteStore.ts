import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/createNotification";

const TERMINAL_ORDER_STATUSES = ["delivered", "cancelled"];
const TERMINAL_DELIVERY_STATUSES = ["delivered", "cancelled"];

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
 * Refuses when any order (including sub-orders) for this store is still open.
 *
 * An order is CLOSED (does not block) if EITHER `status` OR `deliveryStatus`
 * has reached a terminal value (delivered/cancelled) — it is "open" only when
 * BOTH fields are non-terminal. This reflects that the two fields are advanced
 * by different code paths and routinely diverge in practice: `deliveryStatus`
 * commonly reaches "delivered"/"cancelled" via the GPS/customer-confirm flow
 * (or owner cancellation) while `Order.status` is left at "pending"/"confirmed"/
 * "shipped" forever — that divergence is the norm, not the exception, across
 * real orders. Treating either terminal value as sufficient avoids false
 * "open_orders" blocks while still correctly blocking genuinely in-progress
 * orders (e.g. status="confirmed"/deliveryStatus="pending" awaiting dispatch,
 * or deliveryStatus="out_for_delivery") (STOREDEL-FIX-3).
 *
 * This single rule applies uniformly to top-level orders and sub-orders —
 * a sub-order left at status="pending" with deliveryStatus="cancelled" is
 * closed, not open, same as before (STOREDEL-FIX-2's special-case sub-order
 * branch is now subsumed by this general rule).
 *
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
      status: { notIn: TERMINAL_ORDER_STATUSES },
      deliveryStatus: { notIn: TERMINAL_DELIVERY_STATUSES },
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
