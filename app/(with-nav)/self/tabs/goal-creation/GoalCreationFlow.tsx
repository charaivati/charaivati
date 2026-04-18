'use client';
// goal-creation/GoalCreationFlow.tsx — top-level orchestrator
// Usage: <GoalCreationFlow onSaved={(summary) => ...} onCancel={() => ...} />

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGoalFlow } from './hooks/useGoalFlow';
import { ArchetypeSelector } from './ArchetypeSelector';
import { QuestionCard } from './QuestionCard';
import { GoalSummaryCard } from './GoalSummaryCard';
import type { GoalSummary, GoalMode, GoalArchetype } from './flow-config/types';

type Props = {
  initialArchetype?: GoalArchetype;  // pre-select archetype, skip that screen
  onSaved?: (summary: GoalSummary) => void;
  onCancel?: () => void;
};

const MODE_LABELS: Record<GoalMode, { label: string; desc: string }> = {
  FOCUSED:    { label: 'Focused',    desc: '4 questions · next step only' },
  ZOOMED_OUT: { label: 'Zoomed out', desc: '6–7 questions · long-term vision' },
};

const PLAN_TIMEOUT_MS = 8_000;

export function GoalCreationFlow({ initialArchetype, onSaved, onCancel }: Props) {
  const router = useRouter();
  const [planState, setPlanState] = useState<'idle' | 'planning' | 'timeout'>('idle');
  const flow = useGoalFlow(initialArchetype);
  const { state, currentQuestion, total } = flow;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/80 px-5 py-5 space-y-5"
      style={{ boxShadow: '0 0 24px rgba(99,102,241,0.08), inset 0 1px 0 rgba(255,255,255,0.06)' }}>

      {/* Cancel */}
      {onCancel && state.phase !== 'saved' && (
        <div className="flex justify-end">
          <button type="button" onClick={onCancel}
            className="text-xs text-gray-600 hover:text-gray-300 transition-colors">
            ✕ Cancel
          </button>
        </div>
      )}

      {/* ── Phase: archetype ── */}
      {state.phase === 'archetype' && !initialArchetype && (
        <ArchetypeSelector onSelect={flow.selectArchetype} />
      )}

      {/* ── Phase: mode ── */}
      {state.phase === 'mode' && (
        <div className="space-y-4">
          <div>
            <button type="button" onClick={flow.goBack}
              className="text-xs text-gray-600 hover:text-gray-300 transition-colors mb-3 block">
              ← Back
            </button>
            <p className="text-xs text-gray-500 mb-1">How do you want to approach this?</p>
            <p className="text-lg font-semibold text-white">Choose a mode</p>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {(Object.keys(MODE_LABELS) as GoalMode[]).map(m => {
              const cfg = MODE_LABELS[m];
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => flow.selectMode(m)}
                  className="flex flex-col items-start p-4 rounded-xl border border-gray-800 bg-gray-950/50
                    hover:border-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all text-left"
                >
                  <span className="text-sm font-semibold text-white mb-1">{cfg.label}</span>
                  <span className="text-xs text-gray-500 leading-snug">{cfg.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Phase: questions ── */}
      {state.phase === 'questions' && currentQuestion && (
        <QuestionCard
          key={currentQuestion.key}
          question={currentQuestion}
          index={state.currentIndex}
          total={total}
          contextualPlaceholder={state.placeholders[currentQuestion.key]}
          suggestions={state.suggestions[currentQuestion.key] ?? []}
          priorReflection={
            state.currentIndex > 0
              ? state.reflections[
                  Object.keys(state.answers)[state.currentIndex - 1] ?? ''
                ]
              : undefined
          }
          pendingSubQuestion={
            state.reflections[`__refine_${currentQuestion.key}`] &&
            !state.refinementAsked[currentQuestion.key]
              ? state.reflections[`__refine_${currentQuestion.key}`]
              : undefined
          }
          onSubmit={(value) => flow.submitAnswer(currentQuestion.key, value)}
          onSkipRefinement={() => flow.skipRefinement(currentQuestion.key)}
        />
      )}

      {/* ── Phase: summary (loading) ── */}
      {state.phase === 'summary' && flow.summaryLoading && (
        <div className="space-y-3 py-4">
          <div className="w-6 h-6 rounded-full border-2 border-indigo-500/40 border-t-indigo-500 animate-spin mx-auto" />
          <p className="text-sm text-gray-500 text-center">Building your goal card…</p>
        </div>
      )}

      {/* ── Phase: planning (building execution plan) ── */}
      {planState !== 'idle' && (
        <div className="space-y-3 py-4">
          <div className="w-6 h-6 rounded-full border-2 border-indigo-500/40 border-t-indigo-500 animate-spin mx-auto" />
          {planState === 'timeout' ? (
            <p className="text-sm text-gray-500 text-center">
              Plan still generating — taking you to your Time section now…
            </p>
          ) : (
            <p className="text-sm text-gray-500 text-center">Building your plan…</p>
          )}
        </div>
      )}

      {/* ── Phase: summary (ready) ── */}
      {state.phase === 'summary' && !flow.summaryLoading && flow.summary && planState === 'idle' && (
        <GoalSummaryCard
          summary={flow.summary}
          onSave={async (final) => {
            flow.setSummary(final);
            const answerArr = Object.entries(state.answers).map(([key, value]) => ({
              questionKey:  key,
              questionText: '',
              answer:       value,
              reflection:   state.reflections[key] ?? null,
            }));

            let goalId: string | null = null;
            try {
              const res = await fetch('/api/self/goals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  archetype:     state.archetype,
                  mode:          state.mode,
                  title:         final.title,
                  whyNow:        final.whyNow,
                  commitment:    final.commitment,
                  successSignal: final.successSignal,
                  riskFlags:     final.riskFlags,
                  answers:       answerArr,
                }),
              });
              const data = await res.json();
              goalId = data.goal?.id ?? null;
            } catch (e) {
              console.error('[GoalCreationFlow] save failed', e);
            }

            if (!goalId) {
              // Save failed — fall back to parent handler
              onSaved?.(final);
              return;
            }

            // Show "Building your plan…" BEFORE closing the modal so the user
            // sees feedback while the AI call is in flight.
            setPlanState('planning');

            const timeoutId = setTimeout(() => setPlanState('timeout'), PLAN_TIMEOUT_MS);

            void fetch('/api/goal-ai/execution-plan', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                goalId,
                archetype:     state.archetype,
                mode:          state.mode,
                title:         final.title,
                whyNow:        final.whyNow,
                commitment:    final.commitment,
                successSignal: final.successSignal,
                answers:       answerArr,
              }),
            })
              .catch(e => console.error('[GoalCreationFlow] plan generation failed', e))
              .finally(() => {
                clearTimeout(timeoutId);
                // Close modal + update legacy goals list, then navigate.
                // onSaved fires here so the Skills-redirect in SelfCanvas happens
                // after router.push has already committed to the time tab.
                onSaved?.(final);
                router.push(`/self?tab=time&goalId=${goalId}`);
              });
          }}
          onReset={flow.reset}
        />
      )}

      {/* ── Phase: saved ── */}
      {state.phase === 'saved' && (
        <div className="py-6 text-center space-y-2">
          <p className="text-lg font-semibold text-white">Goal saved.</p>
          <p className="text-sm text-gray-500">It's in your self canvas now.</p>
          <button type="button" onClick={flow.reset}
            className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            Add another goal
          </button>
        </div>
      )}
    </div>
  );
}
