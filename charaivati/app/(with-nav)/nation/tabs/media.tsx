"use client";

import React from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
};

export default function MediaTab({ value, onChange }: Props) {
  return (
    <div className="p-4 bg-white/5 rounded-lg">
      <label className="block text-sm text-gray-200 mb-2">Media (examples & notes)</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe media: press, broadcast, digital outlets, role as watchdog and information source"
        className="w-full min-h-[120px] p-3 rounded bg-black/40 text-white text-sm outline-none"
      />

      <div className="mt-3 text-xs text-gray-300">
        <strong>Tip:</strong> Note media freedom, major outlets, and how media interacts with other pillars.
      </div>
    </div>
  );
}
