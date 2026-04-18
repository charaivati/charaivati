import type { GoalArchetype } from '@prisma/client';

export type PlanTask = {
  text: string;
  sectionKey: string | null;
  frequency?: 'daily' | 'weekly' | 'once' | string;
  archetype?: GoalArchetype;
};

export type PlanPhase = {
  title: string;
  durationWeeks: number;
  tasks: PlanTask[];
  graduationCriteria: string;
};

export type ExecutionPlan = {
  supportingArchetypes: GoalArchetype[];
  nextAction: PlanTask;
  minimumViableSession: string;
  phases: PlanPhase[];
  relevantSections: string[];
  honestLimitations: string[];
};
