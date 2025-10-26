"use client";

import React, { useState, useEffect } from "react";

type Props = {
  value?: string;
  onChange?: (v: string) => void;
};

export default function PanchayatTab({ value = "", onChange }: Props) {
  const [panchayat, setPanchayat] = useState<string>(value);

  useEffect(() => {
    setPanchayat(value);
  }, [value]);

  function handleSave() {
    onChange?.(panchayat.trim());
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-3">Panchayat / Ward</h3>
      <p className="text-sm text-gray-300 mb-4">Enter the local Panchayat or Ward name for your area.</p>

      <div className="p-4 bg-black/40 rounded mb-4">
        <label className="text-sm block mb-2">Panchayat / Ward name</label>
        <input
          value={panchayat}
          onChange={(e) => setPanchayat(e.target.value)}
          placeholder="Amguri Gaon Panchayat"
          className="w-full p-2 rounded bg-white/6"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => { setPanchayat(value); }} className="px-4 py-2 rounded bg-gray-700">Reset</button>
          <button onClick={handleSave} className="px-4 py-2 rounded bg-green-600">Save Panchayat</button>
        </div>
      </div>

      <div className="text-sm text-gray-400">
        Example: <span className="text-white">Amguri Gaon Panchayat</span>
      </div>
    </div>
  );
}
