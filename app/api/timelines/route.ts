import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import getServerUser from "@/lib/serverAuth"
import { getTemplate } from "@/lib/timeline-templates"

// ── GET /api/timelines ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const timelines = await prisma.projectTimeline.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { phases: true } },
      phases: {
        select: { status: true },
      },
    },
  })

  return NextResponse.json(timelines)
}

// ── POST /api/timelines ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as {
    goalId?: string
    title: string
    description?: string
    templateId: string
    domain: string
    isLifelong?: boolean
    startDate?: string
    targetDate?: string
  }

  const { goalId, title, description, templateId, domain, isLifelong, startDate, targetDate } = body

  if (!title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 })
  if (!domain?.trim()) return NextResponse.json({ error: "domain required" }, { status: 400 })

  // Resolve template and build phase data
  const template = templateId ? getTemplate(templateId) : undefined

  // Pre-compute phase date ranges in JS (no DB needed)
  type PhaseRow = { title: string; description: string | null; phaseKey: string; order: number; startDate: Date | null; targetDate: Date | null; milestones: string[] }
  const phaseRows: PhaseRow[] = []
  if (template) {
    let cursor = startDate ? new Date(startDate) : null
    for (let i = 0; i < template.phases.length; i++) {
      const tp = template.phases[i]
      const phaseStart = cursor ? new Date(cursor) : null
      let phaseTarget: Date | null = null
      if (cursor && tp.defaultDurationDays) {
        phaseTarget = new Date(cursor)
        phaseTarget.setDate(phaseTarget.getDate() + tp.defaultDurationDays)
        cursor = new Date(phaseTarget)
      }
      phaseRows.push({ title: tp.title, description: tp.description, phaseKey: tp.key, order: i, startDate: phaseStart, targetDate: phaseTarget, milestones: tp.milestones })
    }
  }

  // Single transaction: create timeline → phases in parallel → milestones in parallel
  const created = await prisma.$transaction(async (tx) => {
    const tl = await tx.projectTimeline.create({
      data: {
        userId:      user.id,
        goalId:      goalId ?? null,
        title:       title.trim(),
        description: description?.trim() ?? null,
        domain,
        templateId:  templateId ?? null,
        isLifelong:  isLifelong ?? false,
        startDate:   startDate ? new Date(startDate) : null,
        targetDate:  (!isLifelong && targetDate) ? new Date(targetDate) : null,
        status:      "active",
      },
    })

    if (phaseRows.length > 0) {
      // Create all phases in parallel
      const phases = await Promise.all(
        phaseRows.map(p => tx.timelinePhase.create({
          data: { timelineId: tl.id, title: p.title, description: p.description, phaseKey: p.phaseKey, order: p.order, status: "pending", startDate: p.startDate, targetDate: p.targetDate },
        }))
      )

      // Create all milestones in one createMany per phase (parallel)
      const milestoneBatches = phases
        .map((phase, i) => phaseRows[i].milestones.length > 0
          ? tx.phaseMilestone.createMany({ data: phaseRows[i].milestones.map(m => ({ phaseId: phase.id, title: m, isCompleted: false })) })
          : null
        )
        .filter(Boolean)

      if (milestoneBatches.length > 0) await Promise.all(milestoneBatches)
    }

    return tl.id
  }, { timeout: 15000 })

  // Fetch final shape outside transaction (no timeout pressure)
  const timeline = await prisma.projectTimeline.findUniqueOrThrow({
    where: { id: created },
    include: {
      phases: {
        orderBy: { order: "asc" },
        include: { milestones: { orderBy: { createdAt: "asc" } } },
      },
    },
  })

  return NextResponse.json(timeline, { status: 201 })
}
