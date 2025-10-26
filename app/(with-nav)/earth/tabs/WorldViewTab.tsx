"use client";

import React from "react";

export default function WorldViewTab({ selection, onChange }: any) {
  return (
    <div className="p-4 bg-white/5 rounded-lg">
      <h2 className="text-xl font-semibold mb-3">🌍 World View</h2>
      <p className="text-gray-300 mb-4">
        Visualize the planet’s current state — climate, economy, and humanity’s shared indicators.
      </p>
      <button
        onClick={() => onChange({ focus: "Environment" })}
        className="px-4 py-2 rounded bg-red-700 hover:bg-red-800"
      >
        Focus on Environment
      </button>
    </div>
  );
}
