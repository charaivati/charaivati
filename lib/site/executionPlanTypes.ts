import type { GoalArchetype } from '@prisma/client';

export type PlanTask = {
  text: string;
  sectionKey: string | null;
  frequency?: 'daily' | 'weekly' | 'once' | string;
  archetype?: GoalArchetype;
  // EXECPLAN-3 — stamped at generation time; absent on older plans.
  id?: string;              // stable task identity
  done?: boolean;           // persisted completion (source of truth for the UI)
  todoId?: string | null;   // mirrored Todo row, kept in sync on toggle
};

export type PlanPhase = {
  title: string;
  durationWeeks: number;
  tasks: PlanTask[];
  graduationCriteria: string;
};

// EXECPLAN-2: what the goal needs beyond tasks. Each group points into an
// existing surface (skills/funds/environment blocks, /business, /listen) —
// the plan holds requirements, the blocks keep owning the data.
export type PlanRequirements = {
  skills: { name: string; status: 'have' | 'learn' }[];
  funds: { estimate?: string; note: string; businessNeeded: boolean } | null;
  environment: string[];
  social: string[];
  support: 'none' | 'consider_listen';
  layer: 'self' | 'society' | 'nation' | 'earth';
};

export type ExecutionPlan = {
  supportingArchetypes: GoalArchetype[];
  nextAction: PlanTask;
  minimumViableSession: string;
  phases: PlanPhase[];
  relevantSections: string[];
  honestLimitations: string[];
  requirements?: PlanRequirements; // EXECPLAN-2 — absent on older plans
  _partial?: boolean; // true while tasks are still being filled in (step 2 pending)
};
