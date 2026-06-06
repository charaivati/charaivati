import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { ensureOwnerAssignee } from "@/lib/workflow/ensureOwnerAssignee";

async function verifyOwner(pageId: string, userId: string) {
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { ownerId: true },
  });
  return page?.ownerId === userId ? page : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;
  const page = await verifyOwner(pageId, user.id);
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let steps = await prisma.workflowStep.findMany({
    where: { initiativeId: pageId },
    orderBy: { sequence: "asc" },
  });

  // Seed default steps when initiative is first opened
  if (steps.length === 0) {
    const founderCollab = await prisma.collaboration.findFirst({
      where: {
        status: "accepted",
        OR: [
          { requesterId: pageId, scope: "team", teamRole: "founder" },
          { receiverPageId: pageId, scope: "team", teamRole: "founder" },
        ],
      },
      select: { id: true },
    });

    const fId = founderCollab?.id ?? null;

    await prisma.$transaction([
      prisma.workflowStep.create({ data: { initiativeId: pageId, name: "Order Received",    sequence: 1, assigneeType: "team_member", assigneeId: fId } }),
      prisma.workflowStep.create({ data: { initiativeId: pageId, name: "Processing",        sequence: 2, assigneeType: "team_member", assigneeId: fId } }),
      prisma.workflowStep.create({ data: { initiativeId: pageId, name: "Dispatch & Deliver",sequence: 3, assigneeType: "team_member", assigneeId: fId } }),
    ]);

    // Mark the last seeded step as delivery — raw SQL since column is new
    await prisma.$executeRaw`
      UPDATE "WorkflowStep" SET "activityType" = 'delivery'
      WHERE "initiativeId" = ${pageId} AND sequence = 3
    `;

    steps = await prisma.workflowStep.findMany({
      where: { initiativeId: pageId },
      orderBy: { sequence: "asc" },
    });

    // Guarantee each seeded step has at least the owner as assignee
    await Promise.all(steps.map((s) => ensureOwnerAssignee(pageId, s.id)));
  }

  // Available assignees: any accepted collab involving this page (all scopes)
  const collabs = await prisma.collaboration.findMany({
    where: {
      status: "accepted",
      OR: [
        { requesterId: pageId },
        { receiverPageId: pageId },
        { initiativeId: pageId },
      ],
    },
    select: {
      id: true,
      role: true,
      teamRole: true,
      customRole: true,
      scope: true,
      requesterId: true,
      receiverPageId: true,
      requester:    { select: { title: true } },
      receiverPage: { select: { title: true } },
      receiverUser: { select: { name: true } },
    },
  });

  const assignees = collabs.map((c) => ({
    id: c.id,
    role: c.role,
    teamRole: c.teamRole,
    customRole: c.customRole,
    scope: c.scope,
    displayName:
      c.requesterId === pageId
        ? (c.receiverPage?.title ?? c.receiverUser?.name ?? "Unknown")
        : c.requester.title,
  }));

  const assigneeMap = new Map(assignees.map((a) => [a.id, a]));

  // Fetch WorkflowStepAssignee rows for all steps (new multi-assignee system)
  const stepIds = steps.map((s) => s.id);
  const stepAssigneeRows: any[] = stepIds.length > 0
    ? await (prisma as any).workflowStepAssignee.findMany({
        where: { stepId: { in: stepIds } },
        orderBy: { sequence: "asc" },
        include: {
          collaboration: {
            select: {
              id: true,
              role: true,
              teamRole: true,
              scope: true,
              requesterId: true,
              requester:    { select: { title: true, avatarUrl: true } },
              receiverPage: { select: { title: true, avatarUrl: true } },
              receiverUser: { select: { name: true, avatarUrl: true } },
            },
          },
        },
      })
    : [];

  const assigneesByStep = new Map<string, any[]>();
  for (const row of stepAssigneeRows) {
    const displayName =
      row.collaboration.requesterId === pageId
        ? (row.collaboration.receiverPage?.title ?? row.collaboration.receiverUser?.name ?? "Unknown")
        : row.collaboration.requester.title;
    const list = assigneesByStep.get(row.stepId) ?? [];
    list.push({ ...row, displayName });
    assigneesByStep.set(row.stepId, list);
  }

  // Fetch activityType via raw SQL — new column not in stale Prisma client
  const activityTypeRows = stepIds.length > 0
    ? await prisma.$queryRaw<{ id: string; activityType: string }[]>`
        SELECT id, "activityType" FROM "WorkflowStep" WHERE id = ANY(${stepIds}::text[])
      `
    : [];
  const activityTypeByStep = new Map(activityTypeRows.map((r) => [r.id, r.activityType]));

  const stepsWithAssignee = steps.map((s) => ({
    ...s,
    activityType: activityTypeByStep.get(s.id) ?? "normal",
    assignee: s.assigneeId ? (assigneeMap.get(s.assigneeId) ?? null) : null,
    assignees: assigneesByStep.get(s.id) ?? [],
  }));

  return NextResponse.json({ steps: stepsWithAssignee, assignees });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;
  const page = await verifyOwner(pageId, user.id);
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const last = await prisma.workflowStep.findFirst({
    where: { initiativeId: pageId },
    orderBy: { sequence: "desc" },
    select: { sequence: true },
  });
  const sequence = (last?.sequence ?? 0) + 1;

  const step = await prisma.workflowStep.create({
    data: {
      initiativeId: pageId,
      name: "New Step",
      sequence,
      assigneeType: "team_member",
    },
  });

  // Auto-assign the owner so the step is never left empty
  await ensureOwnerAssignee(pageId, step.id);

  return NextResponse.json({ ...step, assignees: [], assignee: null }, { status: 201 });
}
