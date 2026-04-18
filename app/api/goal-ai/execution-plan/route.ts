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
    {
      title: 'Foundation',
      durationWeeks: 4,
      tasks: [],
      graduationCriteria: "When you've shown up consistently for 4 weeks",
    },
    {
      title: 'Growth',
      durationWeeks: 8,
      tasks: [],
      graduationCriteria: 'When the work feels routine',
    },
    {
      title: 'Expansion',
      durationWeeks: 12,
      tasks: [],
      graduationCriteria: "When you're ready to grow scope",
    },
  ],
  relevantSections: ['self.time'],
  honestLimitations: ['AI-generated plan unavailable; this is a placeholder you can edit'],
};

function validatePlan(raw: unknown): raw is ExecutionPlan {
  if (!raw || typeof raw !== 'object') return false;
  const p = raw as Record<string, unknown>;

  if (!Array.isArray(p.supportingArchetypes)) return false;
  if (!p.supportingArchetypes.every((a: unknown) => typeof a === 'string' && VALID_ARCHETYPES.has(a))) return false;

  if (!p.nextAction || typeof p.nextAction !== 'object') return false;
  const na = p.nextAction as Record<string, unknown>;
  if (typeof na.text !== 'string' || !na.text.trim()) return false;

  if (typeof p.minimumViableSession !== 'string') return false;

  if (!Array.isArray(p.phases) || p.phases.length !== 3) return false;

  if (!Array.isArray(p.relevantSections)) return false;
  if (!Array.isArray(p.honestLimitations)) return false;

  // Validate all sectionKeys reference known sections or are null
  const allTasks: PlanTask[] = (p.phases as PlanPhase[]).flatMap((ph) => ph.tasks ?? []);
  allTasks.push(p.nextAction as PlanTask);
  for (const task of allTasks) {
    if (task.sectionKey !== null && task.sectionKey !== undefined && !(task.sectionKey in SECTIONS)) {
      return false;
    }
  }

  return true;
}

function buildMessages(body: {
  archetype: GoalArchetype;
  mode: GoalMode;
  title: string;
  whyNow: string;
  commitment: string;
  successSignal: string;
  answers: { questionKey: string; questionText: string; answer: string }[];
}) {
  const systemPrompt = `You are generating an execution plan for a user's goal. You will be given the goal's primary archetype (Learn, Build, Execute, or Connect), their answers from goal creation, and a registry of site sections with their build status.

Your job:
1. Identify SUPPORTING archetypes — almost all real goals mix archetypes. A "play guitar" Execute goal usually has Learn (technique) and Connect (audience) as supporting. List 0-2 supporting archetypes that the user's answers actually imply. Don't add ones they didn't signal.
2. Generate a single NEXT ACTION — the one specific thing they should do this week. Concrete, under 15 words, with a section to open. Not abstract ("start building visibility"); concrete ("Post one practice clip on Self → Social and ask for one piece of feedback").
3. Define MINIMUM VIABLE SESSION — what counts as showing up on a bad day. One sentence. This is what protects consistency.
4. Generate exactly 3 PHASES — Foundation, Growth, and a third named for the goal (e.g. "First Performance", "First Users", "First Donation"). Each phase has 3-5 concrete tasks and a graduation criterion stated as "When you can X, you're ready for the next phase."
5. Tag each task with a sectionKey from the provided registry. If a task has no on-platform home, sectionKey is null.
6. List relevantSections — only sections the plan actually uses, deduplicated.

ROUTING RULES (critical):
- LIVE sections: route normally. The user can do real work there.
- SCAFFOLDED sections: route, but mention what's actually available. "Set up your skill profile (tutor matching coming later — for now, add your own resources)."
- PLANNED sections: DO NOT link as if they're live. Instead, use the section's \`interim\` field to suggest a real action they can take now. Add a string to honestLimitations explaining what's coming and when.

TONE:
- Direct, warm, instructional. Not motivational-poster.
- Use the user's own language from their answers where possible.
- No platitudes ("start building visibility", "begin fundraising"). Always concrete.
- Acknowledge the platform's gaps honestly — don't paper over planned sections.

Return strict JSON matching this shape:

{
  "supportingArchetypes": ["LEARN" | "BUILD" | "EXECUTE" | "CONNECT"],
  "nextAction": { "text": "...", "sectionKey": "self.social" | null, "frequency": "once" },
  "minimumViableSession": "...",
  "phases": [
    {
      "title": "Foundation",
      "durationWeeks": 4,
      "tasks": [
        { "text": "...", "sectionKey": "self.time", "frequency": "daily", "archetype": "EXECUTE" },
        ...
      ],
      "graduationCriteria": "..."
    },
    { ... },
    { ... }
  ],
  "relevantSections": ["self.time", "self.social", "self.learning"],
  "honestLimitations": ["Tutor matching is coming in Q3 — for now, free YouTube creators are listed as resources"]
}`;

  const sectionsSummary = Object.values(SECTIONS).map((s) => ({
    key: s.key,
    label: s.label,
    status: s.status,
    route: s.route,
    liveFeatures: s.liveFeatures,
    plannedFeatures: s.plannedFeatures,
    interim: s.interim,
    eta: s.eta,
  }));

  const answersFormatted = body.answers
    .map((a) => `Q: ${a.questionText}\nA: ${a.answer}`)
    .join('\n\n');

  const userMessage = `Build an execution plan for this goal:

Title: ${body.title}
Why now: ${body.whyNow}
Commitment: ${body.commitment}
Success signal: ${body.successSignal}
Primary archetype: ${body.archetype}
Mode: ${body.mode}

Goal creation answers:
${answersFormatted}

Available site sections (with build status):
${JSON.stringify(sectionsSummary, null, 2)}`;

  return [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userMessage },
  ];
}

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.goalId) return NextResponse.json({ error: 'goalId is required' }, { status: 400 });

  const { goalId, archetype, mode, answers, title, whyNow, commitment, successSignal } = body;

  // Confirm the goal belongs to this user
  const goal = await prisma.aiGoal.findUnique({ where: { id: goalId } });
  if (!goal || goal.userId !== user.id) {
    return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
  }

  let plan: ExecutionPlan = FALLBACK_PLAN;
  let usedFallback = false;

  try {
    const content = await chatComplete({
      model: process.env.GOAL_AI_PLAN_MODEL ?? 'openai/gpt-4o-mini',
      messages: buildMessages({ archetype, mode, title, whyNow, commitment, successSignal, answers: answers ?? [] }),
      maxTokens: 1200,
      temperature: 0.5,
      jsonMode: true,
    });

    let raw: unknown;
    try {
      raw = JSON.parse(content.trim());
    } catch (parseErr) {
      console.error('[goal-ai/execution-plan] JSON parse failed', parseErr, '\nRaw:', content);
      usedFallback = true;
    }

    if (!usedFallback) {
      if (validatePlan(raw)) {
        plan = raw as ExecutionPlan;
      } else {
        console.error('[goal-ai/execution-plan] Validation failed. Raw response:', JSON.stringify(raw));
        usedFallback = true;
      }
    }
  } catch (aiErr) {
    console.error('[goal-ai/execution-plan] AI call failed', aiErr);
    usedFallback = true;
  }

  if (usedFallback) plan = FALLBACK_PLAN;

  await prisma.aiGoal.update({
    where: { id: goalId },
    data: {
      executionPlan: plan as object,
      supportingArchetypes: plan.supportingArchetypes as GoalArchetype[],
      currentPhaseIndex: 0,
    },
  });

  return NextResponse.json({ plan, fallback: usedFallback });
}
