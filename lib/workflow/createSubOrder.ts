import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/createNotification";

interface CreateSubOrderParams {
  parentOrderId: string;
  assigneeUserId: string;
  storeId: string;
  stepId: string;
  stepName: string;
  agreedAmount?: number;
  subOrderType: string;
}

export async function createSubOrder(params: CreateSubOrderParams): Promise<void> {
  const { parentOrderId, assigneeUserId, storeId, stepId, stepName, agreedAmount, subOrderType } = params;

  try {
    // Fetch parent for addressId + items snapshot
    const parent = await prisma.order.findUnique({
      where: { id: parentOrderId },
      select: { addressId: true, items: true },
    });
    if (!parent) return;

    // Avoid duplicates: skip if a sub-order already exists for this parent + step + user
    const existing = await (prisma as any).order.findFirst({
      where: { parentOrderId, userId: assigneeUserId, subOrderType },
      select: { id: true },
    });
    if (existing) return;

    await (prisma as any).order.create({
      data: {
        userId:        assigneeUserId,
        storeId,
        addressId:     parent.addressId,
        status:        "confirmed",
        deliveryStatus:"processing",
        items:         parent.items,
        total:         agreedAmount ?? 0,
        parentOrderId,
        subOrderType,
        agreedAmount:  agreedAmount ?? null,
      },
    });

    await createNotification({
      userId: assigneeUserId,
      type:   "order_assigned",
      title:  `New ${subOrderType} assignment`,
      body:   `You have a new assignment for Order #${parentOrderId.slice(-8).toUpperCase()}`,
      link:   "/app/orders?tab=my",
    });
  } catch (e) {
    console.error("createSubOrder failed:", e);
  }
}
