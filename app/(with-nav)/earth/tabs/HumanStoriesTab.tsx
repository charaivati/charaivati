"use client";

import React from "react";

export default function HumanStoriesTab({ selection, onChange }: any) {
  return (
    <div className="p-4 bg-white/5 rounded-lg">
      <h2 className="text-xl font-semibold mb-3">👥 Human Stories</h2>
      <p className="text-gray-300 mb-4">
        Real experiences from people around the world — how global issues affect lives.
      </p>
      <button
        onClick={() => onChange({ focus: "People" })}
        className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-800"
      >
        View Stories
      </button>
    </div>
  );
}
