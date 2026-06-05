import { prisma } from "@/lib/prisma";
import { triggerQuoteRequests } from "./triggerQuoteRequests";
import { assignNextPartner } from "./assignNextPartner";
import { ensureOwnerAssignee } from "./ensureOwnerAssignee";

export async function advanceToNextStep(
  orderId: string,
  currentStepId: string
): Promise<void> {
  const current = await prisma.workflowStep.findUnique({
    where: { id: currentStepId },
    select: { initiativeId: true, sequence: true },
  });
  if (!current) return;

  const allSteps = await prisma.workflowStep.findMany({
    where: { initiativeId: current.initiativeId },
    orderBy: { sequence: "asc" },
  });

  const nextStep = allSteps.find((s) => s.sequence > current.sequence);

  if (!nextStep) {
    // Last step was confirmed — customer receipt confirmation sets "delivered"
    return;
  }

  const isLastStep = !allSteps.some((s) => s.sequence > nextStep.sequence);

  // Activate next OSP row (may not exist if steps were added after activation)
  await prisma.orderStepProgress.updateMany({
    where: { orderId, stepId: nextStep.id, status: "pending" },
    data: { status: "active", activatedAt: new Date() },
  });

  if (!nextStep.quoteRequired) {
    // Terminal step → hand off to delivery GPS tracking
    if (isLastStep) {
      await prisma.order.update({
        where: { id: orderId },
        data: { deliveryStatus: "out_for_delivery" },
      });
    }

    const assigneeCount = await (prisma as any).workflowStepAssignee.count({
      where: { stepId: nextStep.id },
    });

    if (assigneeCount > 0) {
      const osp = await (prisma as any).orderStepProgress.findFirst({
        where: { orderId, stepId: nextStep.id },
        select: { id: true },
      });

      if (osp) {
        // Reset cycling state for a fresh start on this step
        await (prisma as any).orderStepProgress.update({
          where: { id: osp.id },
          data: { currentAssigneeId: null, cycleCount: 0, lastFeeMultiplier: 1.0 },
        });

        await assignNextPartner({ orderId, stepId: nextStep.id, ospId: osp.id });
      }
    } else if (nextStep.assigneeId) {
      // Single fixed assignee — set directly without going through the cycling engine
      await prisma.order.update({
        where: { id: orderId },
        data: { assignedToId: nextStep.assigneeId, partnerStatus: "assigned" },
      });
    } else {
      // No assignees configured — auto-assign the store owner so the order proceeds
      await ensureOwnerAssignee(current.initiativeId, nextStep.id);
      const osp = await (prisma as any).orderStepProgress.findFirst({
        where: { orderId, stepId: nextStep.id },
        select: { id: true },
      });
      if (osp) {
        await (prisma as any).orderStepProgress.update({
          where: { id: osp.id },
          data: { currentAssigneeId: null, cycleCount: 0, lastFeeMultiplier: 1.0 },
        });
        await assignNextPartner({ orderId, stepId: nextStep.id, ospId: osp.id });
      }
    }
  } else {
    await triggerQuoteRequests(orderId, nextStep);
  }
}
