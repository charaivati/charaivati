/**
 * One-time backfill: find all WorkflowStep rows with no WorkflowStepAssignee
 * rows and add the initiative owner as the default assignee.
 *
 * Run with:
 *   npx ts-node --project tsconfig.scripts.json scripts/backfill-owner-assignees.ts
 *
 * Safe to run multiple times — ensureOwnerAssignee is idempotent.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function ensureOwnerAssignee(pageId: string, stepId: string): Promise<boolean> {
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { ownerId: true },
  });
  if (!page) return false;

  // Find or create self-team Collaboration for the owner
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
      collab = await prisma.collaboration.findFirst({
        where: { requesterId: pageId, receiverUserId: page.ownerId, scope: "team" },
        select: { id: true },
      });
      if (!collab) return false;
    }
  }

  const existing = await (prisma as any).workflowStepAssignee.findFirst({
    where: { stepId, collaborationId: collab.id },
    select: { id: true },
  });
  if (existing) return false; // already present

  try {
    await (prisma as any).workflowStepAssignee.create({
      data: { stepId, collaborationId: collab.id, sequence: 0 },
    });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  // Fetch all WorkflowStep IDs and their initiativeId
  const steps = await prisma.workflowStep.findMany({
    select: { id: true, name: true, initiativeId: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${steps.length} workflow step(s) total.`);

  // Filter to those with zero WorkflowStepAssignee rows
  const unassigned: typeof steps = [];
  for (const step of steps) {
    const count = await (prisma as any).workflowStepAssignee.count({
      where: { stepId: step.id },
    });
    if (count === 0) unassigned.push(step);
  }

  console.log(`${unassigned.length} step(s) have no assignees — backfilling owner...`);

  let added = 0;
  let skipped = 0;

  for (const step of unassigned) {
    const was = await ensureOwnerAssignee(step.initiativeId, step.id);
    if (was) {
      console.log(`  + added owner to step "${step.name}" (${step.id}) [initiative ${step.initiativeId}]`);
      added++;
    } else {
      console.log(`  ~ skipped step "${step.name}" (${step.id}) — no page / already present`);
      skipped++;
    }
  }

  console.log(`\nDone. Added: ${added}, skipped: ${skipped}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
