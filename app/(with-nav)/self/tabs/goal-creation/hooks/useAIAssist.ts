// goal-creation/hooks/useAIAssist.ts
// Calls /api/goal-ai/* endpoints in parallel and surfaces results to the flow.
// Never blocks the user — all AI is best-effort with a 1.5s timeout.

import { useCallback } from 'react';
import type { AnswerRecord, RiskFlag } from '../flow-config/types';

const AI_TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), AI_TIMEOUT_MS)),
  ]);
}

export type ReflectResult = { reflection: string | null; vague: boolean; suggestedPlaceholder: string | null; suggestions: string[] };
export type RefineResult  = { needsRefinement: boolean; subQuestion: string | null; reason: string };

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

export function useAIAssist() {
  // Run reflect + refine in parallel for a given answer; returns both results.
  const processAnswer = useCallback(async ({
    archetype,
    mode,
    questionText,
    questionKey,
    answer,
    priorAnswers,
    hasAlreadyRefined,
    nextQuestionText,
  }: {
    archetype: string;
    mode: string;
    questionText: string;
    questionKey: string;
    answer: string;
    priorAnswers: AnswerRecord[];
    hasAlreadyRefined: boolean;
    nextQuestionText?: string;
  }): Promise<{ reflect: ReflectResult; refine: RefineResult }> => {
    const fallbackReflect: ReflectResult = { reflection: null, vague: false, suggestedPlaceholder: null, suggestions: [] };
    const fallbackRefine:  RefineResult  = { needsRefinement: false, subQuestion: null, reason: 'timeout' };

    const [reflect, refine] = await Promise.all([
      withTimeout(
        postJSON<ReflectResult>('/api/goal-ai/reflect', {
          archetype, mode, questionText, answer,
          priorAnswers: priorAnswers.map(a => ({ questionText: a.questionText, answer: a.answer })),
          nextQuestionText,
        }),
        fallbackReflect,
      ),
      withTimeout(
        postJSON<RefineResult>('/api/goal-ai/refine', {
          archetype, mode, questionText, answer, hasAlreadyRefined,
        }),
        fallbackRefine,
      ),
    ]);

    return { reflect, refine };
  }, []);

  const generateSummary = useCallback(async ({
    archetype,
    mode,
    answers,
    detectedFlags,
  }: {
    archetype: string;
    mode: string;
    answers: AnswerRecord[];
    detectedFlags: RiskFlag[];
  }) => {
    return postJSON('/api/goal-ai/summary', {
      archetype, mode,
      answers: answers.map(a => ({ questionKey: a.questionKey, questionText: a.questionText, answer: a.answer })),
      detectedFlags,
    });
  }, []);

  return { processAnswer, generateSummary };
}
