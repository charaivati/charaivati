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

  try {
    const profile = await (db as any).userCompanionProfile.findUnique({ where: { userId } })

    if (!profile) {
      return NextResponse.json({ nudgeDue: true, message: NUDGE_MESSAGES[0] })
    }

    const now = new Date()
    const nudgeDue = !profile.nudgeDueAt || new Date(profile.nudgeDueAt) <= now
    const message = nudgeDue ? NUDGE_MESSAGES[now.getDay()] : null

    return NextResponse.json({ nudgeDue, message })
  } catch (err) {
    // A nudge is non-critical — never let a DB hiccup surface as a 500 to the widget.
    console.error('[companion/nudge] GET failed:', err)
    return NextResponse.json({ nudgeDue: false, message: null })
  }
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

  try {
    const profile = await (db as any).userCompanionProfile.findUnique({ where: { userId } })

    // Idempotent: if nudge is already scheduled in the future, do nothing.
    if (profile?.nudgeDueAt && new Date(profile.nudgeDueAt) > now) {
      return NextResponse.json({ acknowledged: true, nextNudgeAt: profile.nudgeDueAt })
    }

    const daysToAdd = NUDGE_DAYS[profile?.energyState ?? 'grounded'] ?? 3
    const nextNudge = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000)
    const { randomUUID } = await import('crypto')

    // Use upsert (atomic at the DB level) instead of find-then-create — POST /api/companion/session
    // runs the same find-then-create pattern for the same unique `userId` and can fire moments apart
    // (e.g. right after a companion session opens), so a plain create here can lose a P2002 race.
    const updated = await (db as any).userCompanionProfile.upsert({
      where: { userId },
      create: {
        id: `c${randomUUID().replace(/-/g, '').slice(0, 24)}`,
        userId,
        nudgeDueAt: nextNudge,
        // Required: `healthFlags` is NOT NULL with no DB default and no @default([]) in
        // the Prisma schema — omitting it throws P2011 "Null constraint violation" on create.
        healthFlags: [],
      },
      update: { nudgeDueAt: nextNudge, updatedAt: now },
    })

    return NextResponse.json({ acknowledged: true, nextNudgeAt: updated.nudgeDueAt })
  } catch (err) {
    // A nudge is non-critical — never let a DB hiccup surface as a 500 to the widget.
    console.error('[companion/nudge] POST failed:', err)
    return NextResponse.json({ acknowledged: false })
  }
}
