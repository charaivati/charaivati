"use client";

import Link from "next/link";

export default function BusinessHome() {
  return (
    <main className="max-w-3xl mx-auto p-8 text-center">
      <h1 className="text-3xl font-bold mb-4">Evaluate & Plan Your Business</h1>
      <p className="text-gray-300 mb-8">
        Answer a few questions to validate your idea, get a score across key dimensions,
        and then build a full business plan with SWOT analysis, Business Model Canvas,
        and a 3-year financial forecast.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
        <Link
          href="/business/idea"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          Start Evaluation →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
        <div className="bg-gray-900/50 p-4 rounded-lg border border-white/10">
          <div className="text-2xl mb-2">🎯</div>
          <h3 className="font-semibold mb-2">Evaluate your idea</h3>
          <p className="text-sm text-gray-400">Answer 12 questions to score your idea across 6 dimensions: problem clarity, market need, feasibility, and more.</p>
        </div>
        <div className="bg-gray-900/50 p-4 rounded-lg border border-white/10">
          <div className="text-2xl mb-2">📊</div>
          <h3 className="font-semibold mb-2">SWOT & Business Model</h3>
          <p className="text-sm text-gray-400">Map out your strengths, weaknesses, opportunities, threats, and fill in the Business Model Canvas.</p>
        </div>
        <div className="bg-gray-900/50 p-4 rounded-lg border border-white/10">
          <div className="text-2xl mb-2">📈</div>
          <h3 className="font-semibold mb-2">3-Year Financial Plan</h3>
          <p className="text-sm text-gray-400">Project your costs and revenue for Year 1, 2, and 3 to understand viability and breakeven.</p>
        </div>
      </div>
    </main>
  );
}
