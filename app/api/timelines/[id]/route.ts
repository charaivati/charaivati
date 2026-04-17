import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import getServerUser from "@/lib/serverAuth"

type Params = { params: Promise<{ id: string }> }

// ── GET /api/timelines/[id] ───────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: Params) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const timeline = await prisma.projectTimeline.findUnique({
    where: { id },
    include: {
      phases: {
        orderBy: { order: "asc" },
        include: { milestones: { orderBy: { createdAt: "asc" } } },
      },
    },
  })

  if (!timeline) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (timeline.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(timeline)
}

// ── PATCH /api/timelines/[id] ─────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const existing = await prisma.projectTimeline.findUnique({ where: { id }, select: { userId: true } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (existing.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json() as {
    title?: string
    description?: string
    isLifelong?: boolean
    startDate?: string | null
    targetDate?: string | null
    status?: string
  }

  const updated = await prisma.projectTimeline.update({
    where: { id },
    data: {
      ...(body.title      !== undefined && { title:       body.title.trim() }),
      ...(body.description !== undefined && { description: body.description?.trim() ?? null }),
      ...(body.isLifelong  !== undefined && { isLifelong:  body.isLifelong }),
      ...(body.startDate   !== undefined && { startDate:   body.startDate ? new Date(body.startDate) : null }),
      ...(body.targetDate  !== undefined && { targetDate:  body.targetDate ? new Date(body.targetDate) : null }),
      ...(body.status      !== undefined && { status:      body.status }),
    },
    include: {
      phases: {
        orderBy: { order: "asc" },
        include: { milestones: { orderBy: { createdAt: "asc" } } },
      },
    },
  })

  return NextResponse.json(updated)
}

// ── DELETE /api/timelines/[id] ────────────────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const existing = await prisma.projectTimeline.findUnique({ where: { id }, select: { userId: true } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (existing.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await prisma.projectTimeline.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
