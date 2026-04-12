"use client";
// blocks/FundsBlock.tsx

import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  CollapsibleSection,
  AIGenerateButton,
  FallbackBanner,
  FieldLabel,
  TextInput,
  uid,
} from "@/components/self/shared";
import { useAIBlock } from "@/hooks/useAIBlock";
import type { GoalEntry } from "@/types/self";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FundType = "savings" | "income" | "investment" | "grant" | "loan";

export type FundSource = {
  id: string;
  name: string;
  type: FundType;
  amount: number;
  currency: string;
  linkedGoalIds: string[];
  notes: string;
};

export type FundsProfile = {
  sources: FundSource[];
  monthlyBurn: number;
  targetRunway: number;
  fundsPlan: AIFundsPlan | null;
};

export type AIFundsPlan = {
  savingsPlan: string;
  pitchGuidance: string;
  budgetAllocation: {
    goalId: string;
    goalName: string;
    amount: number;
    rationale: string;
  }[];
  fallback?: boolean;
};

// ─── Default ──────────────────────────────────────────────────────────────────

export function defaultFundsProfile(): FundsProfile {
  return { sources: [], monthlyBurn: 0, targetRunway: 6, fundsPlan: null };
}

// ─── Badge colors by type ─────────────────────────────────────────────────────

const TYPE_BADGE: Record<FundType, string> = {
  savings:    "text-green-400 bg-green-500/10 border border-green-500/30",
  income:     "text-blue-400 bg-blue-500/10 border border-blue-500/30",
  investment: "text-purple-400 bg-purple-500/10 border border-purple-500/30",
  grant:      "text-amber-400 bg-amber-500/10 border border-amber-500/30",
  loan:       "text-red-400 bg-red-500/10 border border-red-500/30",
};

const FUND_TYPES: FundType[] = ["savings", "income", "investment", "grant", "loan"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FundsSection({
  funds,
  goals,
  onChange,
}: {
  funds: FundsProfile;
  goals: GoalEntry[];
  onChange: (f: FundsProfile) => void;
}) {
  const [newName,     setNewName]     = useState("");
  const [newType,     setNewType]     = useState<FundType>("savings");
  const [newAmount,   setNewAmount]   = useState("");
  const [newCurrency, setNewCurrency] = useState("INR");
  const [hoveredId,   setHoveredId]   = useState<string | null>(null);

  const { loading, generate } = useAIBlock<AIFundsPlan>("/api/self/generate-funds-plan");

  const total   = funds.sources.reduce((a, s) => a + s.amount, 0);
  const runway  = funds.monthlyBurn > 0
    ? (total / funds.monthlyBurn).toFixed(1) + " mo"
    : "∞";

  function addSource() {
    const name = newName.trim();
    if (!name) return;
    const source: FundSource = {
      id:            uid(),
      name,
      type:          newType,
      amount:        parseFloat(newAmount) || 0,
      currency:      newCurrency || "INR",
      linkedGoalIds: [],
      notes:         "",
    };
    onChange({ ...funds, sources: [...funds.sources, source] });
    setNewName(""); setNewAmount(""); setNewCurrency("INR"); setNewType("savings");
  }

  function removeSource(id: string) {
    onChange({ ...funds, sources: funds.sources.filter(s => s.id !== id) });
  }

  function handleGenerate() {
    generate(
      {
        goals:       goals.map(g => ({ id: g.id, statement: g.statement })),
        sources:     funds.sources,
        monthlyBurn: funds.monthlyBurn,
      },
      (data) => onChange({ ...funds, fundsPlan: data }),
      () => ({
        savingsPlan:      "Review your spending and identify areas to cut.",
        pitchGuidance:    "Focus on traction metrics before approaching investors.",
        budgetAllocation: [],
        fallback:         true,
      })
    );
  }

  return (
    <CollapsibleSection
      title="Income & funds"
      defaultOpen={false}
    >
      <div className="space-y-4 pt-1">

        {/* Summary row */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Total</span>
            <span className="font-semibold text-white">{formatINR(total)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Monthly burn</span>
            <span className="font-semibold text-white">{formatINR(funds.monthlyBurn)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Runway</span>
            <span className="font-semibold text-white">{runway}</span>
          </div>
        </div>

        {/* Source list */}
        {funds.sources.length > 0 && (
          <div className="space-y-1.5">
            {funds.sources.map(src => (
              <div
                key={src.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800/60 border border-gray-700/50 group"
                onMouseEnter={() => setHoveredId(src.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-white truncate">{src.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full capitalize ${TYPE_BADGE[src.type]}`}>
                    {src.type}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm text-gray-300">{formatINR(src.amount)}</span>
                  <button
                    onClick={() => removeSource(src.id)}
                    className={`text-gray-600 hover:text-red-400 transition-opacity ${hoveredId === src.id ? "opacity-100" : "opacity-0"}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add source form */}
        <div className="border border-gray-700/50 rounded-lg p-3 space-y-2 bg-gray-800/30">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Add source</p>
          <div className="flex flex-wrap gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Source name"
              className="flex-1 min-w-[120px] bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
            <select
              value={newType}
              onChange={e => setNewType(e.target.value as FundType)}
              className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-gray-500"
            >
              {FUND_TYPES.map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
            <input
              type="number"
              value={newAmount}
              onChange={e => setNewAmount(e.target.value)}
              placeholder="Amount"
              className="w-28 bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
            <input
              value={newCurrency}
              onChange={e => setNewCurrency(e.target.value)}
              placeholder="Currency"
              className="w-20 bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
            <button
              onClick={addSource}
              className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm text-white transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {/* Monthly burn input */}
        <div className="space-y-1">
          <FieldLabel>Monthly burn (₹)</FieldLabel>
          <TextInput
            type="number"
            value={String(funds.monthlyBurn)}
            onChange={v => onChange({ ...funds, monthlyBurn: parseFloat(v) || 0 })}
            placeholder="0"
          />
        </div>

        {/* AI generate */}
        <AIGenerateButton
          loading={loading}
          hasResult={!!funds.fundsPlan}
          onGenerate={handleGenerate}
          labels={{ idle: "Generate funding plan", hasResult: "Regenerate plan", loading: "Generating…" }}
        />

        {/* Funds plan results */}
        {funds.fundsPlan && (
          <div className="space-y-4 mt-2">
            {funds.fundsPlan.fallback && <FallbackBanner />}

            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Savings plan</p>
              <p className="text-sm text-gray-300 leading-relaxed">{funds.fundsPlan.savingsPlan}</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pitch guidance</p>
              <p className="text-sm text-gray-300 leading-relaxed">{funds.fundsPlan.pitchGuidance}</p>
            </div>

            {funds.fundsPlan.budgetAllocation.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Budget allocation</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b border-gray-700">
                        <th className="text-left pb-2 pr-4">Goal</th>
                        <th className="text-right pb-2 pr-4">Amount</th>
                        <th className="text-left pb-2">Rationale</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {funds.fundsPlan.budgetAllocation.map((row, i) => (
                        <tr key={i}>
                          <td className="py-2 pr-4 text-gray-300 whitespace-nowrap">{row.goalName}</td>
                          <td className="py-2 pr-4 text-gray-300 text-right whitespace-nowrap">{formatINR(row.amount)}</td>
                          <td className="py-2 text-gray-400">{row.rationale}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </CollapsibleSection>
  );
}
