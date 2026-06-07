import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/createNotification";

/**
 * Assigns the first WorkflowStepAssignee (by sequence) to a normal step and notifies them.
 * Does NOT create sub-orders — that is delivery-step-only behaviour via assignNextPartner.
 */
export async function assignNormalStep(
  orderId: string,
  stepId: string,
  ospId: string,
  initiativeId: string
): Promise<void> {
  const assignees = await (prisma as any).workflowStepAssignee.findMany({
    where: { stepId },
    orderBy: { sequence: "asc" },
    take: 1,
    select: {
      id: true,
      collaboration: {
        select: {
          requesterId:    true,
          receiverUserId: true,
          requester:      { select: { ownerId: true } },
          receiverPage:   { select: { ownerId: true } },
        },
      },
    },
  });

  if (assignees.length === 0) return;

  const first = assignees[0] as any;

  await (prisma as any).orderStepProgress.update({
    where: { id: ospId },
    data: { currentAssigneeId: first.id },
  });

  const collab = first.collaboration;
  let partnerUserId: string | undefined;
  if (collab.requesterId === initiativeId) {
    partnerUserId = collab.receiverPage?.ownerId ?? collab.receiverUserId ?? undefined;
  } else {
    partnerUserId = collab.requester?.ownerId;
  }
  if (!partnerUserId) return;

  const step = await prisma.workflowStep.findUnique({
    where: { id: stepId },
    select: { name: true },
  });

  await createNotification({
    userId: partnerUserId,
    type: "order_assigned",
    title: "New task assigned",
    body: `You have been assigned to step "${step?.name}" for Order #${orderId.slice(-8).toUpperCase()}`,
    link: "/app/orders?tab=tasks",
  });
}
