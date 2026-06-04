import { NextResponse } from 'next/server'
import { getTokenFromRequest, verifySessionToken } from '@/lib/session'
import { db } from '@/lib/db'

const NUDGE_MESSAGES = [
  "Are you free for a quick chat?",
  "Haven't talked in a while — how are things going?",
  "Got 5 minutes? I have something to ask you.",
  "How's your week going so far?",
  "Checking in — what's on your mind lately?",
  "End of the week — how did it go?",
  "What are you up to this weekend?",
]

const NUDGE_DAYS: Record<string, number> = {
  depleted:  5,
  stretched: 4,
  grounded:  3,
  charged:   2,
}

// READ-ONLY — no side effects, does not advance nudgeDueAt.
// Call this on page load to check whether to show the red dot.
export async function GET(req: Request) {
  const token = getTokenFromRequest(req)
  const payload = await verifySessionToken(token)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = payload.userId
  const profile = await (db as any).userCompanionProfile.findUnique({ where: { userId } })

  if (!profile) {
    return NextResponse.json({ nudgeDue: true, message: NUDGE_MESSAGES[0] })
  }

  const now = new Date()
  const nudgeDue = !profile.nudgeDueAt || new Date(profile.nudgeDueAt) <= now
  const message = nudgeDue ? NUDGE_MESSAGES[now.getDay()] : null

  return NextResponse.json({ nudgeDue, message })
}

// ACKNOWLEDGE — advances nudgeDueAt. Call this when the user opens the
// companion OR dismisses the nudge banner. Idempotent: safe to call
// twice (if nudgeDueAt is already in the future, returns early with no write).
export async function POST(req: Request) {
  const token = getTokenFromRequest(req)
  const payload = await verifySessionToken(token)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = payload.userId
  const now = new Date()

  let profile = await (db as any).userCompanionProfile.findUnique({ where: { userId } })

  // Idempotent: if nudge is already scheduled in the future, do nothing.
  if (profile?.nudgeDueAt && new Date(profile.nudgeDueAt) > now) {
    return NextResponse.json({ acknowledged: true, nextNudgeAt: profile.nudgeDueAt })
  }

  if (!profile) {
    const { randomUUID } = await import('crypto')
    const daysToAdd = NUDGE_DAYS['grounded']
    const nextNudge = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000)
    profile = await (db as any).userCompanionProfile.create({
      data: {
        id: `c${randomUUID().replace(/-/g, '').slice(0, 24)}`,
        userId,
        nudgeDueAt: nextNudge,
      },
    })
    return NextResponse.json({ acknowledged: true, nextNudgeAt: nextNudge })
  }

  const daysToAdd = NUDGE_DAYS[profile.energyState ?? 'grounded'] ?? 3
  const nextNudge = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000)

  await (db as any).userCompanionProfile.update({
    where: { userId },
    data: { nudgeDueAt: nextNudge, updatedAt: now },
  })

  return NextResponse.json({ acknowledged: true, nextNudgeAt: nextNudge })
}
