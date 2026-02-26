"use client";

import React, { useMemo, useState } from "react";

type Field = {
  key: string;
  label: string;
};

const fields: Field[] = [
  { key: "rent", label: "Rent / Housing" },
  { key: "groceries", label: "Groceries" },
  { key: "utilities", label: "Utilities" },
  { key: "transport", label: "Transport" },
];

function formatINR(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function parseAmount(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export default function SelfTab() {
  const [desiredMonthlyIncome, setDesiredMonthlyIncome] = useState("0");
  const [showEstimator, setShowEstimator] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [taxRate, setTaxRate] = useState("20");
  const [bufferPercent, setBufferPercent] = useState("10");

  const totalExpense = useMemo(
    () => fields.reduce((sum, f) => sum + parseAmount(values[f.key] ?? ""), 0),
    [values]
  );

  const safeTaxRate = Math.min(Math.max(Number(taxRate) / 100 || 0, 0), 0.95);
  const safeBuffer = Math.max(Number(bufferPercent) / 100 || 0, 0);

  const survivalIncome = totalExpense / (1 - safeTaxRate || 1);
  const stableIncome = survivalIncome * (1 + safeBuffer);

  function updateValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="text-white space-y-6">

      {/* PRIMARY BLOCK */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-6">
        <h2 className="text-xl font-semibold">
          Personal Tab: Desired Monthly Income
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          Set your income goal directly. Estimator is optional.
        </p>

        <div className="mt-5 grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs text-gray-400 mb-2 font-semibold">
              Income Goal (INR)
            </label>
            <input
              type="number"
              min={0}
              value={desiredMonthlyIncome}
              onChange={(e) => setDesiredMonthlyIncome(e.target.value)}
              className="w-full p-3 rounded-lg bg-white/10 border border-white/20"
            />
            <p className="text-xs mt-2 text-gray-500">
              Login required to save
            </p>
          </div>

          <div className="rounded-xl bg-gray-950/70 border border-gray-800 p-4">
            <div className="text-gray-400 text-sm">
              Current Desired Income
            </div>
            <div className="text-xl font-semibold mt-2">
              {formatINR(Number(desiredMonthlyIncome || 0))}
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowEstimator((v) => !v)}
          className="mt-6 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-sm"
        >
          {showEstimator ? "Hide estimator" : "Need help calculating?"}
        </button>
      </div>

      {/* ESTIMATOR BLOCK (CONDITIONAL) */}
      {showEstimator && (
        <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-6">

          <h2 className="text-xl font-semibold">
            Lifestyle Income Estimator
          </h2>

          <div className="mt-6 grid md:grid-cols-2 gap-4">
            {fields.map((field) => (
              <input
                key={field.key}
                type="number"
                placeholder={field.label}
                value={values[field.key] ?? ""}
                onChange={(e) => updateValue(field.key, e.target.value)}
                className="p-3 rounded-lg bg-gray-800"
              />
            ))}
          </div>

          <div className="mt-6 space-y-2 text-sm text-gray-300">
            <div>Total Expense: {formatINR(totalExpense)}</div>
            <div>Required Income (after tax): {formatINR(survivalIncome)}</div>
            <div>Stable Income (+buffer): {formatINR(stableIncome)}</div>
          </div>

          <button
            onClick={() =>
              setDesiredMonthlyIncome(String(Math.round(stableIncome)))
            }
            className="mt-6 w-full bg-indigo-600 hover:bg-indigo-500 rounded-lg p-3"
          >
            Use this estimate
          </button>
        </div>
      )}
    </div>
  );
}
