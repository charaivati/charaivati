import { NextRequest, NextResponse } from 'next/server';
import { chatComplete } from '@/app/api/aiClient';
import { prisma } from '@/lib/prisma';
import getServerUser from '@/lib/serverAuth';
import { SECTIONS } from '@/lib/site/capabilityRegistry';
import type { ExecutionPlan, PlanPhase, PlanTask } from '@/lib/site/executionPlanTypes';
import type { GoalArchetype, GoalMode } from '@prisma/client';

const VALID_ARCHETYPES = new Set<string>(['LEARN', 'BUILD', 'EXECUTE', 'CONNECT']);

const FALLBACK_PLAN: ExecutionPlan = {
  supportingArchetypes: [],
  nextAction: {
    text: 'Open the Time section and set your first task for this week',
    sectionKey: 'self.time',
    frequency: 'once',
  },
  minimumViableSession: 'Spend 10 minutes today on this goal, in any form',
  phases: [
    { title: 'Foundation',  durationWeeks: 4,  tasks: [], graduationCriteria: "When you've shown up consistently for 4 weeks" },
    { title: 'Growth',      durationWeeks: 8,  tasks: [], graduationCriteria: 'When the work feels routine' },
    { title: 'Expansion',   durationWeeks: 12, tasks: [], graduationCriteria: "When you're ready to grow scope" },
  ],
  relevantSections: ['self.time'],
  honestLimitations: ['AI-generated plan unavailable; this is a placeholder you can edit'],
};

// ─── Validation ───────────────────────────────────────────────────────────────

function validateSkeleton(raw: unknown): raw is Omit<ExecutionPlan, 'phases'> & { phases: Omit<PlanPhase, 'tasks'>[] } {
  if (!raw || typeof raw !== 'object') return false;
  const p = raw as Record<string, unknown>;
  if (!Array.isArray(p.supportingArchetypes)) return false;
  if (!p.supportingArchetypes.every((a: unknown) => typeof a === 'string' && VALID_ARCHETYPES.has(a as string))) return false;
  if (!p.nextAction || typeof p.nextAction !== 'object') return false;
  const na = p.nextAction as Record<string, unknown>;
  if (typeof na.text !== 'string' || !na.text.trim()) return false;
  if (typeof p.minimumViableSession !== 'string') return false;
  if (!Array.isArray(p.phases) || p.phases.length !== 3) return false;
  if (!Array.isArray(p.relevantSections)) return false;
  if (!Array.isArray(p.honestLimitations)) return false;
  return true;
}

function validateTaskFill(raw: unknown): raw is { phases: { tasks: PlanTask[] }[] } {
  if (!raw || typeof raw !== 'object') return false;
  const p = raw as Record<string, unknown>;
  if (!Array.isArray(p.phases) || p.phases.length !== 3) return false;
  for (const ph of p.phases as unknown[]) {
    if (!ph || typeof ph !== 'object') return false;
    if (!Array.isArray((ph as Record<string, unknown>).tasks)) return false;
  }
  return true;
}

function validatePlan(raw: unknown): raw is ExecutionPlan {
  if (!validateSkeleton(raw)) return false;
  const p = raw as Record<string, unknown>;
  const allTasks: PlanTask[] = (p.phases as PlanPhase[]).flatMap((ph) => ph.tasks ?? []);
  allTasks.push(p.nextAction as PlanTask);
  for (const task of allTasks) {
    if (task.sectionKey !== null && task.sectionKey !== undefined && !(task.sectionKey in SECTIONS)) return false;
  }
  return true;
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

type GoalContext = {
  archetype: GoalArchetype;
  mode: GoalMode;
  title: string;
  whyNow: string;
  commitment: string;
  successSignal: string;
  answers: { questionKey: string; questionText: string; answer: string }[];
};

function buildSkeletonMessages(body: GoalContext) {
  const systemPrompt = `You are generating the STRUCTURE of an execution plan for a user's goal. Do NOT include tasks yet — only the skeleton.

Your job:
1. Identify 0–2 SUPPORTING archetypes that the user's answers actually imply.
2. Generate one concrete NEXT ACTION — specific, under 15 words, with a sectionKey from the registry or null.
3. Define MINIMUM VIABLE SESSION — one sentence, what counts as showing up on a bad day.
4. Generate exactly 3 PHASES — Foundation, Growth, and a third named for the goal's outcome. Each has a title, durationWeeks, and graduationCriteria ("When you can X…"). No tasks yet.
5. List relevantSections (keys from registry actually relevant to this goal).
6. List honestLimitations (planned sections used, gaps in the platform).

Return strict JSON — no tasks arrays:
{
  "supportingArchetypes": [],
  "nextAction": { "text": "...", "sectionKey": "self.time" | null, "frequency": "once" },
  "minimumViableSession": "...",
  "phases": [
    { "title": "Foundation", "durationWeeks": 4, "graduationCriteria": "..." },
    { "title": "Growth",     "durationWeeks": 8, "graduationCriteria": "..." },
    { "title": "...",        "durationWeeks": 12, "graduationCriteria": "..." }
  ],
  "relevantSections": ["self.time"],
  "honestLimitations": []
}`;

  const sectionsSummary = Object.values(SECTIONS).map((s) => ({
    key: s.key, label: s.label, status: s.status, eta: s.eta,
  }));

  const answersFormatted = body.answers.map((a) => `Q: ${a.questionText}\nA: ${a.answer}`).join('\n\n');

  return [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: `Goal: ${body.title}\nWhy now: ${body.whyNow}\nCommitment: ${body.commitment}\nSuccess: ${body.successSignal}\nArchetype: ${body.archetype}\nMode: ${body.mode}\n\nAnswers:\n${answersFormatted}\n\nSections:\n${JSON.stringify(sectionsSummary)}` },
  ];
}

function buildTasksMessages(body: GoalContext, skeleton: ExecutionPlan) {
  const systemPrompt = `You are filling in tasks for an execution plan skeleton. Generate 3–5 concrete tasks per phase.

ROUTING: Tag each task with a sectionKey from the registry if applicable, otherwise null.
TONE: Direct, concrete. Not abstract.

Return strict JSON — exactly 3 phase objects with tasks arrays:
{
  "phases": [
    { "tasks": [{ "text": "...", "sectionKey": "self.time" | null, "frequency": "daily|weekly|once", "archetype": "EXECUTE" }, ...] },
    { "tasks": [...] },
    { "tasks": [...] }
  ]
}`;

  const sectionsSummary = Object.values(SECTIONS)
    .filter(s => s.status !== 'planned')
    .map(s => ({ key: s.key, label: s.label, status: s.status }));

  const answersFormatted = body.answers.map((a) => `Q: ${a.questionText}\nA: ${a.answer}`).join('\n\n');

  const skeletonSummary = skeleton.phases.map((ph, i) => `Phase ${i + 1}: ${ph.title} (${ph.durationWeeks}w) — graduates when: ${ph.graduationCriteria}`).join('\n');

  return [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: `Goal: ${body.title}\nArchetype: ${body.archetype}\nNext action: ${skeleton.nextAction.text}\n\nPhase structure:\n${skeletonSummary}\n\nAnswers:\n${answersFormatted}\n\nAvailable sections:\n${JSON.stringify(sectionsSummary)}` },
  ];
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.goalId) return NextResponse.json({ error: 'goalId is required' }, { status: 400 });

  const { goalId, step = 'skeleton' } = body as { goalId: string; step?: 'skeleton' | 'tasks' };

  const goal = await prisma.aiGoal.findUnique({
    where: { id: goalId },
    include: { answers: { orderBy: { order: 'asc' } } },
  });
  if (!goal || goal.userId !== user.id) {
    return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
  }

  const ctx: GoalContext = {
    archetype:     body.archetype     ?? goal.archetype,
    mode:          body.mode          ?? goal.mode,
    title:         body.title         ?? goal.title,
    whyNow:        body.whyNow        ?? goal.whyNow        ?? '',
    commitment:    body.commitment    ?? goal.commitment    ?? '',
    successSignal: body.successSignal ?? goal.successSignal ?? '',
    answers:       body.answers       ?? goal.answers.map((a: { questionKey: string; questionText: string; answer: string }) => ({
      questionKey: a.questionKey, questionText: a.questionText, answer: a.answer,
    })),
  };

  // ── Step: tasks ──────────────────────────────────────────────────────────────
  if (step === 'tasks') {
    const existing = goal.executionPlan as unknown as ExecutionPlan | null;
    if (!existing) return NextResponse.json({ error: 'No skeleton plan found' }, { status: 400 });

    let usedFallback = false;
    let taskFill: { phases: { tasks: PlanTask[] }[] } | null = null;

    try {
      const content = await chatComplete({
        model: process.env.GOAL_AI_PLAN_MODEL ?? 'openai/gpt-4o-mini',
        messages: buildTasksMessages(ctx, existing),
        maxTokens: 600,
        temperature: 0.5,
        jsonMode: true,
      });
      const raw = JSON.parse(content.trim());
      if (validateTaskFill(raw)) {
        taskFill = raw;
      } else {
        console.error('[goal-ai/execution-plan/tasks] Validation failed:', JSON.stringify(raw));
        usedFallback = true;
      }
    } catch (err) {
      console.error('[goal-ai/execution-plan/tasks] Failed:', err);
      usedFallback = true;
    }

    const mergedPhases: PlanPhase[] = existing.phases.map((ph, i) => ({
      ...ph,
      tasks: (!usedFallback && taskFill) ? (taskFill.phases[i]?.tasks ?? []) : [],
    }));

    const merged: ExecutionPlan = { ...existing, phases: mergedPhases, _partial: false };

    await prisma.aiGoal.update({
      where: { id: goalId },
      data: { executionPlan: merged as object },
    });

    return NextResponse.json({ plan: merged, fallback: usedFallback });
  }

  // ── Step: skeleton (default) ─────────────────────────────────────────────────
  let plan: ExecutionPlan = { ...FALLBACK_PLAN, _partial: false };
  let usedFallback = false;

  try {
    const content = await chatComplete({
      model: process.env.GOAL_AI_PLAN_MODEL ?? 'openai/gpt-4o-mini',
      messages: buildSkeletonMessages(ctx),
      maxTokens: 400,
      temperature: 0.5,
      jsonMode: true,
    });

    let raw: unknown;
    try { raw = JSON.parse(content.trim()); }
    catch (e) { console.error('[goal-ai/execution-plan/skeleton] JSON parse failed', e); usedFallback = true; }

    if (!usedFallback && validateSkeleton(raw)) {
      const skel = raw as Record<string, unknown>;
      plan = {
        supportingArchetypes: skel.supportingArchetypes as GoalArchetype[],
        nextAction:           skel.nextAction as PlanTask,
        minimumViableSession: skel.minimumViableSession as string,
        phases:               (skel.phases as Omit<PlanPhase, 'tasks'>[]).map(ph => ({ ...ph, tasks: [] })),
        relevantSections:     skel.relevantSections as string[],
        honestLimitations:    skel.honestLimitations as string[],
        _partial:             true, // tasks not filled yet
      };
    } else if (!usedFallback) {
      console.error('[goal-ai/execution-plan/skeleton] Validation failed:', JSON.stringify(raw));
      usedFallback = true;
    }
  } catch (err) {
    console.error('[goal-ai/execution-plan/skeleton] AI call failed:', err);
    usedFallback = true;
  }

  await prisma.aiGoal.update({
    where: { id: goalId },
    data: {
      executionPlan:        plan as object,
      supportingArchetypes: plan.supportingArchetypes as GoalArchetype[],
      currentPhaseIndex:    0,
    },
  });

  return NextResponse.json({ plan, fallback: usedFallback, partial: !usedFallback });
}
