'use client';
// goal-creation/RefinementPrompt.tsx — optional sub-question when answer is vague

import { useState } from 'react';

type Props = {
  subQuestion: string;
  onSubmit: (value: string) => void;
  onSkip: () => void;
};

export function RefinementPrompt({ subQuestion, onSubmit, onSkip }: Props) {
  const [value, setValue] = useState('');

  return (
    <div className="space-y-3 animate-[fadeIn_200ms_ease_both]">
      <p className="text-xs text-indigo-400 font-medium uppercase tracking-wide">One more thing</p>
      <p className="text-sm text-gray-200 leading-relaxed">{subQuestion}</p>
      <textarea
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        rows={2}
        className="w-full bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-indigo-500/60"
        placeholder="Add more detail…"
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey && value.trim()) {
            e.preventDefault();
            onSubmit(value.trim());
          }
        }}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!value.trim()}
          onClick={() => value.trim() && onSubmit(value.trim())}
          className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-indigo-500 transition-colors"
        >
          Add detail
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Skip, I've said enough
        </button>
      </div>
    </div>
  );
}
