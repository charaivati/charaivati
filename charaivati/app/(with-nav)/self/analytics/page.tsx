// app/self/analytics/page.tsx
import React from "react";
import SelfAnalyticsDashboard from "@/components/SelfAnalyticsDashboard";

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen p-6 bg-black text-white">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Your Analytics</h1>
        <div className="rounded-md border bg-gray-900 p-4">
          <SelfAnalyticsDashboard />
        </div>
      </div>
    </div>
  );
}
