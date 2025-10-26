"use client";

import React from "react";

export default function KnowledgeTab({ selection, onChange }: any) {
  return (
    <div className="p-4 bg-white/5 rounded-lg">
      <h2 className="text-xl font-semibold mb-3">🧠 Knowledge / Tools</h2>
      <p className="text-gray-300 mb-4">
        Learn about global systems, data visualizations, and practical tools to create change.
      </p>
      <button
        onClick={() => onChange({ focus: "Education" })}
        className="px-4 py-2 rounded bg-yellow-700 hover:bg-yellow-800"
      >
        Open Knowledge Hub
      </button>
    </div>
  );
}
