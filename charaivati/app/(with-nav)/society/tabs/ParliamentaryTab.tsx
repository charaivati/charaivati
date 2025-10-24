"use client";

import React, { useState, useEffect } from "react";

type Props = {
  value?: string;
  onChange?: (v: string) => void;
};

export default function ParliamentaryTab({ value = "", onChange }: Props) {
  const [parliamentary, setParliamentary] = useState<string>(value);

  useEffect(() => {
    setParliamentary(value);
  }, [value]);

  function handleSave() {
    onChange?.(parliamentary.trim());
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-3">Parliamentary (Lok Sabha) constituency</h3>
      <p className="text-sm text-gray-300 mb-4">Select or type the Lok Sabha constituency.</p>

      <div className="p-4 bg-black/40 rounded mb-4">
        <label className="text-sm block mb-2">Parliamentary constituency</label>
        <input
          value={parliamentary}
          onChange={(e) => setParliamentary(e.target.value)}
          placeholder="Jorhat"
          className="w-full p-2 rounded bg-white/6"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setParliamentary(value)} className="px-4 py-2 rounded bg-gray-700">Reset</button>
          <button onClick={handleSave} className="px-4 py-2 rounded bg-green-600">Save Parliamentary</button>
        </div>
      </div>

      <div className="text-sm text-gray-400">Example: <span className="text-white">Jorhat</span></div>
    </div>
  );
}
