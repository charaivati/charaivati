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

  const dayOfWeek = now.getDay()
  const message = nudgeDue ? NUDGE_MESSAGES[dayOfWeek] : null

  // Update nudgeDueAt when nudge is due
  if (nudgeDue) {
    const daysToAdd = NUDGE_DAYS[profile.energyState ?? 'grounded'] ?? 3
    const nextNudge = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000)
    await (db as any).userCompanionProfile.update({
      where: { userId },
      data: { nudgeDueAt: nextNudge, updatedAt: new Date() },
    })
  }

  return NextResponse.json({ nudgeDue, message })
}
