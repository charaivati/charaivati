export interface ArcContext {
  stage: number
  profile: {
    dailyAvailableHours: number | null
    healthFlags: string[]
    primaryDrive: string | null
    driveConfirmedByUser: boolean
    hobbies: any
    country: string | null
    arcStage: number
    sessionCount: number
    lastSessionAt: Date | null
    companionIdeas?: any
    nudgeDueAt?: Date | null
  }
}

export interface ArcResult {
  isCompanionSession: boolean
  stageInstruction: string
  advanceToStage: number | null
}

const STAGE_INSTRUCTIONS: Record<number, string> = {
  0: `This is a Companion invitation session. Ask the user warmly if they have a few minutes
for a quick chat. Be brief — one sentence. If they say yes, acknowledge and let the system
advance to the next stage. If no, acknowledge gracefully and suggest chatting another time.`,

  1: `You are gently trying to understand how much time this user has available in their day.
Ask ONE of these if not yet answered: How much of their day feels like theirs? When do they
feel most like themselves? What does a typical day look like?
Do not ask more than one question. Do not mention you are collecting this information.`,

  2: `Open with 'How are you feeling today?' and genuinely listen to the answer. Do not follow up
with health-specific questions — just observe. If they mention being tired or unwell, note it
warmly and don't push further. Keep this session light.`,

  3: `You are trying to understand what drives this person. Ask ONE of these: What is something
they did recently that felt meaningful? When life is going well, what are they doing?
After 2 exchanges, announce your inference: 'You sound like a [Type] to me — [one sentence
description]. Does that feel right?' Types: Seeker (drawn to understanding and depth),
Guardian (protects and cares for others), Builder (creates and ships things), Keeper (manages
and sustains systems and resources).`,

  4: `Ask what the user does when they have free time. Be curious, not systematic. If they mention
something interesting, ask one follow-up. Note whether hobbies are social or solo, active or
passive. Keep it conversational.`,

  5: `If the topic of meeting local people or finding community comes up naturally, offer location
sharing with this exact framing: 'If you'd like to find people near you with similar interests,
I can help — but I'd need to know roughly where you are. You decide how specific to get.
Want to try?' If they say yes, ask country first, then stop and wait for next session for more.
Never bring up location unprompted unless the user has mentioned wanting local connections.`,

  6: `Ask what the user has been thinking about lately — work, a side thing, anything. When an idea
surfaces, evaluate it in 2–3 exchanges. Does it fit their drive? Is there someone who would
pay for this or join this? If viable, ask: 'Should I create a draft page for this?' If not
viable, say so directly but kindly and ask what is pulling them toward it. Keep moving.`,
}

const ONGOING_INSTRUCTION = `This is a check-in session. Open with 'How are you feeling today?' Reference the last thing
they mentioned. Suggest one small thing based on their energy level. If matching conditions
are met (drive confirmed, at least one hobby, location shared), consider whether to introduce
a community or friend suggestion this session. Keep it short — this should feel like a
15-minute coffee check-in, not a session.`

function getActiveHobbiesCount(hobbies: any): number {
  if (!hobbies) return 0
  try {
    const arr = Array.isArray(hobbies) ? hobbies : JSON.parse(hobbies as string)
    return arr.filter((h: any) => h?.frequency === 'active').length
  } catch {
    return 0
  }
}

function getIdeasCount(ideas: any): number {
  if (!ideas) return 0
  try {
    const arr = Array.isArray(ideas) ? ideas : JSON.parse(ideas as string)
    return arr.length
  } catch {
    return 0
  }
}

function computeAdvanceToStage(ctx: ArcContext): number | null {
  const { stage, profile } = ctx

  switch (stage) {
    case 0:
      return 1

    case 1:
      return profile.dailyAvailableHours !== null ? 2 : null

    case 2:
      return (profile.healthFlags.length >= 1 || profile.sessionCount >= 2) ? 3 : null

    case 3:
      return profile.driveConfirmedByUser ? 4 : null

    case 4:
      return getActiveHobbiesCount(profile.hobbies) >= 1 ? 5 : null

    case 5:
      return 6

    case 6:
      return getIdeasCount(profile.companionIdeas) >= 1 ? 7 : null

    default:
      return null
  }
}

export function getArcInstruction(ctx: ArcContext): ArcResult {
  const { stage, profile } = ctx

  const isCompanionSession =
    stage < 7 ||
    (profile.nudgeDueAt != null && new Date(profile.nudgeDueAt) <= new Date()) ||
    profile.lastSessionAt === null

  const stageInstruction = stage >= 7
    ? ONGOING_INSTRUCTION
    : STAGE_INSTRUCTIONS[stage] ?? ONGOING_INSTRUCTION

  const advanceToStage = computeAdvanceToStage(ctx)

  return { isCompanionSession, stageInstruction, advanceToStage }
}
