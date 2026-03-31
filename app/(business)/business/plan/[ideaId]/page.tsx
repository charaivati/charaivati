"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";

/* -------------------- Types -------------------- */

interface SWOTData {
  strengths: string;
  weaknesses: string;
  opportunities: string;
  threats: string;
}

interface BMCData {
  keyPartners: string;
  keyActivities: string;
  keyResources: string;
  valuePropositions: string;
  customerRelationships: string;
  channels: string;
  customerSegments: string;
  costStructure: string;
  revenueStreams: string;
}

interface YearFinancials {
  revenue: string;
  cogs: string;
  operatingCosts: string;
  marketingCosts: string;
  otherCosts: string;
}

type FinancialPlan = {
  year1: YearFinancials;
  year2: YearFinancials;
  year3: YearFinancials;
};

type Tab = "swot" | "bmc" | "financials";

/* -------------------- Helpers -------------------- */

const emptyYear = (): YearFinancials => ({
  revenue: "",
  cogs: "",
  operatingCosts: "",
  marketingCosts: "",
  otherCosts: "",
});

function calcProfit(y: YearFinancials): number {
  const rev = parseFloat(y.revenue) || 0;
  const totalCost =
    (parseFloat(y.cogs) || 0) +
    (parseFloat(y.operatingCosts) || 0) +
    (parseFloat(y.marketingCosts) || 0) +
    (parseFloat(y.otherCosts) || 0);
  return rev - totalCost;
}

function fmt(n: number): string {
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

/* -------------------- Sub-components -------------------- */

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full p-3 rounded-lg bg-slate-800/60 border border-slate-700 text-white text-sm placeholder-slate-500 resize-none focus:outline-none focus:border-purple-500 transition"
      />
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-400">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "0"}
        className="w-full p-2 rounded-lg bg-slate-800/60 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
      />
    </div>
  );
}

/* -------------------- SWOT Panel -------------------- */

function SWOTPanel({
  data,
  onChange,
}: {
  data: SWOTData;
  onChange: (d: SWOTData) => void;
}) {
  const set = (key: keyof SWOTData) => (v: string) =>
    onChange({ ...data, [key]: v });

  const quadrants: { key: keyof SWOTData; label: string; color: string; placeholder: string }[] = [
    {
      key: "strengths",
      label: "Strengths",
      color: "border-green-500/50 bg-green-500/5",
      placeholder: "What do you do well? Unique skills, resources, competitive advantages...",
    },
    {
      key: "weaknesses",
      label: "Weaknesses",
      color: "border-red-500/50 bg-red-500/5",
      placeholder: "Where do you lack? Gaps in skills, resources, processes...",
    },
    {
      key: "opportunities",
      label: "Opportunities",
      color: "border-blue-500/50 bg-blue-500/5",
      placeholder: "Market trends, unmet needs, regulatory changes that help you...",
    },
    {
      key: "threats",
      label: "Threats",
      color: "border-yellow-500/50 bg-yellow-500/5",
      placeholder: "Competition, market risks, economic factors, regulatory challenges...",
    },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">SWOT Analysis</h2>
      <p className="text-slate-400 text-sm mb-6">
        Map your internal strengths and weaknesses against external opportunities and threats.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quadrants.map((q) => (
          <div key={q.key} className={`p-4 rounded-xl border ${q.color}`}>
            <TextArea
              label={q.label}
              value={data[q.key]}
              onChange={set(q.key)}
              placeholder={q.placeholder}
              rows={5}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------- BMC Panel -------------------- */

function BMCPanel({
  data,
  onChange,
}: {
  data: BMCData;
  onChange: (d: BMCData) => void;
}) {
  const set = (key: keyof BMCData) => (v: string) =>
    onChange({ ...data, [key]: v });

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">Business Model Canvas</h2>
      <p className="text-slate-400 text-sm mb-6">
        Define the 9 building blocks of your business model.
      </p>

      {/* Row 1: Key Partners | Key Activities | Value Propositions | Customer Relationships | Customer Segments */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
        <div className="md:col-span-1 p-3 rounded-xl bg-slate-800/50 border border-slate-700">
          <TextArea
            label="Key Partners"
            value={data.keyPartners}
            onChange={set("keyPartners")}
            placeholder="Who are your key suppliers and partners?"
            rows={5}
          />
        </div>
        <div className="md:col-span-1 p-3 rounded-xl bg-slate-800/50 border border-slate-700">
          <TextArea
            label="Key Activities"
            value={data.keyActivities}
            onChange={set("keyActivities")}
            placeholder="What key activities does your value proposition require?"
            rows={5}
          />
        </div>
        <div className="md:col-span-1 p-3 rounded-xl bg-purple-500/10 border border-purple-500/50">
          <TextArea
            label="Value Propositions"
            value={data.valuePropositions}
            onChange={set("valuePropositions")}
            placeholder="What value do you deliver? What problem do you solve?"
            rows={5}
          />
        </div>
        <div className="md:col-span-1 p-3 rounded-xl bg-slate-800/50 border border-slate-700">
          <TextArea
            label="Customer Relationships"
            value={data.customerRelationships}
            onChange={set("customerRelationships")}
            placeholder="How do you acquire, retain, and grow customers?"
            rows={5}
          />
        </div>
        <div className="md:col-span-1 p-3 rounded-xl bg-blue-500/10 border border-blue-500/50">
          <TextArea
            label="Customer Segments"
            value={data.customerSegments}
            onChange={set("customerSegments")}
            placeholder="Who are you creating value for? Who are your most important customers?"
            rows={5}
          />
        </div>
      </div>

      {/* Row 2: Key Resources | Channels */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
        <div className="md:col-span-1 p-3 rounded-xl bg-slate-800/50 border border-slate-700">
          <TextArea
            label="Key Resources"
            value={data.keyResources}
            onChange={set("keyResources")}
            placeholder="Physical, intellectual, human, and financial resources..."
            rows={4}
          />
        </div>
        <div className="md:col-span-1 md:col-start-4 p-3 rounded-xl bg-slate-800/50 border border-slate-700">
          <TextArea
            label="Channels"
            value={data.channels}
            onChange={set("channels")}
            placeholder="How do you reach your customer segments?"
            rows={4}
          />
        </div>
      </div>

      {/* Row 3: Cost Structure | Revenue Streams */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/30">
          <TextArea
            label="Cost Structure"
            value={data.costStructure}
            onChange={set("costStructure")}
            placeholder="What are the most important costs? Fixed vs variable costs, economies of scale..."
            rows={4}
          />
        </div>
        <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/30">
          <TextArea
            label="Revenue Streams"
            value={data.revenueStreams}
            onChange={set("revenueStreams")}
            placeholder="How does your business earn revenue? Pricing model, one-time vs recurring..."
            rows={4}
          />
        </div>
      </div>
    </div>
  );
}

/* -------------------- Financials Panel -------------------- */

function FinancialsPanel({
  data,
  onChange,
}: {
  data: FinancialPlan;
  onChange: (d: FinancialPlan) => void;
}) {
  const setYear =
    (year: keyof FinancialPlan) =>
    (key: keyof YearFinancials) =>
    (v: string) =>
      onChange({ ...data, [year]: { ...data[year], [key]: v } });

  const years: { key: keyof FinancialPlan; label: string }[] = [
    { key: "year1", label: "Year 1" },
    { key: "year2", label: "Year 2" },
    { key: "year3", label: "Year 3" },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">3-Year Financial Plan</h2>
      <p className="text-slate-400 text-sm mb-6">
        Estimate your costs and revenue for each year. All amounts in ₹ (INR).
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {years.map(({ key, label }) => {
          const y = data[key];
          const profit = calcProfit(y);
          const profitColor =
            profit > 0
              ? "text-green-400"
              : profit < 0
              ? "text-red-400"
              : "text-slate-400";

          return (
            <div
              key={key}
              className="p-4 rounded-xl bg-slate-800/50 border border-slate-700"
            >
              <h3 className="text-lg font-bold text-white mb-4">{label}</h3>
              <div className="space-y-3">
                <NumberInput
                  label="Total Revenue (₹)"
                  value={y.revenue}
                  onChange={setYear(key)("revenue")}
                  placeholder="500000"
                />
                <div className="border-t border-slate-700 pt-2 mt-2">
                  <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Costs</p>
                  <div className="space-y-2">
                    <NumberInput
                      label="Cost of Goods Sold (₹)"
                      value={y.cogs}
                      onChange={setYear(key)("cogs")}
                      placeholder="200000"
                    />
                    <NumberInput
                      label="Operating Costs (₹)"
                      value={y.operatingCosts}
                      onChange={setYear(key)("operatingCosts")}
                      placeholder="100000"
                    />
                    <NumberInput
                      label="Marketing Costs (₹)"
                      value={y.marketingCosts}
                      onChange={setYear(key)("marketingCosts")}
                      placeholder="50000"
                    />
                    <NumberInput
                      label="Other Costs (₹)"
                      value={y.otherCosts}
                      onChange={setYear(key)("otherCosts")}
                      placeholder="30000"
                    />
                  </div>
                </div>
                <div className="border-t border-slate-700 pt-3 mt-2 flex justify-between items-center">
                  <span className="text-sm text-slate-400">Net Profit / Loss</span>
                  <span className={`font-bold ${profitColor}`}>{fmt(profit)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Table */}
      <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-3">Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="text-left py-2 pr-4">Metric</th>
                <th className="text-right py-2 px-4">Year 1</th>
                <th className="text-right py-2 px-4">Year 2</th>
                <th className="text-right py-2 px-4">Year 3</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {(["Revenue", "Total Costs", "Net Profit"] as const).map((metric) => {
                const vals = years.map(({ key }) => {
                  const y = data[key];
                  if (metric === "Revenue") return parseFloat(y.revenue) || 0;
                  if (metric === "Total Costs") {
                    return (
                      (parseFloat(y.cogs) || 0) +
                      (parseFloat(y.operatingCosts) || 0) +
                      (parseFloat(y.marketingCosts) || 0) +
                      (parseFloat(y.otherCosts) || 0)
                    );
                  }
                  return calcProfit(y);
                });

                return (
                  <tr key={metric}>
                    <td className="py-2 pr-4 text-slate-300">{metric}</td>
                    {vals.map((v, i) => (
                      <td
                        key={i}
                        className={`text-right py-2 px-4 ${
                          metric === "Net Profit"
                            ? v > 0
                              ? "text-green-400 font-semibold"
                              : v < 0
                              ? "text-red-400 font-semibold"
                              : "text-slate-400"
                            : "text-slate-300"
                        }`}
                      >
                        {fmt(v)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Main Page -------------------- */

export default function BusinessPlanPage() {
  const params = useParams();
  const ideaId = params?.ideaId as string | undefined;

  const [activeTab, setActiveTab] = useState<Tab>("swot");
  const [saved, setSaved] = useState(false);
  const [storeBusinessId, setStoreBusinessId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const id = localStorage.getItem("earn_selected_business_v1");
      if (id) setStoreBusinessId(id);
    } catch {}
  }, []);

  const [swot, setSWOT] = useState<SWOTData>({
    strengths: "",
    weaknesses: "",
    opportunities: "",
    threats: "",
  });

  const [bmc, setBMC] = useState<BMCData>({
    keyPartners: "",
    keyActivities: "",
    keyResources: "",
    valuePropositions: "",
    customerRelationships: "",
    channels: "",
    customerSegments: "",
    costStructure: "",
    revenueStreams: "",
  });

  const [financials, setFinancials] = useState<FinancialPlan>({
    year1: emptyYear(),
    year2: emptyYear(),
    year3: emptyYear(),
  });

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "swot", label: "SWOT Analysis", icon: "🎯" },
    { key: "bmc", label: "Business Model Canvas", icon: "🗂️" },
    { key: "financials", label: "3-Year Financials", icon: "📈" },
  ];

  const handleSave = () => {
    // Save to localStorage for now
    const planData = { swot, bmc, financials, ideaId };
    try {
      localStorage.setItem(`business_plan_${ideaId ?? "draft"}`, JSON.stringify(planData));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 pb-16">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          {/* Navigation row */}
          <div className="flex gap-2 mb-5 flex-wrap">
            <a
              href="/self?tab=earn"
              className="px-3 py-1.5 rounded-lg text-xs bg-slate-800/70 hover:bg-slate-700/70 text-slate-300 hover:text-white border border-slate-700 transition"
            >
              ← Earn Tab
            </a>
            <a
              href="/business/idea"
              className="px-3 py-1.5 rounded-lg text-xs bg-slate-800/70 hover:bg-slate-700/70 text-slate-300 hover:text-white border border-slate-700 transition"
            >
              ↩ Evaluation
            </a>
            {storeBusinessId && (
              <a
                href={`/business/store/${storeBusinessId}`}
                className="px-3 py-1.5 rounded-lg text-xs bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 hover:text-white border border-emerald-600/40 transition"
              >
                🛍️ Your Store
              </a>
            )}
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Business Plan</h1>
              <p className="text-slate-400 mt-1">
                Build your complete business plan step by step.
              </p>
            </div>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition text-sm"
            >
              {saved ? "✓ Saved!" : "Save Plan"}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                activeTab === tab.key
                  ? "bg-purple-600 text-white"
                  : "bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6">
          {activeTab === "swot" && (
            <SWOTPanel data={swot} onChange={setSWOT} />
          )}
          {activeTab === "bmc" && (
            <BMCPanel data={bmc} onChange={setBMC} />
          )}
          {activeTab === "financials" && (
            <FinancialsPanel data={financials} onChange={setFinancials} />
          )}
        </div>

        {/* Bottom nav */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => {
              const idx = tabs.findIndex((t) => t.key === activeTab);
              if (idx > 0) setActiveTab(tabs[idx - 1].key);
            }}
            disabled={activeTab === tabs[0].key}
            className="px-4 py-2 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50 transition text-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <button
            onClick={() => {
              const idx = tabs.findIndex((t) => t.key === activeTab);
              if (idx < tabs.length - 1) setActiveTab(tabs[idx + 1].key);
              else handleSave();
            }}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition text-sm"
          >
            {activeTab === tabs[tabs.length - 1].key ? "Save Plan" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
