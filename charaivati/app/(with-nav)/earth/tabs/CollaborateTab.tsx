"use client";

import React from "react";

export default function CollaborateTab({ selection, onChange }: any) {
  return (
    <div className="p-4 bg-white/5 rounded-lg">
      <h2 className="text-xl font-semibold mb-3">🤝 Collaborate / Act Now</h2>
      <p className="text-gray-300 mb-4">
        Connect with people or projects making global impact. Join causes or start your own.
      </p>
      <button
        onClick={() => onChange({ focus: "Collaboration" })}
        className="px-4 py-2 rounded bg-green-700 hover:bg-green-800"
      >
        Explore Collaborations
      </button>
    </div>
  );
}
