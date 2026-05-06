"use client";

import React from "react";

const placeholderPromises = [
  { id: "p1", title: "Create jobs for youth", status: "Not Started" },
  { id: "p2", title: "Improve healthcare infrastructure", status: "In Progress" },
  { id: "p3", title: "Financial support schemes", status: "Unknown" },
];

export default function ManifestoSection() {
  return (
    <div className="space-y-4">

      {/* Header feels more “report-like” */}
      <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
        <h3 className="text-lg font-semibold">Manifesto Tracker</h3>
        <p className="text-sm text-gray-400 mt-1">
          What was promised by the ruling party. Compare with ground reality.
        </p>
      </div>

      {/* Cards feel more “data”, less “interactive” */}
      <div className="grid gap-3 md:grid-cols-2">
        {placeholderPromises.map((promise) => (
          <div
            key={promise.id}
            className="rounded-xl border border-white/5 bg-black/10 p-4"
          >
            <h4 className="font-medium text-white/90">{promise.title}</h4>

            <div className="mt-2 text-xs text-gray-500">
              Status: <span className="text-gray-300">{promise.status}</span>
            </div>

            {/* future hook */}
            <div className="mt-3 text-xs text-gray-600">
              No linked ground reports yet
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}