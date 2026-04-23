"use client";

import { useState } from "react";

type ConsentOption = {
  label: string;
  fields: string[];
  defaultChecked: boolean;
};

const CONSENT_OPTIONS: ConsentOption[] = [
  { label: "BMI and weight goal",  fields: ["heightCm", "weightKg"],       defaultChecked: true  },
  { label: "Sleep quality",         fields: ["sleepQuality"],               defaultChecked: true  },
  { label: "Mood and stress",       fields: ["mood", "stressLevel"],        defaultChecked: true  },
  { label: "Energy level",          fields: ["energyLevel"],                defaultChecked: false },
  { label: "Food preferences",      fields: ["food"],                       defaultChecked: false },
];

type Props = {
  expertName: string;
  onConfirm: (consentFields: string[]) => void;
  onCancel: () => void;
};

export default function ConsentModal({ expertName, onConfirm, onCancel }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(CONSENT_OPTIONS.map((o) => [o.label, o.defaultChecked]))
  );

  function toggle(label: string) {
    setChecked((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  function handleConfirm() {
    const fields = CONSENT_OPTIONS
      .filter((o) => checked[o.label])
      .flatMap((o) => o.fields);
    onConfirm(fields);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-sm bg-[#111] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-base font-semibold text-white">Data Access Request</h2>
          <p className="text-sm text-gray-400 mt-1">
            <span className="font-medium text-emerald-400">{expertName}</span> will be able to see:
          </p>
        </div>

        {/* Checkboxes */}
        <div className="px-5 pb-4 space-y-3">
          {CONSENT_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => toggle(opt.label)}
              className="flex items-start gap-3 w-full text-left group"
            >
              <span
                className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  checked[opt.label]
                    ? "bg-emerald-500 border-emerald-500"
                    : "border-gray-600 bg-gray-900 group-hover:border-gray-400"
                }`}
              >
                {checked[opt.label] && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="text-sm text-gray-300 leading-tight">{opt.label}</span>
            </button>
          ))}
        </div>

        {/* Footer text */}
        <div className="px-5 pb-4">
          <p className="text-xs text-gray-600">You can change this anytime from Privacy settings.</p>
        </div>

        {/* Buttons */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-700 bg-gray-900 hover:border-gray-500 text-sm text-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium hover:from-emerald-600 hover:to-teal-700 transition-all"
          >
            Agree &amp; Subscribe
          </button>
        </div>
      </div>
    </div>
  );
}
