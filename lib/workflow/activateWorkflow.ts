import { prisma } from "@/lib/prisma";
import { triggerQuoteRequests } from "./triggerQuoteRequests";
import { assignNextPartner } from "./assignNextPartner";
import { createNotification } from "@/lib/notifications/createNotification";

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

  if (!first.quoteRequired) {
    const assigneeCount = await (prisma as any).workflowStepAssignee.count({
      where: { stepId: first.id },
    });

    if (assigneeCount > 0) {
      const osp = await prisma.orderStepProgress.findUnique({
        where: { orderId_stepId: { orderId, stepId: first.id } },
        select: { id: true },
      });
      if (osp) {
        await assignNextPartner({ orderId, stepId: first.id, ospId: osp.id });
      }
    } else {
      const ownerId = order?.store.ownerId;
      if (ownerId) {
        await (prisma as any).order.update({
          where: { id: orderId },
          data: { requiresAttention: true },
        });
        await createNotification({
          userId: ownerId,
          type: "workflow_attention",
          title: "Workflow step needs attention",
          body: `Step '${first.name}' has no assignees configured. Please assign manually or update your workflow.`,
          link: initiativeId ? `/earn/initiative/${initiativeId}` : "/store/orders/all",
        });
      }
    }
  } else {
    await triggerQuoteRequests(orderId, first);
  }
}
