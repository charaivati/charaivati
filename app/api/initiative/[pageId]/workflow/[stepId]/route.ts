import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

async function getStepAndVerify(stepId: string, pageId: string, userId: string) {
  const [page, step] = await Promise.all([
    prisma.page.findUnique({ where: { id: pageId }, select: { ownerId: true } }),
    prisma.workflowStep.findUnique({ where: { id: stepId } }),
  ]);

  if (!page || page.ownerId !== userId) return null;
  if (!step || step.initiativeId !== pageId) return null;
  return step;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string; stepId: string }> }
) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId, stepId } = await params;
  const step = await getStepAndVerify(stepId, pageId, user.id);
  if (!step) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as Record<string, unknown>;

  const allowed = ["name", "assigneeId", "assigneeType", "quoteRequired", "quoteTimeoutHours", "assignmentMode"];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  // Derive assigneeType from collaboration scope when assigneeId changes
  if ("assigneeId" in data) {
    if (data.assigneeId) {
      const collab = await prisma.collaboration.findUnique({
        where: { id: data.assigneeId as string },
        select: { scope: true },
      });
      if (collab) {
        data.assigneeType = collab.scope === "third_party" ? "third_party" : "team_member";
      }
    } else {
      data.assigneeType = "team_member";
    }
  }

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });

  const updated = await prisma.workflowStep.update({
    where: { id: stepId },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string; stepId: string }> }
) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId, stepId } = await params;
  const step = await getStepAndVerify(stepId, pageId, user.id);
  if (!step) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.workflowStep.delete({ where: { id: stepId } });

  return NextResponse.json({ ok: true });
}
