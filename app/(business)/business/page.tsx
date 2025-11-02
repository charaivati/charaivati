// app/(business)/business/page.tsx
"use client";

import Link from "next/link";

export default function BusinessHome() {
  return (
    <main className="max-w-3xl mx-auto p-8 text-center">
      <h1 className="text-3xl font-bold mb-4">Earn with Charaivati</h1>
      <p className="text-gray-300 mb-8">
        Plan, validate, and grow your business — even if you’re just getting started.
        We’ll help you find real opportunities, estimate costs, and create an action plan.
      </p>
      <Link
        href="/business/plan"
        className="inline-block px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
      >
        Start your Business Plan →
      </Link>

      <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
        <div className="bg-gray-900/50 p-4 rounded">
          <h3 className="font-semibold mb-2">Find real gaps</h3>
          <p className="text-sm text-gray-400">Identify demand-supply mismatches in your area.</p>
        </div>
        <div className="bg-gray-900/50 p-4 rounded">
          <h3 className="font-semibold mb-2">Validate your idea</h3>
          <p className="text-sm text-gray-400">Estimate your costs and breakeven before investing.</p>
        </div>
        <div className="bg-gray-900/50 p-4 rounded">
          <h3 className="font-semibold mb-2">Create action steps</h3>
          <p className="text-sm text-gray-400">Get a 30-day plan to launch or grow your venture.</p>
        </div>
      </div>
    </main>
  );
}
