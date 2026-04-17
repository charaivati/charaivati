// goal-creation/flow-config/branchingRules.ts
import type { GoalArchetype, GoalMode, Question, RiskFlag } from './types';
import { FOCUSED_QUESTIONS } from './focused';
import { ZOOMED_OUT_QUESTIONS } from './zoomedOut';

export function getNextQuestion(
  archetype: GoalArchetype,
  mode: GoalMode,
  answers: Record<string, string>,
  currentIndex: number,
): Question | null {
  const base = mode === 'FOCUSED' ? FOCUSED_QUESTIONS[archetype] : ZOOMED_OUT_QUESTIONS[archetype];

  // Focused Execute: Q5 branches on hobby vs stability answer
  if (archetype === 'EXECUTE' && mode === 'FOCUSED' && currentIndex === 4) {
    const hobby = answers['exec_f_q1'];
    if (hobby === 'Hobby') {
      return { key: 'exec_f_q5_hobby', text: 'What does enjoying this look like for you?', type: 'text' };
    }
    return { key: 'exec_f_q5_stable', text: "What does 'done well' look like for you?", type: 'text' };
  }

  // Focused Connect: Q5 branches on cause/person/group
  if (archetype === 'CONNECT' && mode === 'FOCUSED' && currentIndex === 4) {
    const kind = answers['conn_f_q1'];
    if (kind === 'Person') {
      return { key: 'conn_f_q5_person', text: 'What does their life looking better look like?', type: 'text' };
    }
    return { key: 'conn_f_q5_cause', text: 'What would meaningful progress look like?', type: 'text' };
  }

  return base[currentIndex] ?? null;
}

export function totalQuestions(archetype: GoalArchetype, mode: GoalMode): number {
  const base = mode === 'FOCUSED' ? FOCUSED_QUESTIONS[archetype] : ZOOMED_OUT_QUESTIONS[archetype];
  // Branching archetypes always add exactly one extra question
  const hasBranch = mode === 'FOCUSED' && (archetype === 'EXECUTE' || archetype === 'CONNECT');
  return base.length + (hasBranch ? 1 : 0);
}

export function detectMismatch(
  answers: Record<string, string>,
  archetype: GoalArchetype,
  mode: GoalMode,
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  if (archetype === 'LEARN' && mode === 'FOCUSED') {
    const raw = answers['learn_f_q3'] ?? '';
    const hoursMatch = raw.match(/(\d+)\s*h/i);
    const hours = hoursMatch ? parseInt(hoursMatch[1]) : null;
    const scope = (answers['learn_f_q1'] ?? '').toLowerCase();
    const broad = ['ai', 'machine learning', 'finance', 'medicine', 'physics', 'law', 'programming'];
    if (hours !== null && hours < 3 && broad.some(k => scope.includes(k))) {
      flags.push({
        type: 'scope_vs_time',
        severity: 'warn',
        message: 'The topic is broad but your weekly time is under 3 hours — consider narrowing scope.',
      });
    }
  }

  if (archetype === 'BUILD' && mode === 'ZOOMED_OUT') {
    const audience = answers['build_z_q1'] ?? '';
    if (audience.length < 20) {
      flags.push({
        type: 'no_named_audience',
        severity: 'info',
        message: 'Build goals work better when you name a specific first user or audience.',
      });
    }
  }

  if (archetype === 'CONNECT' && mode === 'FOCUSED') {
    const action = answers['conn_f_q3'] ?? '';
    if (!action.trim()) {
      flags.push({
        type: 'no_named_action',
        severity: 'warn',
        message: 'Connect goals need a concrete action, not just sentiment.',
      });
    }
  }

  return flags;
}
