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

  const timeline = await prisma.$transaction(async (tx) => {
    const created = await tx.projectTimeline.create({
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

        const phase = await tx.timelinePhase.create({
          data: {
            timelineId:  created.id,
            title:       tp.title,
            description: tp.description,
            phaseKey:    tp.key,
            order:       i,
            status:      "pending",
            startDate:   phaseStart,
            targetDate:  phaseTarget,
          },
        })

        if (tp.milestones.length > 0) {
          await tx.phaseMilestone.createMany({
            data: tp.milestones.map((m) => ({
              phaseId:     phase.id,
              title:       m,
              isCompleted: false,
            })),
          })
        }
      }
    }

    return tx.projectTimeline.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        phases: {
          orderBy: { order: "asc" },
          include: { milestones: { orderBy: { createdAt: "asc" } } },
        },
      },
    })
  })

  return NextResponse.json(timeline, { status: 201 })
}
