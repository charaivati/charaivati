import { prisma } from "@/lib/prisma";
import { triggerQuoteRequests } from "./triggerQuoteRequests";
import { assignNormalStep } from "./assignNormalStep";
import { ensureOwnerAssignee } from "./ensureOwnerAssignee";

export async function activateWorkflow(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { store: { select: { pageId: true, ownerId: true } } },
  });
  const initiativeId = order?.store.pageId;
  if (!initiativeId) return;

  const steps = await prisma.workflowStep.findMany({
    where: { initiativeId },
    orderBy: { sequence: "asc" },
  });
  if (steps.length === 0) return;

  // Idempotent — skip if already activated
  const existing = await prisma.orderStepProgress.count({ where: { orderId } });
  if (existing > 0) return;

  // Create all step progress rows as "pending"
  await prisma.orderStepProgress.createMany({
    data: steps.map((s) => ({ orderId, stepId: s.id, status: "pending" })),
    skipDuplicates: true,
  });

  // Activate first step
  const first = steps[0];
  await prisma.orderStepProgress.update({
    where: { orderId_stepId: { orderId, stepId: first.id } },
    data: { status: "active", activatedAt: new Date() },
  });

  if (first.quoteRequired) {
    await triggerQuoteRequests(orderId, first);
    return;
  }

  // Fetch activityType via raw SQL — new column not in stale Prisma client
  const activityRaw = await prisma.$queryRaw<{ activityType: string }[]>`
    SELECT "activityType" FROM "WorkflowStep" WHERE id = ${first.id}
  `;
  const activityType = activityRaw[0]?.activityType ?? "normal";

  if (activityType === "delivery") {
    // Delivery step: just active — confirm route handles dispatch via assignNextPartner
    return;
  }

  // Normal step: assign first assignee and notify (no sub-order)
  const assigneeCount = await (prisma as any).workflowStepAssignee.count({
    where: { stepId: first.id },
  });

  const osp = await prisma.orderStepProgress.findUnique({
    where: { orderId_stepId: { orderId, stepId: first.id } },
    select: { id: true },
  });
  if (!osp) return;

  if (assigneeCount === 0) {
    await ensureOwnerAssignee(initiativeId, first.id);
  }

  await assignNormalStep(orderId, first.id, osp.id, initiativeId);
}
