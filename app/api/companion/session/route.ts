import { NextResponse } from 'next/server'
import { getTokenFromRequest, verifySessionToken } from '@/lib/session'
import { db } from '@/lib/db'
import { parseMessage } from '@/lib/companion/signalParser'
import { getArcInstruction } from '@/lib/companion/arcStateMachine'

export async function POST(req: Request) {
  const token = getTokenFromRequest(req)
  const payload = await verifySessionToken(token)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message } = await req.json() as { message: string }
  if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })

  const userId = payload.userId

  // Fetch or create companion profile
  let profile = await (db as any).userCompanionProfile.findUnique({ where: { userId } })
  if (!profile) {
    // upsert (atomic) — POST /api/companion/nudge can fire moments apart for the same brand-new
    // userId and runs the same find-then-create pattern; a plain create here can lose a P2002 race.
    const { randomUUID } = await import('crypto')
    profile = await (db as any).userCompanionProfile.upsert({
      where: { userId },
      // healthFlags is NOT NULL with no DB default / no @default([]) in schema — must be supplied.
      create: { id: `c${randomUUID().replace(/-/g, '').slice(0, 24)}`, userId, healthFlags: [] },
      update: {},
    })
  }

  // Parse signals from this message
  const signals = parseMessage(message)

  // Merge health flags (no duplicates)
  const existingFlags: string[] = profile.healthFlags ?? []
  const mergedFlags = Array.from(new Set([...existingFlags, ...signals.healthFlags]))

  // Build update payload from signals
  const update: Record<string, unknown> = {
    healthFlags: mergedFlags,
    lastSessionAt: new Date(),
    sessionCount: (profile.sessionCount ?? 0) + 1,
    updatedAt: new Date(),
  }
  if (signals.workPattern) update.workPattern = signals.workPattern
  if (signals.peakWindow) update.peakWindow = signals.peakWindow
  if (signals.estimatedHours !== null) update.dailyAvailableHours = signals.estimatedHours

  // Save updated profile before arc computation
  const updatedProfile = await (db as any).userCompanionProfile.update({
    where: { userId },
    data: update,
  })

  // Arc stage logic
  const arcCtx = {
    stage: updatedProfile.arcStage,
    profile: {
      dailyAvailableHours: updatedProfile.dailyAvailableHours,
      healthFlags: updatedProfile.healthFlags,
      primaryDrive: updatedProfile.primaryDrive,
      driveConfirmedByUser: updatedProfile.driveConfirmedByUser,
      hobbies: updatedProfile.hobbies,
      country: updatedProfile.country,
      arcStage: updatedProfile.arcStage,
      sessionCount: updatedProfile.sessionCount,
      lastSessionAt: updatedProfile.lastSessionAt,
      companionIdeas: updatedProfile.companionIdeas,
      nudgeDueAt: updatedProfile.nudgeDueAt,
    },
  }

  const { isCompanionSession, stageInstruction, advanceToStage } = getArcInstruction(arcCtx)

  // Advance stage if criteria met
  if (advanceToStage !== null && advanceToStage !== updatedProfile.arcStage) {
    await (db as any).userCompanionProfile.update({
      where: { userId },
      data: { arcStage: advanceToStage, updatedAt: new Date() },
    })
  }

  // Compute energy state
  const activeHobbies = (() => {
    try {
      const arr = Array.isArray(updatedProfile.hobbies) ? updatedProfile.hobbies : JSON.parse(updatedProfile.hobbies ?? '[]')
      return arr.filter((h: any) => h?.frequency === 'active').length
    } catch { return 0 }
  })()

  let score = 0
  if ((updatedProfile.dailyAvailableHours ?? 0) >= 2) score += 1
  if (mergedFlags.length === 0) score += 2
  else if (mergedFlags.length <= 2) score += 1
  if (updatedProfile.driveConfirmedByUser) score += 1
  if (activeHobbies >= 1) score += 1
  if (signals.sentiment === 'positive') score += 1

  const energyState =
    score >= 5 ? 'charged' :
    score >= 3 ? 'grounded' :
    score >= 1 ? 'stretched' : 'depleted'

  await (db as any).userCompanionProfile.update({
    where: { userId },
    data: { energyState, lastEnergyUpdate: new Date(), updatedAt: new Date() },
  })

  return NextResponse.json({
    arcStage: advanceToStage ?? updatedProfile.arcStage,
    energyState,
    stageInstruction,
    isCompanionSession,
  })
}
