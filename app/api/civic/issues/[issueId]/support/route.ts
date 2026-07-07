import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { ACTIVATION_THRESHOLD } from "@/lib/civic/constants";

// POST /api/civic/issues/[issueId]/support — toggle the caller's upvote.
// Residents of the issue's unit only (homeUnitId must match). Crossing
// ACTIVATION_THRESHOLD promotes proposed → active; removal never demotes —
// validated demand stays validated.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { issueId } = await params;

  const [issue, me] = await Promise.all([
    prisma.issue.findUnique({ where: { id: issueId }, select: { id: true, unitId: true, status: true } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { homeUnitId: true } }),
  ]);
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  if (issue.status === "archived") {
    return NextResponse.json({ error: "This issue is archived." }, { status: 409 });
  }
  if (me?.homeUnitId !== issue.unitId) {
    return NextResponse.json(
      { error: "Only residents of this unit can support its issues." },
      { status: 403 }
    );
  }

  const existing = await prisma.issueSupport.findUnique({
    where: { userId_issueId: { userId: user.id, issueId } },
  });

  const updated = await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.issueSupport.delete({ where: { id: existing.id } });
      return tx.issue.update({
        where: { id: issueId },
        data: { supporterCount: { decrement: 1 } },
        select: { supporterCount: true, status: true },
      });
    }
    await tx.issueSupport.create({ data: { userId: user.id, issueId } });
    const bumped = await tx.issue.update({
      where: { id: issueId },
      data: { supporterCount: { increment: 1 } },
      select: { supporterCount: true, status: true },
    });
    if (bumped.status === "proposed" && bumped.supporterCount >= ACTIVATION_THRESHOLD) {
      return tx.issue.update({
        where: { id: issueId },
        data: { status: "active" },
        select: { supporterCount: true, status: true },
      });
    }
    return bumped;
  });

  return NextResponse.json({
    ok: true,
    supported: !existing,
    supporterCount: updated.supporterCount,
    status: updated.status,
  });
}
