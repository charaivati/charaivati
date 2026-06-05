import { prisma } from "@/lib/prisma";

/**
 * Guarantees the initiative's page owner is assigned to the given workflow step.
 *
 * Creates a self-team Collaboration (page → owner-user, scope="team",
 * teamRole="founder") if one does not yet exist, then upserts a
 * WorkflowStepAssignee row for that step so the cycling engine can pick the
 * owner up automatically when no external partners are configured.
 *
 * Idempotent — safe to call multiple times for the same (pageId, stepId) pair.
 */
export async function ensureOwnerAssignee(pageId: string, stepId: string): Promise<void> {
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { ownerId: true },
  });
  if (!page) return;

  // Find or create the self-team Collaboration for this initiative's owner
  let collab = await prisma.collaboration.findFirst({
    where: { requesterId: pageId, receiverUserId: page.ownerId, scope: "team" },
    select: { id: true },
  });

  if (!collab) {
    try {
      collab = await prisma.collaboration.create({
        data: {
          requesterId:    pageId,
          receiverUserId: page.ownerId,
          role:           "employee",
          scope:          "team",
          teamRole:       "founder",
          status:         "accepted",
          initiativeId:   pageId,
        },
        select: { id: true },
      });
    } catch {
      // Race condition — another concurrent request already created it; re-fetch
      collab = await prisma.collaboration.findFirst({
        where: { requesterId: pageId, receiverUserId: page.ownerId, scope: "team" },
        select: { id: true },
      });
      if (!collab) return;
    }
  }

  // Add the owner as step assignee (sequence 0 = first priority)
  const existing = await (prisma as any).workflowStepAssignee.findFirst({
    where: { stepId, collaborationId: collab.id },
    select: { id: true },
  });
  if (!existing) {
    try {
      await (prisma as any).workflowStepAssignee.create({
        data: { stepId, collaborationId: collab.id, sequence: 0 },
      });
    } catch {
      // Duplicate from concurrent request — already present, nothing to do
    }
  }
}
