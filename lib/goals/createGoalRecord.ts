// lib/goals/createGoalRecord.ts — GOAL-UNIFY-1: the ONE place a goal comes into
// existence. Creates the AiGoal row (execution-plan pipeline) and mirrors a
// GoalEntry into Profile.goals JSON (per-goal skills, funds/environment blocks)
// so both stores see every goal regardless of which UI created it. The mirror
// entry's id IS the AiGoal id — the stable link between the two stores.
// Callers: POST /api/self/goals (GoalCreationFlow + onboarding mirror) and
// POST /api/self/profile-proposal (chat/Listen goal accepts).

import { prisma } from '@/lib/prisma';
import type { GoalArchetype, GoalMode, GoalStatus } from '@prisma/client';

export const ARCHETYPE_TO_DRIVE: Record<string, string> = {
  LEARN: 'learning',
  CONNECT: 'helping',
  BUILD: 'building',
  EXECUTE: 'doing',
};

export const DRIVE_TO_ARCHETYPE: Record<string, GoalArchetype> = {
  learning: 'LEARN',
  helping: 'CONNECT',
  building: 'BUILD',
  doing: 'EXECUTE',
};

type GoalAnswer = { questionKey: string; questionText: string; answer: string; reflection?: string };

export async function createGoalRecord(opts: {
  userId: string;
  archetype: GoalArchetype;
  mode: GoalMode;
  title: string;
  whyNow?: string | null;
  commitment?: string | null;
  successSignal?: string | null;
  riskFlags?: unknown[];
  answers?: GoalAnswer[];
}) {
  const goal = await prisma.aiGoal.create({
    data: {
      userId:        opts.userId,
      archetype:     opts.archetype,
      mode:          opts.mode,
      title:         String(opts.title).slice(0, 200),
      whyNow:        opts.whyNow ? String(opts.whyNow).slice(0, 1000) : null,
      commitment:    opts.commitment ? String(opts.commitment).slice(0, 500) : null,
      successSignal: opts.successSignal ? String(opts.successSignal).slice(0, 1000) : null,
      riskFlags:     (opts.riskFlags ?? []) as string[],
      status:        'ACTIVE' as GoalStatus,
      answers: {
        create: (opts.answers ?? []).map((a, i) => ({
          questionKey:  String(a.questionKey),
          questionText: String(a.questionText),
          answer:       String(a.answer),
          reflection:   a.reflection ? String(a.reflection) : null,
          order:        i,
        })),
      },
    },
    include: { answers: true },
  });

  // Mirror into Profile.goals — deduped by statement so onboarding (which saves
  // profile goals client-side first) and chat proposals (applyProfileProposal
  // appends first) never produce doubles. Non-blocking: the AiGoal is the
  // primary write; a failed mirror must not fail goal creation.
  try {
    const prof = await prisma.profile.findUnique({ where: { userId: opts.userId }, select: { goals: true } });
    const goals = Array.isArray(prof?.goals) ? [...(prof!.goals as unknown[])] : [];
    const stmt = goal.title.trim().toLowerCase();
    const exists = goals.some((g) => String((g as { statement?: string })?.statement ?? '').trim().toLowerCase() === stmt);
    if (!exists) {
      goals.push({
        id: goal.id,
        driveId: ARCHETYPE_TO_DRIVE[goal.archetype] ?? 'learning',
        statement: goal.title,
        description: goal.whyNow ?? '',
        skills: [],
        linkedBusinessIds: [],
        saved: true,
      });
      await prisma.profile.upsert({
        where: { userId: opts.userId },
        update: { goals: goals as object[] },
        create: { userId: opts.userId, goals: goals as object[] },
      });
    }
  } catch (e) {
    console.warn('[createGoalRecord] profile mirror failed', e);
  }

  return goal;
}
