import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import getServerUser from "@/lib/serverAuth"

type Params = { params: Promise<{ id: string; phaseId: string; milestoneId: string }> }

// ── PATCH /api/timelines/[id]/phases/[phaseId]/milestones/[milestoneId] ───────
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, phaseId, milestoneId } = await params

  // Verify ownership chain: milestone → phase → timeline → user
  const milestone = await prisma.phaseMilestone.findUnique({
    where: { id: milestoneId },
    include: {
      phase: {
        include: { timeline: { select: { userId: true, id: true } } },
      },
    },
  })

  if (!milestone) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (milestone.phase.id !== phaseId) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (milestone.phase.timeline.id !== id) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (milestone.phase.timeline.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json() as { isCompleted: boolean }

  const updated = await prisma.phaseMilestone.update({
    where: { id: milestoneId },
    data: {
      isCompleted: body.isCompleted,
      completedAt: body.isCompleted ? new Date() : null,
    },
  })

  return NextResponse.json(updated)
}
