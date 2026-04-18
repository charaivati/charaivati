import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import getServerUser from '@/lib/serverAuth';
import type { GoalArchetype } from '@prisma/client';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const goal = await prisma.aiGoal.findUnique({
    where: { id },
    include: { answers: { orderBy: { order: 'asc' } } },
  });

  if (!goal || goal.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ goal });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const goal = await prisma.aiGoal.findUnique({ where: { id } });
  if (!goal || goal.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const { executionPlan, currentPhaseIndex, supportingArchetypes } = body;

  const data: Record<string, unknown> = {};
  if (executionPlan !== undefined)      data.executionPlan      = executionPlan;
  if (currentPhaseIndex !== undefined)  data.currentPhaseIndex  = Number(currentPhaseIndex);
  if (supportingArchetypes !== undefined) {
    data.supportingArchetypes = (supportingArchetypes as string[]) as GoalArchetype[];
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const updated = await prisma.aiGoal.update({ where: { id }, data });
  return NextResponse.json({ goal: updated });
}
