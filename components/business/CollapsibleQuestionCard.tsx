"use client";

import { useState, useEffect } from "react";

interface Option {
  value: string;
  label: string;
  score?: number;
}

interface Question {
  id: string;
  order: number;
  text: string;
  type: string;
  helpText?: string;
  examples?: string;
  options?: Option[];
  randomizeOptions?: boolean;
}

interface CollapsibleQuestionCardProps {
  question: Question;
  answer: string;
  onAnswerChange: (answer: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isAnswered: boolean;
  onNext?: () => void;
}

export default function CollapsibleQuestionCard({
  question,
  answer,
  onAnswerChange,
  isExpanded,
  onToggleExpand,
  isAnswered,
  onNext,
}: CollapsibleQuestionCardProps) {
  const [shuffledOptions, setShuffledOptions] = useState<Option[]>([]);

  useEffect(() => {
    if (question.type === "select" && question.options) {
      if (question.randomizeOptions) {
        const shuffled = [...question.options].sort(() => Math.random() - 0.5);
        setShuffledOptions(shuffled);
      } else {
        setShuffledOptions(question.options);
      }
    } else {
      setShuffledOptions([]);
    }
  }, [question.id, question.options, question.randomizeOptions]);

  const getPreviewText = () => {
    if (!answer) return "Not answered";

    if (question.type === "select") {
      const option =
        question.options?.find((opt) => opt.value === answer) ||
        shuffledOptions.find((opt) => opt.value === answer);
      return option?.label || answer;
    }

    return answer.length > 50 ? answer.substring(0, 50) + "..." : answer;
  };

  const handleOptionClick = (value: string) => {
    onAnswerChange(value);
    // optional auto-advance: uncomment to enable
    // if (onNext) setTimeout(() => onNext(), 200);
  };

  return (
    <div
      className={`bg-slate-800/50 backdrop-blur border transition-all ${
        isExpanded
          ? "border-purple-500/50 shadow-lg"
          : isAnswered
          ? "border-slate-700 hover:border-slate-600 cursor-pointer"
          : "border-blue-500/50 hover:border-blue-500"
      } rounded-xl overflow-hidden`}
    >
      {/* Header - always visible */}
      <div className="w-full p-4 flex items-start justify-between gap-3 text-left">
        <button
          onClick={onToggleExpand}
          className="flex-1 min-w-0 text-left"
          aria-expanded={isExpanded}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-purple-400 flex-shrink-0">
              Q{question.order}
            </span>
            <h3 className="text-white font-medium truncate">{question.text}</h3>
          </div>
          {isAnswered && (
            <p className="text-sm mt-1 truncate text-slate-400">
              {getPreviewText()}
            </p>
          )}
          {!isAnswered && !isExpanded && (
            <p className="text-sm mt-1 truncate text-blue-400">
              ⭐ Click to answer this question
            </p>
          )}
        </button>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isAnswered && <span className="text-green-400 text-sm">✓</span>}
          {!isAnswered && !isExpanded && <span className="text-blue-400 text-sm">►</span>}
          {isExpanded && <span className="text-purple-400 text-sm">▼</span>}

          {!isExpanded && isAnswered && onNext && (
            <button
              onClick={onNext}
              aria-label="Next question"
              className="ml-2 px-3 py-1 rounded-md bg-purple-600/10 border border-purple-600 text-sm text-purple-300 hover:bg-purple-600/20"
            >
              Next →
            </button>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-slate-700 p-4 space-y-4 bg-slate-800/30">
          {question.helpText && (
            <p className="text-slate-400 text-sm">{question.helpText}</p>
          )}

          {question.examples && (
            <p className="text-slate-500 text-xs italic">💡 Example: {question.examples}</p>
          )}

          {question.type === "text" && (
            <textarea
              value={answer}
              onChange={(e) => onAnswerChange(e.target.value)}
              placeholder="Type your answer here..."
              rows={3}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none resize-none"
            />
          )}

          {question.type === "select" && shuffledOptions.length > 0 && (
            <div className="grid grid-cols-1 gap-2">
              {shuffledOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleOptionClick(option.value)}
                  className={`p-3 rounded-lg border-2 font-medium transition text-left ${
                    answer === option.value
                      ? "bg-purple-500/20 border-purple-500 text-purple-300"
                      : "bg-slate-700/50 border-slate-600 text-slate-300 hover:border-purple-400"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3">
            {onNext && (
              <button
                onClick={onNext}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 transition"
              >
                Next
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
