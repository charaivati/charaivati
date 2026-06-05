// components/business/ResultsReport.tsx
"use client";

import { useRouter } from "next/navigation";
import React from "react";

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
}

export default function ResultsReport({
  title,
  description,
  scores,
  report,
  ideaId,
}: ReportProps) {
  const router = useRouter();

  const dimensionLabels: Record<string, string> = {
    problemClarity: "Problem Clarity",
    marketNeed: "Market Need",
    targetAudience: "Target Audience",
    uniqueValue: "Unique Value",
    feasibility: "Feasibility",
    monetization: "Monetization",
  };

  const renderStars = (score = 0): string => {
    // Convert -2..2 -> 1..5 roughly
    const starCount = Math.min(5, Math.max(1, Math.round((score + 2) * 1.25))); // alternative scaling
    return "⭐".repeat(starCount);
  };

  const handleCreatePlan = () => {
    if (!ideaId) {
      alert("Missing idea ID");
      return;
    }
    // next/navigation router push (client)
    router.push(`/business/plan/${ideaId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">Your Idea Report</h1>
          <p className="text-slate-400 text-lg">{title}</p>
          <p className="text-slate-500 text-sm mt-2">{description}</p>
        </div>

        <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/50 rounded-2xl p-8 mb-8">
          <p className="text-3xl font-bold text-white text-center">
            {report?.verdict ?? "Verdict unavailable"}
          </p>
          <p className="text-center text-slate-400 mt-4">
            Overall Rating: {renderStars(report?.rating ?? 3)}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {Object.entries(scores || {}).map(([dim, score]) => (
            <div
              key={dim}
              className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6"
            >
              <p className="text-slate-400 text-sm mb-3">
                {dimensionLabels[dim] || dim}
              </p>
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
          ))}
        </div>

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

        <div className="flex gap-4 justify-center">
          <button
            type="button"
            onClick={handleCreatePlan}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg text-white font-medium transition"
          >
            📄 Create Business Plan
          </button>
        </div>
      </div>
    </div>
  );
}
