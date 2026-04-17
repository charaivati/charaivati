'use client';
// goal-creation/QuestionCard.tsx — renders current question + input

import { useRef, useState } from 'react';
import type { Question } from './flow-config/types';
import { AIReflection } from './AIReflection';
import { RefinementPrompt } from './RefinementPrompt';

type Props = {
  question: Question;
  index: number;
  total: number;
  priorReflection?: string;        // reflection of the *previous* answer
  pendingSubQuestion?: string;     // AI-requested refinement for this question
  contextualPlaceholder?: string;  // AI-generated placeholder from prior answers
  suggestions?: string[];           // AI-generated chips for this question
  onSubmit: (value: string) => Promise<void>;
  onSkipRefinement: () => void;
};

export function QuestionCard({
  question, index, total,
  priorReflection, pendingSubQuestion, contextualPlaceholder, suggestions,
  onSubmit, onSkipRefinement,
}: Props) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  async function handleSubmit() {
    if (!value.trim() || busy) return;
    setBusy(true);
    setSubmitted(true);
    await onSubmit(value.trim());
    setBusy(false);
  }

  const progress = ((index) / total) * 100;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1 rounded-full bg-gray-800">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[11px] text-gray-500 tabular-nums flex-shrink-0">
          {index + 1} of {total}
        </span>
      </div>

      {/* Prior reflection */}
      {priorReflection && <AIReflection text={priorReflection} />}

      {/* Question */}
      <div>
        <p className="text-base font-medium text-white leading-snug">{question.text}</p>
      </div>

      {/* Refinement sub-question (shown after AI flags vagueness) */}
      {pendingSubQuestion && !submitted ? (
        <RefinementPrompt
          subQuestion={pendingSubQuestion}
          onSubmit={async (refined) => { setValue(refined); await handleSubmit(); }}
          onSkip={onSkipRefinement}
        />
      ) : (
        <>
          {/* Input */}
          {question.type === 'select' && question.options ? (
            <div className="flex flex-wrap gap-2">
              {question.options.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setValue(opt)}
                  className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                    value === opt
                      ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300 font-medium'
                      : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : question.type === 'textarea' ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              autoFocus
              rows={3}
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={contextualPlaceholder ?? question.placeholder}
              className="w-full bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-indigo-500/60"
              onKeyDown={e => {
                if (e.key === 'Enter' && e.metaKey && value.trim()) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              autoFocus
              type="text"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={contextualPlaceholder ?? question.placeholder}
              className="w-full bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60"
              onKeyDown={e => { if (e.key === 'Enter' && value.trim()) handleSubmit(); }}
            />
          )}

          {/* AI suggestion chips */}
          {suggestions && suggestions.length > 0 && !value.trim() && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setValue(s)}
                  className="px-3 py-1 rounded-full text-xs border border-indigo-500/30 bg-indigo-500/8 text-indigo-300/80 hover:text-indigo-200 hover:border-indigo-500/60 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Next button */}
          <button
            type="button"
            disabled={!value.trim() || busy}
            onClick={handleSubmit}
            className="mt-3 px-5 py-2 rounded-lg bg-white text-gray-950 text-sm font-semibold disabled:opacity-35 hover:bg-gray-100 transition-colors"
          >
            {busy ? '✦ Thinking…' : index + 1 === total ? 'Finish →' : 'Next →'}
          </button>
        </>
      )}
    </div>
  );
}
