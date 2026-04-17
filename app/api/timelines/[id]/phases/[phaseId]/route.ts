import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import getServerUser from "@/lib/serverAuth"

type Params = { params: Promise<{ id: string; phaseId: string }> }

// ── PATCH /api/timelines/[id]/phases/[phaseId] ────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, phaseId } = await params

  // Verify ownership through timeline
  const phase = await prisma.timelinePhase.findUnique({
    where: { id: phaseId },
    include: { timeline: { select: { userId: true, id: true } } },
  })

  if (!phase) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (phase.timeline.id !== id) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (phase.timeline.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json() as {
    status?: string
    startDate?: string | null
    targetDate?: string | null
    completedAt?: string | null
    notes?: string | null
  }

  const updated = await prisma.timelinePhase.update({
    where: { id: phaseId },
    data: {
      ...(body.status      !== undefined && { status:      body.status }),
      ...(body.startDate   !== undefined && { startDate:   body.startDate   ? new Date(body.startDate)   : null }),
      ...(body.targetDate  !== undefined && { targetDate:  body.targetDate  ? new Date(body.targetDate)  : null }),
      ...(body.completedAt !== undefined && { completedAt: body.completedAt ? new Date(body.completedAt) : null }),
      ...(body.notes       !== undefined && { notes:       body.notes ?? null }),
    },
    include: { milestones: { orderBy: { createdAt: "asc" } } },
  })

  return NextResponse.json(updated)
}
