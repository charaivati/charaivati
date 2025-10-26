"use client";

import React from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
};

export default function JudiciaryTab({ value, onChange }: Props) {
  return (
    <div className="p-4 bg-white/5 rounded-lg">
      <label className="block text-sm text-gray-200 mb-2">Judiciary (examples & notes)</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe judiciary: courts, independence, landmark powers (e.g., Supreme Court, High Courts)"
        className="w-full min-h-[120px] p-3 rounded bg-black/40 text-white text-sm outline-none"
      />

      <div className="mt-3 text-xs text-gray-300">
        <strong>Tip:</strong> Mention judicial review, appointment process, and examples of constitutional interpretation.
      </div>
    </div>
  );
}
