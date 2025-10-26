"use client";

import React from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
};

export default function LegislatureTab({ value, onChange }: Props) {
  return (
    <div className="p-4 bg-white/5 rounded-lg">
      <label className="block text-sm text-gray-200 mb-2">Legislature (examples & notes)</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe legislature: chambers, major parties, examples (e.g., Parliament — Lok Sabha & Rajya Sabha)"
        className="w-full min-h-[120px] p-3 rounded bg-black/40 text-white text-sm outline-none"
      />

      <div className="mt-3 text-xs text-gray-300">
        <strong>Tip:</strong> Mention key institutions, election cycle, and notable powers or checks (budget approval, law-making).
      </div>
    </div>
  );
}
