// app/api/self/goals/route.ts — save an AI-created goal + its answers to the DB.
// GOAL-UNIFY-1: creation goes through lib/goals/createGoalRecord (the single
// write path — also mirrors into Profile.goals). Do not create AiGoal rows
// directly anywhere else.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import getServerUser from '@/lib/serverAuth';
import { createGoalRecord } from '@/lib/goals/createGoalRecord';
import type { GoalArchetype, GoalMode } from '@prisma/client';

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const {
    archetype,
    mode,
    title,
    whyNow,
    commitment,
    successSignal,
    riskFlags,
    answers, // { questionKey, questionText, answer, reflection }[]
  } = body;

  if (!archetype || !mode || !title?.trim()) {
    return NextResponse.json({ error: 'archetype, mode, and title are required' }, { status: 422 });
  }

  const goal = await createGoalRecord({
    userId: user.id,
    archetype: archetype as GoalArchetype,
    mode: mode as GoalMode,
    title,
    whyNow,
    commitment,
    successSignal,
    riskFlags,
    answers,
  });

  return NextResponse.json({ goal }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const goals = await prisma.aiGoal.findMany({
    where:   { userId: user.id, status: { not: 'ARCHIVED' } },
    include: { answers: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ goals });
}
