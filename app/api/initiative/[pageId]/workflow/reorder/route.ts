import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { ownerId: true },
  });
  if (!page || page.ownerId !== user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as { steps?: { id: string; sequence: number }[] };
  if (!Array.isArray(body.steps))
    return NextResponse.json({ error: "steps array required" }, { status: 400 });

  // Verify all supplied IDs belong to this initiative
  const existing = await prisma.workflowStep.findMany({
    where: { initiativeId: pageId },
    select: { id: true },
  });
  const validIds = new Set(existing.map((s) => s.id));
  if (body.steps.some((s) => !validIds.has(s.id)))
    return NextResponse.json({ error: "Invalid step IDs" }, { status: 400 });

  await prisma.$transaction(
    body.steps.map((s) =>
      prisma.workflowStep.update({ where: { id: s.id }, data: { sequence: s.sequence } })
    )
  );

  return NextResponse.json({ ok: true });
}
