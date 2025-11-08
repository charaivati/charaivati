// components/business/QuestionCard.tsx
"use client";

import { useState, useEffect } from "react";

interface Option {
  value: string;
  label: string;
  score?: number;
}

interface Question {
  id: string;
  text: string;
  type: string;
  helpText?: string;
  examples?: string;
  options?: Option[];
  randomizeOptions?: boolean;
}

interface QuestionCardProps {
  question: Question;
  answer: string;
  onAnswerChange: (answer: string) => void;
}

export default function QuestionCard({
  question,
  answer,
  onAnswerChange,
}: QuestionCardProps) {
  const [shuffledOptions, setShuffledOptions] = useState<Option[]>([]);

  // Randomize options on mount or when question changes
  useEffect(() => {
    if (question.type === "select" && question.options) {
      if (question.randomizeOptions) {
        // Shuffle options
        const shuffled = [...question.options].sort(
          () => Math.random() - 0.5
        );
        setShuffledOptions(shuffled);
      } else {
        setShuffledOptions(question.options);
      }
    }
  }, [question.id, question.options, question.randomizeOptions]);

  return (
    <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-8">
      <h2 className="text-2xl font-bold text-white mb-2">{question.text}</h2>

      {question.helpText && (
        <p className="text-slate-400 text-sm mb-4">{question.helpText}</p>
      )}

      {question.examples && (
        <p className="text-slate-500 text-xs italic mb-6">
          💡 Example: {question.examples}
        </p>
      )}

      {question.type === "text" && (
        <textarea
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
          placeholder="Type your answer here..."
          rows={4}
          className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none resize-none"
        />
      )}

      {question.type === "select" && shuffledOptions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {shuffledOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onAnswerChange(option.value)}
              className={`p-4 rounded-lg border-2 font-medium transition text-left ${
                answer === option.value
                  ? "bg-purple-500/20 border-purple-500 text-purple-300"
                  : "bg-slate-700/50 border-slate-600 text-slate-300 hover:border-purple-400"
              }`}
            >
              {option.label}
              {/* Score is hidden from user - only stored in backend */}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}