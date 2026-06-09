import { prisma } from "@/lib/prisma";
import { triggerQuoteRequests } from "./triggerQuoteRequests";
import { assignNormalStep } from "./assignNormalStep";
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
    // Last step confirmed — customer receipt confirmation sets "delivered"
    return;
  }

  // Activate next OSP row (may not exist if steps were added after activation)
  await prisma.orderStepProgress.updateMany({
    where: { orderId, stepId: nextStep.id, status: "pending" },
    data: { status: "active", activatedAt: new Date() },
  });

  if (nextStep.quoteRequired) {
    await triggerQuoteRequests(orderId, nextStep);
    return;
  }

  // Fetch activityType via raw SQL — new column not in stale Prisma client
  const activityRaw = await prisma.$queryRaw<{ activityType: string }[]>`
    SELECT "activityType" FROM "WorkflowStep" WHERE id = ${nextStep.id}
  `;
  const activityType = activityRaw[0]?.activityType ?? "normal";

  if (activityType === "delivery") {
    // Delivery step: just activate OSP — confirm route handles dispatch via assignNextPartner.
    // Ensure the owner is a fallback assignee so assignNextPartner never no-ops silently.
    const deliveryAssigneeCount = await (prisma as any).workflowStepAssignee.count({
      where: { stepId: nextStep.id },
    });
    if (deliveryAssigneeCount === 0) {
      await ensureOwnerAssignee(current.initiativeId, nextStep.id);
    }
    return;
  }

  // Normal step: assign first assignee and notify (no sub-order, no deliveryStatus change)
  const assigneeCount = await (prisma as any).workflowStepAssignee.count({
    where: { stepId: nextStep.id },
  });

  const osp = await (prisma as any).orderStepProgress.findFirst({
    where: { orderId, stepId: nextStep.id },
    select: { id: true },
  });
  if (!osp) return;

  await (prisma as any).orderStepProgress.update({
    where: { id: osp.id },
    data: { currentAssigneeId: null, cycleCount: 0, lastFeeMultiplier: 1.0 },
  });

  if (assigneeCount === 0) {
    await ensureOwnerAssignee(current.initiativeId, nextStep.id);
  }

  await assignNormalStep(orderId, nextStep.id, osp.id, current.initiativeId);
}
