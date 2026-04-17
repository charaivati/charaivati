// goal-creation/flow-config/types.ts

export type GoalArchetype = 'LEARN' | 'BUILD' | 'EXECUTE' | 'CONNECT';
export type GoalMode = 'FOCUSED' | 'ZOOMED_OUT';
export type QuestionType = 'text' | 'textarea' | 'select';

export type Question = {
  key: string;
  text: string;
  type: QuestionType;
  placeholder?: string;
  options?: string[];
};

export type RiskFlag = {
  type: string;
  severity: 'info' | 'warn';
  message: string;
};

export type AnswerRecord = {
  questionKey: string;
  questionText: string;
  answer: string;
  reflection?: string;
};

export type GoalSummary = {
  title: string;
  whyNow: string;
  commitment: string;
  successSignal: string;
  riskFlags: RiskFlag[];
};

export type FlowPhase = 'archetype' | 'mode' | 'questions' | 'summary' | 'saved';

export type FlowState = {
  archetype: GoalArchetype | null;
  mode: GoalMode | null;
  currentIndex: number;
  answers: Record<string, string>;
  reflections: Record<string, string>;
  placeholders: Record<string, string>;
  suggestions:  Record<string, string[]>;
  refinementAsked: Record<string, boolean>;
  phase: FlowPhase;
  riskFlags: RiskFlag[];
};
