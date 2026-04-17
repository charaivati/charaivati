// app/api/self/goals/route.ts — save an AI-created goal + its answers to the DB
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import getServerUser from '@/lib/serverAuth';
import type { GoalArchetype, GoalMode, GoalStatus } from '@prisma/client';

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

  const goal = await prisma.aiGoal.create({
    data: {
      userId:        user.id,
      archetype:     archetype as GoalArchetype,
      mode:          mode as GoalMode,
      title:         String(title).slice(0, 200),
      whyNow:        whyNow   ? String(whyNow).slice(0, 1000)        : null,
      commitment:    commitment ? String(commitment).slice(0, 500)   : null,
      successSignal: successSignal ? String(successSignal).slice(0, 1000) : null,
      riskFlags:     riskFlags ?? [],
      status:        'ACTIVE' as GoalStatus,
      answers: {
        create: (answers ?? []).map((a: {
          questionKey: string;
          questionText: string;
          answer: string;
          reflection?: string;
        }, i: number) => ({
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
