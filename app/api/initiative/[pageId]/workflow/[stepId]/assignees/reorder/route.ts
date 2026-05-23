import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string; stepId: string }> }
) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId, stepId } = await params;

  const [page, step] = await Promise.all([
    prisma.page.findUnique({ where: { id: pageId }, select: { ownerId: true } }),
    prisma.workflowStep.findUnique({
      where: { id: stepId },
      select: { id: true, initiativeId: true },
    }),
  ]);
  if (!page || page.ownerId !== user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!step || step.initiativeId !== pageId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { assignees } = (await req.json()) as { assignees: { id: string; sequence: number }[] };
  if (!Array.isArray(assignees) || assignees.length === 0)
    return NextResponse.json({ error: "assignees array required" }, { status: 400 });

  await prisma.$transaction(
    assignees.map(({ id, sequence }) =>
      (prisma as any).workflowStepAssignee.update({
        where: { id },
        data: { sequence },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
