// components/business/LiveScoreDashboard.tsx
"use client";

import { useMemo } from "react";

interface ScoreDimension {
  key: string;
  label: string;
  score: number | undefined;
}

interface LiveScoreDashboardProps {
  scores: Record<string, number>;
  overallScore: number;
  report: {
    verdict: string;
    nextSteps: string[];
    rating: number;
  } | null;
  answeredCount: number;
  totalQuestions: number;
}

const DIMENSION_LABELS: Record<string, string> = {
  problemClarity: "Problem Clarity",
  marketNeed: "Market Need",
  targetAudience: "Target Audience",
  uniqueValue: "Unique Value",
  feasibility: "Feasibility",
  monetization: "Monetization",
};

function getDimensionColor(score: number | undefined): string {
  if (score === undefined) return "bg-slate-700";
  if (score >= 1.5) return "bg-green-600";
  if (score >= 0.5) return "bg-blue-600";
  if (score >= -0.5) return "bg-yellow-600";
  return "bg-red-600";
}

function getScoreLabel(score: number | undefined): string {
  if (score === undefined) return "—";
  return score.toFixed(1);
}

export default function LiveScoreDashboard({
  scores,
  overallScore,
  report,
  answeredCount,
  totalQuestions,
}: LiveScoreDashboardProps) {
  const dimensions: ScoreDimension[] = useMemo(() => {
    return Object.entries(DIMENSION_LABELS).map(([key, label]) => ({
      key,
      label,
      score: scores[key],
    }));
  }, [scores]);

  const completionPercentage = Math.round(
    (answeredCount / Math.max(1, totalQuestions)) * 100
  );

  const overallPercentage = Math.round(
    ((overallScore + 2) / 4) * 100 // Normalize -2 to 2 scale to 0-100
  );

  return (
    <div className="sticky top-20 bg-slate-800/80 backdrop-blur border border-slate-700 rounded-lg p-6 shadow-lg max-h-[calc(100vh-100px)] overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-white mb-1">Live Evaluation</h2>
        <p className="text-slate-400 text-xs">
          Updates as you answer questions
        </p>
      </div>

      {/* Overall Score */}
      <div className="mb-6 p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-300 font-medium">Overall Score</span>
          <span className="text-2xl font-bold text-white">
            {overallPercentage}%
          </span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.max(0, overallPercentage)}%` }}
          />
        </div>
        <p className="text-slate-400 text-xs mt-2">
          {answeredCount} of {totalQuestions} questions answered
        </p>
      </div>

      {/* Dimension Scores */}
      <div className="mb-6 space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">Dimensions</h3>
        {dimensions.map(({ key, label, score }) => (
          <div key={key} className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-slate-300">{label}</span>
                <span
                  className={`text-sm font-bold rounded px-2 py-1 ${getDimensionColor(score)} text-white`}
                >
                  {getScoreLabel(score)}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${getDimensionColor(score)}`}
                  style={{
                    width:
                      score !== undefined
                        ? `${Math.max(0, ((score + 2) / 4) * 100)}%`
                        : "0%",
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Verdict */}
      {report && (
        <div className="p-4 bg-slate-700/50 border border-slate-600 rounded-lg">
          <div className="mb-3">
            <p className="text-base font-semibold text-white">
              {report.verdict}
            </p>
            <div className="flex gap-1 mt-1">
              {[...Array(5)].map((_, i) => (
                <span
                  key={i}
                  className={`text-lg ${
                    i < report.rating ? "text-yellow-400" : "text-slate-600"
                  }`}
                >
                  ★
                </span>
              ))}
            </div>
          </div>

          {report.nextSteps.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-600">
              <p className="text-xs font-semibold text-slate-400 mb-2">
                Next Steps:
              </p>
              <ul className="space-y-1">
                {report.nextSteps.slice(0, 3).map((step, idx) => (
                  <li key={idx} className="text-xs text-slate-300">
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!report && (
        <div className="p-4 bg-slate-700/50 border border-slate-600 rounded-lg text-center">
          <p className="text-sm text-slate-400">
            Start answering questions to see your evaluation
          </p>
        </div>
      )}
    </div>
  );
}