import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

async function verifyStepOwner(stepId: string, pageId: string, userId: string) {
  const [page, step] = await Promise.all([
    prisma.page.findUnique({ where: { id: pageId }, select: { ownerId: true } }),
    prisma.workflowStep.findUnique({
      where: { id: stepId },
      select: { id: true, initiativeId: true },
    }),
  ]);
  if (!page || page.ownerId !== userId) return null;
  if (!step || step.initiativeId !== pageId) return null;
  return step;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string; stepId: string }> }
) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId, stepId } = await params;
  const step = await verifyStepOwner(stepId, pageId, user.id);
  if (!step) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { collaborationId, sequence, costPerOrder, costPerKg, costPerKgPerKm, costPerItemPerKm } =
    body as Record<string, unknown>;

  if (!collaborationId || typeof collaborationId !== "string") {
    return NextResponse.json({ error: "collaborationId required" }, { status: 400 });
  }

  // Validate collab is accepted and belongs to this initiative
  const collab = await prisma.collaboration.findFirst({
    where: {
      id: collaborationId,
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
      scope: true,
      requesterId: true,
      requester:    { select: { title: true, avatarUrl: true } },
      receiverPage: { select: { title: true, avatarUrl: true } },
      receiverUser: { select: { name: true, avatarUrl: true } },
    },
  });

  if (!collab) {
    return NextResponse.json(
      { error: "Collaboration not found or not accepted for this initiative" },
      { status: 400 }
    );
  }

  // Determine sequence — default to last + 1
  let seq = typeof sequence === "number" ? sequence : null;
  if (seq === null) {
    const last = await (prisma as any).workflowStepAssignee.findFirst({
      where: { stepId },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });
    seq = (last?.sequence ?? 0) + 1;
  }

  const created = await (prisma as any).workflowStepAssignee.create({
    data: {
      stepId,
      collaborationId,
      sequence: seq,
      costPerOrder: costPerOrder ?? null,
      costPerKg: costPerKg ?? null,
      costPerKgPerKm: costPerKgPerKm ?? null,
      costPerItemPerKm: costPerItemPerKm ?? null,
    },
  });

  const displayName =
    collab.requesterId === pageId
      ? (collab.receiverPage?.title ?? collab.receiverUser?.name ?? "Unknown")
      : collab.requester.title;

  return NextResponse.json({ ...created, displayName, collaboration: collab }, { status: 201 });
}
