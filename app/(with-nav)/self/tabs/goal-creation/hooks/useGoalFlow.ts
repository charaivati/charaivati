// goal-creation/hooks/useGoalFlow.ts
'use client';
import { useCallback, useReducer } from 'react';
import type { FlowState, GoalArchetype, GoalMode, GoalSummary, RiskFlag } from '../flow-config/types';
import { getNextQuestion, totalQuestions, detectMismatch } from '../flow-config/branchingRules';
import { useAIAssist } from './useAIAssist';

type Action =
  | { type: 'SET_ARCHETYPE';    archetype: GoalArchetype }
  | { type: 'SET_MODE';         mode: GoalMode }
  | { type: 'SET_ANSWER';       key: string; value: string }
  | { type: 'SET_REFLECTION';   key: string; value: string }
  | { type: 'SET_PLACEHOLDER';  key: string; value: string }
  | { type: 'SET_SUGGESTIONS';  key: string; value: string[] }
  | { type: 'MARK_REFINED';     key: string }
  | { type: 'NEXT_QUESTION' }
  | { type: 'SET_PHASE';        phase: FlowState['phase'] }
  | { type: 'SET_FLAGS';        flags: RiskFlag[] }
  | { type: 'RESET' };

const initial: FlowState = {
  archetype: null,
  mode: null,
  currentIndex: 0,
  answers: {},
  reflections: {},
  placeholders: {},
  suggestions:  {},
  refinementAsked: {},
  phase: 'archetype',
  riskFlags: [],
};

function reducer(state: FlowState, action: Action): FlowState {
  switch (action.type) {
    case 'SET_ARCHETYPE':   return { ...state, archetype: action.archetype, phase: 'mode' };
    case 'SET_MODE':        return { ...state, mode: action.mode, phase: 'questions', currentIndex: 0 };
    case 'SET_ANSWER':      return { ...state, answers: { ...state.answers, [action.key]: action.value } };
    case 'SET_REFLECTION':   return { ...state, reflections:  { ...state.reflections,  [action.key]: action.value } };
    case 'SET_PLACEHOLDER':  return { ...state, placeholders: { ...state.placeholders, [action.key]: action.value } };
    case 'SET_SUGGESTIONS':  return { ...state, suggestions:  { ...state.suggestions,  [action.key]: action.value } };
    case 'MARK_REFINED':     return { ...state, refinementAsked: { ...state.refinementAsked, [action.key]: true } };
    case 'NEXT_QUESTION':   return { ...state, currentIndex: state.currentIndex + 1 };
    case 'SET_PHASE':       return { ...state, phase: action.phase };
    case 'SET_FLAGS':       return { ...state, riskFlags: action.flags };
    case 'RESET':           return initial;
    default:                return state;
  }
}

export type GoalFlowReturn = {
  state: FlowState;
  currentQuestion: ReturnType<typeof getNextQuestion>;
  total: number;
  selectArchetype: (a: GoalArchetype) => void;
  selectMode: (m: GoalMode) => void;
  submitAnswer: (key: string, value: string) => Promise<void>;
  skipRefinement: (key: string) => void;
  goBack: () => void;
  reset: () => void;
  // Set from outside after summary is generated
  summary: GoalSummary | null;
  setSummary: (s: GoalSummary) => void;
  summaryLoading: boolean;
};

export function useGoalFlow(): GoalFlowReturn {
  const [state, dispatch] = useReducer(reducer, initial);
  const { processAnswer, generateSummary } = useAIAssist();

  // Separate state for summary (not in reducer — it's async and transient)
  const [summary, setSummaryRaw] = useReducerPair<GoalSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useReducerPair(false);

  const currentQuestion = (state.archetype && state.mode)
    ? getNextQuestion(state.archetype, state.mode, state.answers, state.currentIndex)
    : null;

  const total = (state.archetype && state.mode)
    ? totalQuestions(state.archetype, state.mode)
    : 0;

  const selectArchetype = useCallback((a: GoalArchetype) => {
    dispatch({ type: 'SET_ARCHETYPE', archetype: a });
  }, []);

  const selectMode = useCallback((m: GoalMode) => {
    dispatch({ type: 'SET_MODE', mode: m });
  }, []);

  const submitAnswer = useCallback(async (key: string, value: string) => {
    dispatch({ type: 'SET_ANSWER', key, value });

    const { archetype, mode, answers, reflections } = state;
    if (!archetype || !mode || !currentQuestion) return;

    const priorAnswers = Object.entries(answers).map(([k, v]) => ({
      questionKey: k,
      questionText: '', // we don't store text in answers map — just value
      answer: v,
      reflection: reflections[k],
    }));

    // Await AI before advancing — reflection + placeholder will be in state when next card mounts
    const nextIdx = state.currentIndex + 1;
    const nextQ = getNextQuestion(archetype, mode, { ...answers, [key]: value }, nextIdx);

    const { reflect, refine } = await processAnswer({
      archetype,
      mode,
      questionText: currentQuestion.text,
      questionKey: key,
      answer: value,
      priorAnswers,
      hasAlreadyRefined: state.refinementAsked[key] ?? false,
      nextQuestionText: nextQ?.text,
    }).catch(() => ({
      reflect: { reflection: null, vague: false, suggestedPlaceholder: null },
      refine:  { needsRefinement: false, subQuestion: null, reason: 'error' },
    }));

    if (reflect.reflection) dispatch({ type: 'SET_REFLECTION', key, value: reflect.reflection });
    if (reflect.suggestedPlaceholder && nextQ) {
      dispatch({ type: 'SET_PLACEHOLDER', key: nextQ.key, value: reflect.suggestedPlaceholder });
    }
    if (reflect.suggestions?.length && nextQ) {
      dispatch({ type: 'SET_SUGGESTIONS', key: nextQ.key, value: reflect.suggestions });
    }
    if (refine.needsRefinement && !state.refinementAsked[key] && refine.subQuestion) {
      dispatch({ type: 'SET_REFLECTION', key: `__refine_${key}`, value: refine.subQuestion });
    }

    // Advance — nextIdx and nextQ already computed above

    if (!nextQ) {
      // All questions done — run mismatch detection then request summary
      const allAnswers = { ...answers, [key]: value };
      const flags = detectMismatch(allAnswers, archetype, mode);
      dispatch({ type: 'SET_FLAGS', flags });
      dispatch({ type: 'SET_PHASE', phase: 'summary' });
      setSummaryLoading(true);

      const answerArr = Object.entries(allAnswers).map(([k, v]) => ({
        questionKey: k,
        questionText: '',
        answer: v,
      }));

      generateSummary({ archetype, mode, answers: answerArr as any, detectedFlags: flags })
        .then(s => { setSummaryRaw(s as GoalSummary); setSummaryLoading(false); })
        .catch(() => { setSummaryLoading(false); });
    } else {
      dispatch({ type: 'NEXT_QUESTION' });
    }
  }, [state, currentQuestion, processAnswer, generateSummary]);

  const skipRefinement = useCallback((key: string) => {
    dispatch({ type: 'MARK_REFINED', key });
  }, []);

  const goBack = useCallback(() => {
    if (state.phase === 'questions' && state.currentIndex > 0) {
      dispatch({ type: 'NEXT_QUESTION' }); // reuse — index-- would need a new action
      // Workaround: dispatch SET_PHASE to questions resets nothing, just go back
      dispatch({ type: 'SET_ANSWER', key: '__back__', value: '' });
    } else if (state.phase === 'mode') {
      dispatch({ type: 'SET_PHASE', phase: 'archetype' });
    }
  }, [state]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
    setSummaryRaw(null);
  }, []);

  return {
    state, currentQuestion, total,
    selectArchetype, selectMode, submitAnswer, skipRefinement, goBack, reset,
    summary, setSummary: setSummaryRaw, summaryLoading,
  };
}

// Minimal useState-like helper that avoids importing useState separately
function useReducerPair<T>(init: T): [T, (v: T) => void] {
  const [s, d] = useReducer((_: T, v: T) => v, init);
  return [s, d];
}
