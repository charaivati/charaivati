"use client";

import React, { useMemo, useState } from "react";

type Field = {
  key: string;
  label: string;
  tooltip: string;
};

type Section = {
  id: string;
  title: string;
  subtitle: string;
  fields: Field[];
};

const sections: Section[] = [
  {
    id: "basic",
    title: "Basic Living Costs",
    subtitle: "Core monthly needs",
    fields: [
      { key: "rent", label: "Rent / Housing", tooltip: "Monthly rent or EMI." },
      { key: "groceries", label: "Groceries", tooltip: "Food & essentials." },
      { key: "utilities", label: "Utilities", tooltip: "Electricity, internet, etc." },
      { key: "transport", label: "Transport", tooltip: "Fuel & travel." },
    ],
  },
];

const allFields = sections.flatMap((s) => s.fields);

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
  const [values, setValues] = useState<Record<string, string>>({});
  const [taxRate, setTaxRate] = useState("20");
  const [bufferPercent, setBufferPercent] = useState("10");
  const [showEstimator, setShowEstimator] = useState(false);
  const [desiredMonthlyIncome, setDesiredMonthlyIncome] = useState("0");

  const totalMonthlyExpense = useMemo(
    () => allFields.reduce((sum, f) => sum + parseAmount(values[f.key] ?? ""), 0),
    [values]
  );

  const safeTaxRate = Math.min(Math.max(Number(taxRate) / 100 || 0, 0), 0.95);
  const safeBuffer = Math.max(Number(bufferPercent) / 100 || 0, 0);

  const survivalIncome = totalMonthlyExpense / (1 - safeTaxRate || 1);
  const stableIncome = survivalIncome * (1 + safeBuffer);

  function updateValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="text-white space-y-6">

      {/* Desired Income Block */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
        <h2 className="text-xl font-semibold">Desired Monthly Income</h2>

        <div className="mt-4 grid md:grid-cols-2 gap-4">
          <input
            type="number"
            min={0}
            value={desiredMonthlyIncome}
            onChange={(e) => setDesiredMonthlyIncome(e.target.value)}
            className="p-3 rounded-lg bg-white/10 border border-white/20"
          />

          <div className="rounded-xl bg-gray-950/70 border border-gray-800 p-3">
            <div className="text-sm text-gray-400">Current Desired Income</div>
            <div className="text-lg font-semibold">
              {formatINR(Number(desiredMonthlyIncome || 0))}
            </div>
          </div>
        </div>

        <button
          className="mt-4 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-sm"
          onClick={() => setShowEstimator((v) => !v)}
        >
          Need help calculating?
        </button>
      </div>

      {/* Estimator */}
      {showEstimator && (
        <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
          <h2 className="text-xl font-semibold">Lifestyle Estimator</h2>

          {sections.map((section) => (
            <div key={section.id} className="mt-4 space-y-3">
              {section.fields.map((field) => (
                <input
                  key={field.key}
                  type="number"
                  placeholder={field.label}
                  value={values[field.key] ?? ""}
                  onChange={(e) => updateValue(field.key, e.target.value)}
                  className="w-full p-2 rounded bg-gray-800"
                />
              ))}
            </div>
          ))}

          <div className="mt-6 text-sm space-y-2">
            <div>Total Expense: {formatINR(totalMonthlyExpense)}</div>
            <div>Required Income: {formatINR(survivalIncome)}</div>
            <div>Stable Income: {formatINR(stableIncome)}</div>
          </div>

          <button
            className="mt-4 w-full bg-indigo-600 rounded p-2"
            onClick={() => setDesiredMonthlyIncome(String(Math.round(stableIncome)))}
          >
            Use this estimate
          </button>
        </div>
      )}
    </div>
  );
}
