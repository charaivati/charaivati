"use client";

import React from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
};

export default function ExecutiveTab({ value, onChange }: Props) {
  return (
    <div className="p-4 bg-white/5 rounded-lg">
      <label className="block text-sm text-gray-200 mb-2">Executive (examples & notes)</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe executive: head of government/state, cabinet, bureaucracy (e.g., Prime Minister & Council of Ministers)"
        className="w-full min-h-[120px] p-3 rounded bg-black/40 text-white text-sm outline-none"
      />

      <div className="mt-3 text-xs text-gray-300">
        <strong>Tip:</strong> Include how the executive is formed, appointment powers, and relationship with legislature.
      </div>
    </div>
  );
}
