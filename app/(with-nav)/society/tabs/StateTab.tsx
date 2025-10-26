"use client";

import React, { useState, useEffect } from "react";

type Props = {
  value?: string;
  onChange?: (v: string) => void;
};

export default function StateTab({ value = "", onChange }: Props) {
  const [stateName, setStateName] = useState<string>(value);

  useEffect(() => {
    setStateName(value);
  }, [value]);

  function handleSave() {
    onChange?.(stateName.trim());
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-3">State</h3>
      <p className="text-sm text-gray-300 mb-4">Select or type the state for this local area.</p>

      <div className="p-4 bg-black/40 rounded mb-4">
        <label className="text-sm block mb-2">State</label>
        <input
          value={stateName}
          onChange={(e) => setStateName(e.target.value)}
          placeholder="Assam"
          className="w-full p-2 rounded bg-white/6"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setStateName(value)} className="px-4 py-2 rounded bg-gray-700">Reset</button>
          <button onClick={handleSave} className="px-4 py-2 rounded bg-green-600">Save State</button>
        </div>
      </div>

      <div className="text-sm text-gray-400">Example: <span className="text-white">Assam</span></div>
    </div>
  );
}
