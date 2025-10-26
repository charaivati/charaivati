// app/self/analytics/page.tsx
"use client";

import React, { Suspense } from "react";
import SelfAnalyticsDashboard from "@/components/SelfAnalyticsDashboard";

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen p-6 bg-black text-white">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Your Analytics</h1>
        <div className="rounded-md border bg-gray-900 p-4">
          <Suspense fallback={
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm text-gray-400">Loading analytics...</p>
              </div>
            </div>
          }>
            <SelfAnalyticsDashboard />
          </Suspense>
        </div>
      </div>
    </div>
  );
}