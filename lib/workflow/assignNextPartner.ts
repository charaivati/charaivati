import { prisma } from "@/lib/prisma";
import { createSubOrder } from "./createSubOrder";
import { createNotification } from "@/lib/notifications/createNotification";
import { calculateDeliveryCost } from "./calculateDeliveryCost";
import { haversineKm } from "@/lib/geo/haversine";

export type AssignResult = { assigned: boolean; escalated: boolean };

export async function assignNextPartner({
  orderId,
  stepId,
  ospId,
}: {
  orderId: string;
  stepId: string;
  ospId: string;
}): Promise<AssignResult> {
  const [step, ospRaw, assigneesRaw, orderData] = await Promise.all([
    prisma.workflowStep.findUnique({
      where: { id: stepId },
      select: { id: true, name: true },
    }),
    (prisma as any).orderStepProgress.findUnique({
      where: { id: ospId },
      select: { currentAssigneeId: true, cycleCount: true, lastFeeMultiplier: true },
    }),
    (prisma as any).workflowStepAssignee.findMany({
      where: { stepId },
      orderBy: { sequence: "asc" },
      select: {
        id: true,
        collaborationId: true,
        costPerOrder: true,
        costPerKg: true,
        costPerKgPerKm: true,
        costPerItemPerKm: true,
        collaboration: {
          select: {
            requesterId: true,
            requester: { select: { ownerId: true } },
            receiver:  { select: { ownerId: true } },
          },
        },
      },
    }),
    prisma.order.findUnique({
      where: { id: orderId },
      select: {
        storeId: true,
        items: true,
        address: { select: { lat: true, lng: true } },
        store: {
          select: {
            pageId: true,
            ownerId: true,
            owner: {
              select: {
                addresses: {
                  where: { isDefault: true },
                  select: { lat: true, lng: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    }),
  ]);

  if (!step || !ospRaw || !orderData) return { assigned: false, escalated: false };

  const assignees = assigneesRaw as any[];
  if (assignees.length === 0) return { assigned: false, escalated: false };

  const osp = ospRaw as {
    currentAssigneeId: string | null;
    cycleCount: number;
    lastFeeMultiplier: number;
  };

  // Find next assignee after the current one (null currentAssigneeId → start from first)
  const currentId = osp.currentAssigneeId;
  let nextAssignee: any;

  if (!currentId) {
    nextAssignee = assignees[0];
  } else {
    const idx = assignees.findIndex((a) => a.id === currentId);
    nextAssignee = idx >= 0 && idx + 1 < assignees.length ? assignees[idx + 1] : null;
  }

  // End of list — enter the cycling / escalation path
  if (!nextAssignee) {
    const newCycleCount = osp.cycleCount + 1;

    if (newCycleCount >= 3) {
      await Promise.all([
        (prisma as any).order.update({
          where: { id: orderId },
          data: { requiresAttention: true },
        }),
        createNotification({
          userId: orderData.store.ownerId,
          type: "escalation",
          title: "Delivery escalated",
          body: `All partners rejected Order #${orderId.slice(-8).toUpperCase()} after 3 cycles`,
          link: "/store/orders/all",
        }),
        (prisma as any).orderStepProgress.update({
          where: { id: ospId },
          data: { cycleCount: newCycleCount },
        }),
      ]);
      return { assigned: false, escalated: true };
    }

    // Apply 5% fee hike and restart from the top of the list
    const newMultiplier = Math.round(osp.lastFeeMultiplier * 1.05 * 10000) / 10000;
    await (prisma as any).orderStepProgress.update({
      where: { id: ospId },
      data: { cycleCount: newCycleCount, lastFeeMultiplier: newMultiplier, currentAssigneeId: null },
    });

    return assignNextPartner({ orderId, stepId, ospId });
  }

  // Calculate cost from this assignee's own pricing fields (not the Collaboration-level fields)
  const items = (orderData.items as { blockId: string; quantity: number }[]) ?? [];
  const totalItems = items.reduce((sum, i) => sum + (i.quantity ?? 1), 0);
  const blockIds = items.map((i) => i.blockId).filter(Boolean);
  const blocks = blockIds.length > 0
    ? await prisma.storeBlock.findMany({
        where: { id: { in: blockIds } },
        select: { id: true, weight: true },
      })
    : [];
  const weightMap = new Map(blocks.map((b) => [b.id, b.weight]));
  const totalWeightKg = items.reduce(
    (sum, i) => sum + ((weightMap.get(i.blockId) ?? 1) as number) * (i.quantity ?? 1),
    0
  );

  const storeAddr = orderData.store.owner.addresses[0];
  let distanceKm = 0;
  if (
    storeAddr?.lat != null && storeAddr?.lng != null &&
    orderData.address.lat != null && orderData.address.lng != null
  ) {
    distanceKm = haversineKm(
      storeAddr.lat, storeAddr.lng,
      orderData.address.lat, orderData.address.lng
    );
  }

  const rawCost = calculateDeliveryCost({
    collaboration: nextAssignee, // WorkflowStepAssignee has the same pricing fields
    totalWeightKg,
    totalItems,
    distanceKm,
  });
  const calculatedCost = Math.round(rawCost * osp.lastFeeMultiplier * 100) / 100;

  // Advance OSP to this assignee
  await (prisma as any).orderStepProgress.update({
    where: { id: ospId },
    data: { currentAssigneeId: nextAssignee.id },
  });

  // Determine partner's userId from the Collaboration
  const collab = nextAssignee.collaboration;
  const storePageId = orderData.store.pageId;
  const partnerPage =
    storePageId && collab.requesterId === storePageId ? collab.receiver : collab.requester;
  const partnerUserId = partnerPage?.ownerId as string | undefined;
  if (!partnerUserId) return { assigned: false, escalated: false };

  // Update order with new assignment
  await (prisma as any).order.update({
    where: { id: orderId },
    data: {
      assignedToId: nextAssignee.collaborationId,
      partnerStatus: "assigned",
      ...(calculatedCost > 0 ? { agreedAmount: calculatedCost } : {}),
    },
  });

  // Create sub-order for the partner's dashboard
  await createSubOrder({
    parentOrderId: orderId,
    assigneeUserId: partnerUserId,
    storeId: orderData.storeId,
    stepId,
    stepName: step.name,
    subOrderType: "delivery",
    ...(calculatedCost > 0 ? { agreedAmount: calculatedCost } : {}),
  });

  // Notify the partner
  await createNotification({
    userId: partnerUserId,
    type: "order_assigned",
    title: "New delivery assignment",
    body: `Order #${orderId.slice(-8).toUpperCase()} — ₹${calculatedCost}. Accept or reject in Deliveries.`,
    link: "/earn/deliveries",
  });

  return { assigned: true, escalated: false };
}
