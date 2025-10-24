"use client";

import React, { useState, useEffect } from "react";

type Props = {
  value?: string;
  onChange?: (v: string) => void;
};

export default function LegislativeTab({ value = "", onChange }: Props) {
  const [legislative, setLegislative] = useState<string>(value);

  useEffect(() => {
    setLegislative(value);
  }, [value]);

  function handleSave() {
    onChange?.(legislative.trim());
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-3">Legislative (Vidhan Sabha) constituency</h3>
      <p className="text-sm text-gray-300 mb-4">Select or type the Assembly constituency.</p>

      <div className="p-4 bg-black/40 rounded mb-4">
        <label className="text-sm block mb-2">Assembly constituency</label>
        <input
          value={legislative}
          onChange={(e) => setLegislative(e.target.value)}
          placeholder="Nazira"
          className="w-full p-2 rounded bg-white/6"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setLegislative(value)} className="px-4 py-2 rounded bg-gray-700">Reset</button>
          <button onClick={handleSave} className="px-4 py-2 rounded bg-green-600">Save Assembly</button>
        </div>
      </div>

      <div className="text-sm text-gray-400">Example: <span className="text-white">Nazira</span></div>
    </div>
  );
}
