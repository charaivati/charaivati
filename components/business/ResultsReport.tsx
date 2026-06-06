// components/business/ResultsReport.tsx
"use client";

import { useRouter } from "next/navigation";
import React from "react";
import type { DimProvenance } from "./LiveScoreDashboard";

interface ReportProps {
  title: string;
  description: string;
  scores: Record<string, number>;
  overallScore?: number;
  report: {
    verdict?: string;
    nextSteps?: string[];
    rating?: number;
  } | null;
  ideaId: string | null;
  /** Which model tier produced the verdict */
  tier?: "senior" | "local" | string;
  /** Per-dimension provenance for the score breakdown */
  dimProvenance?: Record<string, DimProvenance>;
}

const DIMENSION_LABELS: Record<string, string> = {
  problemClarity: "Problem Clarity",
  marketNeed: "Market Need",
  targetAudience: "Target Audience",
  uniqueValue: "Unique Value",
  feasibility: "Feasibility",
  monetization: "Monetization",
};

function renderStars(score = 0): string {
  const starCount = Math.min(5, Math.max(1, Math.round((score + 2) * 1.25)));
  return "⭐".repeat(starCount);
}

export default function ResultsReport({
  title,
  description,
  scores,
  report,
  ideaId,
  tier,
  dimProvenance,
}: ReportProps) {
  const router = useRouter();

  const isSenior = tier === "senior";
  const isLocalOnly = tier === "local";

  const tierBadge = isSenior
    ? { label: "Senior AI Review", color: "text-indigo-400 border-indigo-500/50 bg-indigo-500/10" }
    : isLocalOnly
    ? { label: "Quick Evaluation — senior review unavailable", color: "text-yellow-400 border-yellow-500/50 bg-yellow-500/10" }
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Your Idea Report</h1>
          <p className="text-slate-400 text-lg">{title}</p>
          {description && (
            <p className="text-slate-500 text-sm mt-2">{description}</p>
          )}
          {tierBadge && (
            <span
              className={`inline-block mt-3 px-3 py-1 rounded-full text-xs border ${tierBadge.color}`}
            >
              {tierBadge.label}
            </span>
          )}
        </div>

        {/* Verdict banner */}
        <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/50 rounded-2xl p-8 mb-8">
          <p className="text-3xl font-bold text-white text-center">
            {report?.verdict ?? "Evaluation complete."}
          </p>
          <p className="text-center text-slate-400 mt-4">
            Overall Rating: {renderStars(report?.rating ?? 3)}
          </p>
          {isSenior && (
            <p className="text-center text-indigo-400 text-xs mt-2">
              ✦ Produced by senior cloud model
            </p>
          )}
          {isLocalOnly && (
            <p className="text-center text-yellow-400 text-xs mt-2">
              This is a quick local estimate. Senior review was unavailable at this time.
            </p>
          )}
        </div>

        {/* Dimension scores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {Object.entries(scores ?? {}).map(([dim, score]) => {
            const p = dimProvenance?.[dim];
            return (
              <div
                key={dim}
                className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-slate-400 text-sm">
                    {DIMENSION_LABELS[dim] ?? dim}
                  </p>
                  {p && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        p === "senior_reviewed"
                          ? "text-indigo-400 bg-indigo-500/10"
                          : "text-slate-500 bg-slate-700"
                      }`}
                    >
                      {p === "senior_reviewed" ? "✦ senior" : "~ local"}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-bold text-purple-400">
                    {renderStars(score)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {score > 0 ? "+" : ""}
                    {score}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Next steps */}
        {report?.nextSteps && report.nextSteps.length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Next Steps</h2>
            <ul className="space-y-3">
              {report.nextSteps.map((step, idx) => (
                <li key={idx} className="text-slate-300 flex items-start gap-3">
                  <span className="text-purple-400 mt-1">▸</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <div className="flex gap-4 justify-center">
          {ideaId && (
            <button
              type="button"
              onClick={() => router.push(`/business/plan/${ideaId}`)}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg text-white font-medium transition"
            >
              📄 Create Business Plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
