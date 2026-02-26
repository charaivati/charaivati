"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

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
      { key: "rent", label: "Rent / Housing", tooltip: "Monthly house rent or EMI amount." },
      { key: "groceries", label: "Groceries", tooltip: "Food and household essentials." },
      { key: "utilities", label: "Utilities", tooltip: "Electricity, water, internet, phone, gas." },
      { key: "transport", label: "Transport", tooltip: "Fuel, public transport, and travel essentials." },
    ],
  },
  {
    id: "health",
    title: "Health & Insurance",
    subtitle: "Well-being and protection",
    fields: [
      { key: "medicines", label: "Medicines & Checkups", tooltip: "Average medical expenses per month." },
      { key: "healthInsurance", label: "Health Insurance", tooltip: "Monthly premium for health insurance." },
      { key: "lifeInsurance", label: "Life Insurance", tooltip: "Monthly life insurance allocation." },
    ],
  },
  {
    id: "stability",
    title: "Stability & Emergency",
    subtitle: "Resilience and backup",
    fields: [
      { key: "emergencyFund", label: "Emergency Fund Contribution", tooltip: "Monthly contribution to emergency savings." },
      { key: "debtRepayment", label: "Debt Repayment", tooltip: "Loan/credit card repayment each month." },
      { key: "dependents", label: "Dependent Support", tooltip: "Support for parents/children/others." },
    ],
  },
  {
    id: "lifestyle",
    title: "Lifestyle & Comfort",
    subtitle: "Quality of life choices",
    fields: [
      { key: "dining", label: "Dining & Outings", tooltip: "Eating out, entertainment, and local outings." },
      { key: "subscriptions", label: "Subscriptions", tooltip: "Streaming apps, memberships, digital tools." },
      { key: "shopping", label: "Shopping & Personal Care", tooltip: "Clothing, grooming, personal purchases." },
    ],
  },
  {
    id: "investments",
    title: "Long-Term Investments",
    subtitle: "Future growth and goals",
    fields: [
      { key: "retirement", label: "Retirement Savings", tooltip: "Monthly retirement contribution." },
      { key: "investments", label: "Investments (SIP/Stocks/etc.)", tooltip: "Long-term monthly investments." },
      { key: "education", label: "Education / Skill Fund", tooltip: "Courses, certifications, self-development." },
    ],
  },
];

const allFields = sections.flatMap((section) => section.fields);

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

async function safeFetchJson(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, init);
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

function TooltipLabel({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <label className="text-sm text-gray-200 flex items-center gap-2">
      <span>{label}</span>
      <span
        title={tooltip}
        aria-label={`${label} info: ${tooltip}`}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-700 text-[10px] text-gray-200 cursor-help"
      >
        i
      </span>
    </label>
  );
}

function SectionBlock({
  section,
  values,
  collapsed,
  onToggle,
  onChange,
}: {
  section: Section;
  values: Record<string, string>;
  collapsed: boolean;
  onToggle: () => void;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900/70">
      <button type="button" onClick={onToggle} className="w-full px-4 py-4 text-left flex items-center justify-between" aria-expanded={!collapsed}>
        <div>
          <h3 className="text-base font-semibold text-white">{section.title}</h3>
          <p className="text-xs text-gray-400 mt-1">{section.subtitle}</p>
        </div>
        <span className="text-gray-400 text-sm">{collapsed ? "Expand" : "Collapse"}</span>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {section.fields.map((field) => (
            <div key={field.key} className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
              <TooltipLabel label={field.label} tooltip={field.tooltip} />
              <div className="mt-2 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={values[field.key] ?? ""}
                  onChange={(event) => onChange(field.key, event.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-7 py-2 text-sm text-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function SelfTab() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [taxRate, setTaxRate] = useState<string>("20");
  const [bufferPercent, setBufferPercent] = useState<string>("10");
  const [showEstimator, setShowEstimator] = useState(false);

  const [desiredMonthlyIncome, setDesiredMonthlyIncome] = useState<string>("0");
  const [incomeSaveState, setIncomeSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [canPersistIncome, setCanPersistIncome] = useState(false);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((section) => [section.id, false])),
  );

  useEffect(() => {
    let alive = true;
    safeFetchJson("/api/user/profile", { method: "GET", credentials: "include" })
      .then((r) => {
        if (!alive) return;
        if (r.ok && r.json?.ok) {
          setCanPersistIncome(true);
          const raw = r.json?.profile?.desiredMonthlyIncome;
          if (raw !== undefined && raw !== null) setDesiredMonthlyIncome(String(raw));
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const saveDesiredMonthlyIncome = useCallback(async (value: string) => {
    if (!canPersistIncome) return;

    const parsed = Number(value || 0);
    if (!Number.isFinite(parsed) || parsed < 0) return;

    setIncomeSaveState("saving");
    const resp = await safeFetchJson("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ desiredMonthlyIncome: parsed }),
    });

    if (resp.ok && resp.json?.ok) {
      setIncomeSaveState("saved");
      setTimeout(() => setIncomeSaveState("idle"), 1200);
    } else {
      setIncomeSaveState("error");
    }
  }, [canPersistIncome]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      saveDesiredMonthlyIncome(desiredMonthlyIncome).catch(() => setIncomeSaveState("error"));
    }, 500);
    return () => window.clearTimeout(handle);
  }, [desiredMonthlyIncome, saveDesiredMonthlyIncome]);

  const totalMonthlyExpense = useMemo(
    () => allFields.reduce((sum, field) => sum + parseAmount(values[field.key] ?? ""), 0),
    [values],
  );

  const safeTaxRate = Math.min(Math.max(Number(taxRate) / 100 || 0, 0), 0.95);
  const safeBuffer = Math.max(Number(bufferPercent) / 100 || 0, 0);

  const survivalIncome = totalMonthlyExpense / (1 - safeTaxRate || 1);
  const stableIncome = survivalIncome * (1 + safeBuffer);
  const growthIncome = stableIncome * 1.2;

  const filledCount = allFields.reduce((count, field) => {
    return values[field.key] && parseAmount(values[field.key]) > 0 ? count + 1 : count;
  }, 0);
  const progressPercent = Math.round((filledCount / allFields.length) * 100);

  function updateValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="text-white">
      <div className="mb-5 rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
        <h2 className="text-xl font-semibold">Personal Tab: Desired Monthly Income</h2>
        <p className="mt-2 text-sm text-gray-400">Set your income goal directly. Estimator is optional.</p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-2 font-semibold">Income Goal (INR)</label>
            <input
              type="number"
              min={0}
              value={desiredMonthlyIncome}
              onChange={(e) => setDesiredMonthlyIncome(e.target.value)}
              onBlur={() => saveDesiredMonthlyIncome(desiredMonthlyIncome).catch(() => setIncomeSaveState("error"))}
              className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white"
              placeholder="Enter monthly income goal"
            />
            <p className="text-xs mt-2 text-gray-400">
              {incomeSaveState === "saving" && "Saving..."}
              {incomeSaveState === "saved" && "Saved"}
              {incomeSaveState === "error" && "Could not save. Please try again."}
              {incomeSaveState === "idle" && !canPersistIncome && "Login required to save"}
            </p>
          </div>
          <div className="rounded-xl bg-gray-950/70 border border-gray-800 p-3">
            <div className="text-gray-400 text-sm">Current Desired Income</div>
            <div className="text-lg font-semibold mt-1">{formatINR(Number(desiredMonthlyIncome || 0))}</div>
          </div>
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={() => setShowEstimator((v) => !v)}
            className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-sm text-white"
          >
            Need help calculating?
          </button>
        </div>
      </div>

      {showEstimator && (
        <>
          <div className="mb-5 rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
            <h2 className="text-xl font-semibold">Lifestyle Income Estimator</h2>
            <p className="mt-2 text-sm text-gray-400">
              Estimate your minimum monthly income required to support your desired lifestyle.
            </p>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-gray-300 mb-2">
                <span>Progress</span>
                <span>{filledCount}/{allFields.length} fields filled ({progressPercent}%)</span>
              </div>
              <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5">
            <div className="space-y-4">
              {sections.map((section) => (
                <SectionBlock
                  key={section.id}
                  section={section}
                  values={values}
                  collapsed={Boolean(collapsed[section.id])}
                  onToggle={() => setCollapsed((prev) => ({ ...prev, [section.id]: !prev[section.id] }))}
                  onChange={updateValue}
                />
              ))}
            </div>

            <aside className="lg:sticky lg:top-4 self-start rounded-2xl border border-indigo-600/40 bg-gray-900/90 p-4">
              <h3 className="text-base font-semibold">Real-time Summary</h3>

              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-xl bg-gray-950/70 border border-gray-800 p-3">
                  <div className="text-gray-400">Total Monthly Expense</div>
                  <div className="text-lg font-semibold mt-1">{formatINR(totalMonthlyExpense)}</div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <TooltipLabel label="Tax Rate (%)" tooltip="Assumed monthly effective tax rate used to compute required pre-tax income." />
                    <input
                      type="number"
                      min={0}
                      max={95}
                      value={taxRate}
                      onChange={(event) => setTaxRate(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <TooltipLabel label="Safety Buffer (%)" tooltip="Extra margin to reduce risk from unexpected monthly expenses." />
                    <input
                      type="number"
                      min={0}
                      value={bufferPercent}
                      onChange={(event) => setBufferPercent(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-gray-950/70 border border-gray-800 p-3">
                  <div className="text-gray-400">Required Income after tax</div>
                  <div className="text-base font-semibold mt-1">{formatINR(survivalIncome)}</div>
                </div>

                <div className="rounded-xl border border-gray-800 p-3">
                  <div className="text-xs text-gray-400">Survival Income (no buffer)</div>
                  <div className="font-semibold mt-1">{formatINR(survivalIncome)}</div>
                </div>
                <div className="rounded-xl border border-gray-800 p-3">
                  <div className="text-xs text-gray-400">Stable Income (with buffer)</div>
                  <div className="font-semibold mt-1">{formatINR(stableIncome)}</div>
                </div>
                <div className="rounded-xl border border-gray-800 p-3">
                  <div className="text-xs text-gray-400">Growth Income (+20% on stable)</div>
                  <div className="font-semibold mt-1">{formatINR(growthIncome)}</div>
                </div>

                <button
                  type="button"
                  onClick={() => setDesiredMonthlyIncome(String(Math.round(stableIncome)))}
                  className="w-full rounded-lg px-3 py-2 text-sm bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                >
                  Use this estimate
                </button>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
