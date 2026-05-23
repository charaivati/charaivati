import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

async function verifyAssigneeOwner(
  assigneeId: string,
  stepId: string,
  pageId: string,
  userId: string
) {
  const [page, step] = await Promise.all([
    prisma.page.findUnique({ where: { id: pageId }, select: { ownerId: true } }),
    prisma.workflowStep.findUnique({
      where: { id: stepId },
      select: { id: true, initiativeId: true },
    }),
  ]);
  if (!page || page.ownerId !== userId) return null;
  if (!step || step.initiativeId !== pageId) return null;

  const assignee = await (prisma as any).workflowStepAssignee.findFirst({
    where: { id: assigneeId, stepId },
  });
  return assignee ?? null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string; stepId: string; assigneeId: string }> }
) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId, stepId, assigneeId } = await params;
  const assignee = await verifyAssigneeOwner(assigneeId, stepId, pageId, user.id);
  if (!assignee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as Record<string, unknown>;
  const allowed = ["sequence", "costPerOrder", "costPerKg", "costPerKgPerKm", "costPerItemPerKm"];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key] === undefined ? null : body[key];
  }

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });

  const updated = await (prisma as any).workflowStepAssignee.update({
    where: { id: assigneeId },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string; stepId: string; assigneeId: string }> }
) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId, stepId, assigneeId } = await params;
  const assignee = await verifyAssigneeOwner(assigneeId, stepId, pageId, user.id);
  if (!assignee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await (prisma as any).workflowStepAssignee.delete({ where: { id: assigneeId } });

  // Resequence remaining rows to close gaps
  const remaining = await (prisma as any).workflowStepAssignee.findMany({
    where: { stepId },
    orderBy: { sequence: "asc" },
    select: { id: true },
  });

  if (remaining.length > 0) {
    await prisma.$transaction(
      remaining.map((row: { id: string }, i: number) =>
        (prisma as any).workflowStepAssignee.update({
          where: { id: row.id },
          data: { sequence: i + 1 },
        })
      )
    );
  }

  return NextResponse.json({ ok: true });
}
