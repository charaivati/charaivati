// lib/ai/goalReflect.ts — shared client-side helper for the goal reflect endpoint.
// Used by both the onboarding flow (DriveBlock) and the AI goal creation flow.

export type GoalReflectResult = {
  reflection:          string | null;
  vague:               boolean;
  suggestedPlaceholder: string | null;
  suggestions:         string[];
};

const FALLBACK: GoalReflectResult = {
  reflection: null, vague: false, suggestedPlaceholder: null, suggestions: [],
};

export async function fetchGoalReflect(params: {
  archetype:         string;
  mode:              string;
  questionText:      string;
  answer:            string;
  priorAnswers:      { questionText: string; answer: string }[];
  nextQuestionText?: string;
}): Promise<GoalReflectResult> {
  try {
    const res = await fetch('/api/goal-ai/reflect', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(params),
    });
    if (!res.ok) return FALLBACK;
    const data = await res.json();
    return {
      reflection:           data.reflection           ?? null,
      vague:                data.vague                ?? false,
      suggestedPlaceholder: data.suggestedPlaceholder ?? null,
      suggestions:          Array.isArray(data.suggestions) ? data.suggestions : [],
    };
  } catch {
    return FALLBACK;
  }
}
