"use client";
// blocks/FundsBlock.tsx — Personal balance sheet & cash flow dashboard

import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  CollapsibleSection,
  AIGenerateButton,
  FallbackBanner,
  uid,
} from "@/components/self/shared";
import { useAIBlock } from "@/hooks/useAIBlock";
import type {
  GoalEntry, SkillEntry, PageItem, DriveType, FundsProfile,
  FundItem, FundGroup, FutureCost, IncomeOpportunity, AIFundsPlanV2,
} from "@/types/self";

// ─── Local alias matching spec interface name ─────────────────────────────────
type AIFundsPlan = AIFundsPlanV2;

// ─── Constants ────────────────────────────────────────────────────────────────

const TAG_CLS: Record<string, string> = {
  goal:  "text-purple-300 bg-purple-500/15 border-purple-500/30",
  biz:   "text-green-300  bg-green-500/15  border-green-500/30",
  gov:   "text-blue-300   bg-blue-500/15   border-blue-500/30",
  skill: "text-amber-300  bg-amber-500/15  border-amber-500/30",
};

const EFFORT_CLS: Record<string, string> = {
  easy:   "text-green-300  bg-green-500/15",
  medium: "text-amber-300  bg-amber-500/15",
  hard:   "text-red-300    bg-red-500/15",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(n: number): string {
  if (!isFinite(n) || isNaN(n)) return "∞";
  return "₹" + Math.abs(Math.round(n)).toLocaleString("en-IN");
}

function sumGroups(groups: FundGroup[]): number {
  return groups.reduce((a, g) => a + g.items.reduce((b, i) => b + (i.value || 0), 0), 0);
}

function computeMetrics(
  ig: FundGroup[], eg: FundGroup[], ag: FundGroup[], lg: FundGroup[], fc: FutureCost[],
) {
  const totalIncome      = sumGroups(ig);
  const totalExpenses    = sumGroups(eg);
  const totalAssets      = sumGroups(ag);
  const totalLiabilities = sumGroups(lg);
  const netMonthlyCash   = totalIncome - totalExpenses;
  const netWorth         = totalAssets - totalLiabilities;
  const runwayMonths     = totalExpenses > 0 ? netWorth / totalExpenses : Infinity;
  const savingsRate      = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
  const totalUpcomingCosts = fc.reduce((a, c) => a + (c.amount || 0), 0);

  const runwayScore    = Math.min(isFinite(runwayMonths) ? (runwayMonths / 12) * 100 : 100, 100);
  const savingsScore   = Math.min(savingsRate / 40 * 100, 100);
  const uniqueTypes    = new Set(ig.flatMap(g => g.items.filter(i => i.value > 0).map(i => i.tag ?? g.group)));
  const diversityScore = Math.min((uniqueTypes.size / 4) * 100, 100);
  const debtRatio      = totalAssets > 0 ? Math.max(0, 100 - (totalLiabilities / totalAssets) * 100) : 100;
  const independenceScore = Math.round(
    runwayScore * 0.35 + savingsScore * 0.25 + diversityScore * 0.20 + debtRatio * 0.20
  );

  return { totalIncome, totalExpenses, netMonthlyCash, totalAssets, totalLiabilities, netWorth, runwayMonths, savingsRate, totalUpcomingCosts, independenceScore };
}

// ─── Drive → income group ordering ───────────────────────────────────────────

function getIncomeGroupsForDrive(drive: DriveType): string[] {
  switch (drive) {
    case "building": return ["Business", "Freelance / consulting", "Goal income", "Passive", "Employment", "Support & grants", "Other"];
    case "learning":  return ["Freelance / consulting", "Support & grants", "Goal income", "Employment", "Passive", "Business", "Other"];
    case "doing":     return ["Employment", "Goal income", "Support & grants", "Business", "Freelance / consulting", "Passive", "Other"];
    case "helping":   return ["Employment", "Freelance / consulting", "Goal income", "Support & grants", "Business", "Passive", "Other"];
  }
}

// ─── Drive → static fallback opportunities ────────────────────────────────────

function getDriveFallbackOpportunities(drive: DriveType, skills: SkillEntry[]): IncomeOpportunity[] {
  const s = skills.find(sk => sk.name.trim())?.name ?? "your top skill";
  switch (drive) {
    case "building": return [
      { title: `Freelance on ${s}`, rationale: "Your builder drive means you ship fast — clients pay for speed and reliability.", effort: "easy", linkedSkill: s },
      { title: "Launch a digital product", rationale: "One-time build, recurring revenue — the builder's best leverage.", effort: "medium" },
      { title: "Pitch for seed / angel funding", rationale: "Vaishya energy: put a number on your idea and put it in front of investors.", effort: "hard" },
    ];
    case "learning": return [
      { title: `Teach or tutor ${s}`, rationale: "Brahmin energy turns expertise into income — students pay for clarity.", effort: "easy", linkedSkill: s },
      { title: "Write and publish (blog / ebook)", rationale: "Your learning creates knowledge assets that compound over time.", effort: "medium" },
      { title: "Apply for a research grant or scholarship", rationale: "Institutional backing matches the Brahmin path — pursue it.", effort: "hard" },
    ];
    case "doing": return [
      { title: `Contract work on ${s}`, rationale: "Execution-focused work builds your track record and income fast.", effort: "easy", linkedSkill: s },
      { title: "Apply for a government scheme", rationale: "Kshatriya energy aligns with structured systems — use state schemes strategically.", effort: "medium" },
      { title: "Lead a community project", rationale: "Leadership through a project compounds reputation into recurring income.", effort: "medium" },
    ];
    case "helping": return [
      { title: `Offer local ${s} service`, rationale: "Direct service, direct pay — no middleman, immediate cashflow.", effort: "easy", linkedSkill: s },
      { title: "Join a cooperative or collective", rationale: "Shared income model fits the helper drive — collective leverage.", effort: "medium" },
      { title: "List on a craft or skill marketplace", rationale: "Your craft already has buyers — list it where they look.", effort: "easy" },
    ];
  }
}

// ─── Initial data builders ────────────────────────────────────────────────────

function buildInitialIncomeGroups(goals: GoalEntry[], skills: SkillEntry[], pages: PageItem[]): FundGroup[] {
  return [
    {
      group: "Employment",
      items: [
        { id: "emp-salary", label: "Salary / wages", value: 0 },
        { id: "emp-ptjob",  label: "Part-time job",  value: 0 },
      ],
    },
    {
      group: "Business",
      items: [
        ...pages.map(p => ({ id: uid(), label: `${p.title} income`, value: 0, tag: "biz" as const, sourceId: `biz-income-${p.id}` })),
        { id: "biz-freelance", label: "Freelance / consulting", value: 0 },
        { id: "biz-agency",    label: "Agency / services",      value: 0 },
      ],
    },
    {
      group: "Freelance / consulting",
      items: skills.filter(s => s.name.trim()).map(s => ({
        id: uid(), label: `${s.name} freelance`, value: 0, tag: "skill" as const, sourceId: `skill-income-${s.id}`,
      })),
    },
    {
      group: "Goal income",
      items: goals.filter(g => g.statement).map(g => ({
        id: uid(), label: g.statement.slice(0, 40), value: 0, tag: "goal" as const, sourceId: `goal-income-${g.id}`,
      })),
    },
    {
      group: "Passive",
      items: [
        { id: "pass-rental", label: "Rental income",        value: 0 },
        { id: "pass-fd",     label: "Interest / FD returns", value: 0 },
        { id: "pass-div",    label: "Dividend / stocks",    value: 0 },
      ],
    },
    {
      group: "Support & grants",
      items: [
        { id: "supp-fam",     label: "Family support",           value: 0 },
        { id: "supp-indiaai", label: "IndiaAI Mission grant",    value: 0, tag: "gov" as const },
        { id: "supp-startup", label: "PM Startup India seed",    value: 0, tag: "gov" as const },
        { id: "supp-scholar", label: "Scholarship / fellowship", value: 0, tag: "gov" as const },
        { id: "supp-ngo",     label: "NGO / CSR funding",        value: 0, tag: "gov" as const },
      ],
    },
    { group: "Other", items: [], custom: true },
  ];
}

function buildInitialExpenseGroups(goals: GoalEntry[], skills: SkillEntry[], pages: PageItem[]): FundGroup[] {
  const hasHealthGoal = goals.some(g =>
    g.statement.toLowerCase().includes("health") ||
    g.statement.toLowerCase().includes("fit") ||
    g.statement.toLowerCase().includes("gym")
  );
  return [
    {
      group: "Housing",
      items: [
        { id: "hous-rent",  label: "Rent",               value: 0 },
        { id: "hous-elec",  label: "Electricity & water", value: 0 },
        { id: "hous-net",   label: "Internet & phone",    value: 0 },
        { id: "hous-maint", label: "Home maintenance",    value: 0 },
      ],
    },
    {
      group: "Living",
      items: [
        { id: "liv-food",  label: "Food & groceries",    value: 0 },
        { id: "liv-cloth", label: "Clothing & footwear", value: 0 },
        { id: "liv-care",  label: "Personal care",       value: 0 },
        { id: "liv-hhold", label: "Household supplies",  value: 0 },
      ],
    },
    {
      group: "Transport",
      items: [
        { id: "tr-commute", label: "Daily commute / fuel", value: 0 },
        { id: "tr-cab",     label: "Auto / cab rides",     value: 0 },
      ],
    },
    {
      group: "Health",
      items: [
        { id: "hlth-ins", label: "Insurance premium",  value: 0 },
        { id: "hlth-doc", label: "Doctor / medicines", value: 0 },
        { id: "hlth-gym", label: "Gym / fitness",      value: 0, ...(hasHealthGoal ? { tag: "goal" as const } : {}) },
      ],
    },
    {
      group: "Education & projects",
      items: [
        ...skills.filter(s => s.name.trim() && s.level === "Beginner").map(s => ({
          id: uid(), label: `${s.name} course / tools`, value: 0, tag: "skill" as const, sourceId: `skill-edu-${s.id}`,
        })),
        ...goals.filter(g => g.statement).map(g => ({
          id: uid(), label: `${g.statement.slice(0, 30)} costs`, value: 0, tag: "goal" as const, sourceId: `goal-cost-${g.id}`,
        })),
        { id: "edu-books", label: "Books & subscriptions", value: 0 },
      ],
    },
    {
      group: "Lifestyle",
      items: [
        { id: "life-ott",    label: "Entertainment / OTT", value: 0 },
        { id: "life-eatout", label: "Eating out",          value: 0 },
        { id: "life-travel", label: "Travel",              value: 0 },
        { id: "life-fest",   label: "Festivals / gifting", value: 0 },
      ],
    },
    {
      group: "Financial",
      items: [
        { id: "fin-loan", label: "Loan EMI",            value: 0 },
        { id: "fin-save", label: "Savings transfer",    value: 0 },
        { id: "fin-sip",  label: "SIP / investment",    value: 0 },
        { id: "fin-cc",   label: "Credit card payment", value: 0 },
      ],
    },
    ...(pages.length > 0 ? [{
      group: "Project investment",
      items: pages.map(p => ({
        id: uid(), label: `${p.title} costs`, value: 0, tag: "biz" as const, sourceId: `biz-cost-${p.id}`,
      })),
    }] : []),
    { group: "Other", items: [], custom: true },
  ];
}

function buildInitialAssetGroups(pages: PageItem[]): FundGroup[] {
  return [
    {
      group: "Cash & savings",
      items: [
        { id: "cash-bank", label: "Savings account", value: 0 },
        { id: "cash-hand", label: "Cash in hand",    value: 0 },
        { id: "cash-fd",   label: "Fixed deposit",   value: 0 },
      ],
    },
    {
      group: "Retirement",
      items: [
        { id: "ret-pf",  label: "Provident fund (PF)",   value: 0 },
        { id: "ret-lic", label: "LIC / insurance value", value: 0 },
        { id: "ret-ppf", label: "PPF / NPS",             value: 0 },
      ],
    },
    {
      group: "Investments",
      items: [
        { id: "inv-stocks", label: "Stocks / mutual funds", value: 0 },
        { id: "inv-crypto", label: "Crypto / digital",      value: 0 },
        { id: "inv-gold",   label: "Gold / jewellery",      value: 0 },
      ],
    },
    {
      group: "Physical",
      items: [
        { id: "phys-lap",  label: "Laptop / equipment", value: 0 },
        { id: "phys-veh",  label: "Vehicle",            value: 0 },
        { id: "phys-prop", label: "Property / land",    value: 0 },
      ],
    },
    ...(pages.length > 0 ? [{
      group: "Business equity",
      items: pages.map(p => ({
        id: uid(), label: `${p.title} equity`, value: 0, tag: "biz" as const, sourceId: `biz-equity-${p.id}`,
      })),
    }] : []),
    { group: "Other", items: [], custom: true },
  ];
}

function buildInitialLiabGroups(pages: PageItem[]): FundGroup[] {
  return [
    {
      group: "Loans",
      items: [
        { id: "loan-stu",  label: "Student loan",  value: 0 },
        { id: "loan-home", label: "Home loan",     value: 0 },
        { id: "loan-veh",  label: "Vehicle loan",  value: 0 },
        { id: "loan-pers", label: "Personal loan", value: 0 },
      ],
    },
    {
      group: "Short-term",
      items: [
        { id: "st-cc",       label: "Credit card balance",    value: 0 },
        { id: "st-bnpl",     label: "Buy-now-pay-later",      value: 0 },
        { id: "st-informal", label: "Family / informal loan", value: 0 },
      ],
    },
    {
      group: "Business",
      items: [
        ...pages.map(p => ({
          id: uid(), label: `${p.title} payables`, value: 0, tag: "biz" as const, sourceId: `biz-payable-${p.id}`,
        })),
        { id: "biz-vendor", label: "Vendor payables", value: 0 },
      ],
    },
    { group: "Other", items: [], custom: true },
  ];
}

function buildInitialFutureCosts(): FutureCost[] {
  return [
    { id: uid(), label: "Health checkup",        when: "Monthly",  amount: 500   },
    { id: uid(), label: "Phone / laptop upgrade", when: "6 months", amount: 15000 },
    { id: uid(), label: "Festival / Durga Puja",  when: "Oct 2026", amount: 8000  },
    { id: uid(), label: "Insurance renewal",       when: "Annual",   amount: 6000  },
    { id: uid(), label: "Tech course",             when: "3 months", amount: 5000  },
    { id: uid(), label: "Emergency buffer",        when: "Ongoing",  amount: 18000 },
  ];
}

// ─── Merge helper — add new derived items to existing saved groups ─────────────

function mergeIntoGroups(
  groups: FundGroup[],
  newItems: { group: string; item: FundItem }[],
): FundGroup[] {
  const savedSourceIds = new Set(groups.flatMap(g => g.items.map(i => i.sourceId).filter(Boolean)));
  if (newItems.every(({ item }) => !item.sourceId || savedSourceIds.has(item.sourceId))) return groups;

  const result = groups.map(g => ({ ...g, items: [...g.items] }));
  for (const { group, item } of newItems) {
    if (item.sourceId && savedSourceIds.has(item.sourceId)) continue;
    const gIdx = result.findIndex(g => g.group === group);
    if (gIdx >= 0) result[gIdx].items.push(item);
  }
  return result;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TagBadge({ tag }: { tag?: string }) {
  if (!tag || !TAG_CLS[tag]) return null;
  return (
    <span className={`shrink-0 px-1 py-px rounded text-[9px] border ${TAG_CLS[tag]}`}>
      {tag}
    </span>
  );
}

function MetricPill({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-px">
      <span className="text-gray-600 uppercase tracking-wider" style={{ fontSize: "9px" }}>{label}</span>
      <span className={`text-xs font-semibold tabular-nums ${highlight ? "text-amber-300" : "text-gray-300"}`}>{value}</span>
    </div>
  );
}

function AddItemRow({ onAdd }: { onAdd: (label: string) => void }) {
  const [val, setVal] = useState("");
  function commit() {
    if (!val.trim()) return;
    onAdd(val.trim());
    setVal("");
  }
  return (
    <div className="flex gap-1 mt-1">
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") commit(); }}
        placeholder="Add item…"
        className="flex-1 min-w-0 bg-gray-950 border border-gray-700/40 rounded px-1.5 py-0.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60"
      />
      <button
        type="button"
        onClick={commit}
        className="px-1.5 py-0.5 rounded bg-gray-700/60 hover:bg-gray-600 text-xs text-gray-300"
      >
        <Plus size={10} />
      </button>
    </div>
  );
}

function GroupColumn({
  headerLabel,
  headerCls,
  groups,
  total,
  onItemChange,
  onItemAdd,
  onItemRemove,
}: {
  headerLabel: string;
  headerCls: string;
  groups: FundGroup[];
  total: number;
  onItemChange: (groupName: string, itemIdx: number, value: number) => void;
  onItemAdd: (groupName: string, label: string) => void;
  onItemRemove: (groupName: string, itemIdx: number) => void;
}) {
  const visible = groups.filter(g => g.items.length > 0 || g.custom);
  return (
    <div className="space-y-2 min-w-0">
      <div className={`text-[10px] font-bold uppercase tracking-widest ${headerCls}`}>{headerLabel}</div>
      {visible.map(g => (
        <div key={g.group}>
          <div className="text-[9px] font-semibold text-gray-600 uppercase tracking-widest px-0.5 mb-0.5">{g.group}</div>
          {g.items.map((item, ii) => (
            <div key={item.id} className="group flex items-center gap-1 py-px">
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <span className="text-[11px] text-gray-300 truncate leading-tight">{item.label}</span>
                <TagBadge tag={item.tag} />
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <input
                  type="number"
                  value={item.value || ""}
                  onChange={e => onItemChange(g.group, ii, parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-16 text-right bg-gray-900 border border-gray-700/40 rounded px-1 py-px text-[11px] text-white focus:outline-none focus:border-indigo-500/60"
                />
                <button
                  type="button"
                  onClick={() => onItemRemove(g.group, ii)}
                  className="opacity-0 group-hover:opacity-100 text-gray-700 hover:text-red-400 transition-opacity"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          ))}
          {g.custom && <AddItemRow onAdd={label => onItemAdd(g.group, label)} />}
        </div>
      ))}
      <div className="border-t border-gray-800/80 pt-1 flex justify-between">
        <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Total</span>
        <span className="text-[11px] font-bold text-white tabular-nums">{formatINR(total)}</span>
      </div>
    </div>
  );
}

function FutureCostsTable({
  costs,
  onSet,
}: {
  costs: FutureCost[];
  onSet: (c: FutureCost[]) => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newWhen,  setNewWhen]  = useState("");
  const [newAmt,   setNewAmt]   = useState("");

  function addCost() {
    if (!newLabel.trim()) return;
    onSet([...costs, { id: uid(), label: newLabel.trim(), when: newWhen.trim(), amount: parseFloat(newAmt) || 0 }]);
    setNewLabel(""); setNewWhen(""); setNewAmt("");
  }

  const total = costs.reduce((a, c) => a + (c.amount || 0), 0);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full" style={{ fontSize: "11px" }}>
          <thead>
            <tr className="text-gray-600 border-b border-gray-800">
              <th className="text-left py-1 pr-2 font-medium uppercase tracking-wider">Item</th>
              <th className="text-left py-1 pr-2 font-medium uppercase tracking-wider">When</th>
              <th className="text-right py-1 font-medium uppercase tracking-wider">Est. cost</th>
              <th className="w-5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {costs.map((c, idx) => (
              <tr key={c.id} className="group">
                <td className="py-1 pr-2 text-gray-300">{c.label}</td>
                <td className="py-1 pr-2 text-gray-500">{c.when}</td>
                <td className="py-1 text-right text-gray-300 tabular-nums">{formatINR(c.amount)}</td>
                <td className="py-1 pl-1">
                  <button
                    type="button"
                    onClick={() => onSet(costs.filter((_, i) => i !== idx))}
                    className="opacity-0 group-hover:opacity-100 text-gray-700 hover:text-red-400 transition-opacity"
                  >
                    <Trash2 size={10} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-1">
        <input value={newLabel} onChange={e => setNewLabel(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addCost(); }}
          placeholder="Item" className="flex-1 min-w-0 bg-gray-900 border border-gray-700/40 rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60" />
        <input value={newWhen} onChange={e => setNewWhen(e.target.value)}
          placeholder="When" className="w-20 bg-gray-900 border border-gray-700/40 rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60" />
        <input type="number" value={newAmt} onChange={e => setNewAmt(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addCost(); }}
          placeholder="₹" className="w-16 bg-gray-900 border border-gray-700/40 rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60" />
        <button type="button" onClick={addCost}
          className="px-2 py-1 bg-gray-700/60 hover:bg-gray-600 rounded text-xs text-gray-300">
          <Plus size={12} />
        </button>
      </div>
      <div className="flex justify-between text-xs border-t border-gray-800/60 pt-1">
        <span className="text-gray-500">Total upcoming</span>
        <span className="font-semibold text-white tabular-nums">{formatINR(total)}</span>
      </div>
    </div>
  );
}

function OpportunityCard({ opp }: { opp: IncomeOpportunity }) {
  return (
    <div className="p-3 rounded-xl bg-gray-800/50 border border-gray-700/40 space-y-1.5">
      <div className="flex items-start gap-2">
        <span className="flex-1 text-sm font-medium text-white leading-snug">{opp.title}</span>
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${EFFORT_CLS[opp.effort] ?? ""}`}>
          {opp.effort}
        </span>
      </div>
      <p className="text-xs text-gray-400 leading-relaxed">{opp.rationale}</p>
      {(opp.linkedSkill || opp.linkedGoal) && (
        <div className="flex gap-1.5">
          {opp.linkedSkill && <span className={`px-1.5 py-0.5 rounded text-[10px] border ${TAG_CLS.skill}`}>{opp.linkedSkill}</span>}
          {opp.linkedGoal  && <span className={`px-1.5 py-0.5 rounded text-[10px] border ${TAG_CLS.goal}`}>{opp.linkedGoal}</span>}
        </div>
      )}
    </div>
  );
}

// ─── FundsSection ─────────────────────────────────────────────────────────────

export function FundsSection({
  funds,
  goals,
  generalSkills,
  pages,
  drives,
  onChange,
}: {
  funds: FundsProfile;
  goals: GoalEntry[];
  generalSkills: SkillEntry[];
  pages: PageItem[];
  drives: DriveType[];
  onChange: (f: FundsProfile) => void;
}) {
  const drive = drives[0] ?? "building";

  // ── State — init from saved data or build fresh ──────────────────────────────
  const [incomeGroups,  setIncomeGroups]  = useState<FundGroup[]>(() =>
    funds.incomeGroups?.length  ? funds.incomeGroups  : buildInitialIncomeGroups(goals, generalSkills, pages));
  const [expenseGroups, setExpenseGroups] = useState<FundGroup[]>(() =>
    funds.expenseGroups?.length ? funds.expenseGroups : buildInitialExpenseGroups(goals, generalSkills, pages));
  const [assetGroups,   setAssetGroups]   = useState<FundGroup[]>(() =>
    funds.assetGroups?.length   ? funds.assetGroups   : buildInitialAssetGroups(pages));
  const [liabGroups,    setLiabGroups]    = useState<FundGroup[]>(() =>
    funds.liabGroups?.length    ? funds.liabGroups    : buildInitialLiabGroups(pages));
  const [futureCosts,   setFutureCosts]   = useState<FutureCost[]>(() =>
    funds.futureCosts?.length   ? funds.futureCosts   : buildInitialFutureCosts());
  const [fundsPlanV2,   setFundsPlanV2]   = useState<AIFundsPlan | null>(funds.fundsPlanV2 ?? null);

  // ── Merge newly added goals/skills/pages into existing saved state ────────────
  useEffect(() => {
    if (!funds.incomeGroups?.length) return;
    const newIncome: { group: string; item: FundItem }[] = [
      ...goals.filter(g => g.statement).map(g => ({ group: "Goal income", item: { id: uid(), label: g.statement.slice(0, 40), value: 0, tag: "goal" as const, sourceId: `goal-income-${g.id}` } })),
      ...generalSkills.filter(s => s.name.trim()).map(s => ({ group: "Freelance / consulting", item: { id: uid(), label: `${s.name} freelance`, value: 0, tag: "skill" as const, sourceId: `skill-income-${s.id}` } })),
      ...pages.map(p => ({ group: "Business", item: { id: uid(), label: `${p.title} income`, value: 0, tag: "biz" as const, sourceId: `biz-income-${p.id}` } })),
    ];
    const merged = mergeIntoGroups(incomeGroups, newIncome);
    if (merged !== incomeGroups) setIncomeGroups(merged);

    const newExpense: { group: string; item: FundItem }[] = [
      ...goals.filter(g => g.statement).map(g => ({ group: "Education & projects", item: { id: uid(), label: `${g.statement.slice(0, 30)} costs`, value: 0, tag: "goal" as const, sourceId: `goal-cost-${g.id}` } })),
      ...generalSkills.filter(s => s.name.trim() && s.level === "Beginner").map(s => ({ group: "Education & projects", item: { id: uid(), label: `${s.name} course / tools`, value: 0, tag: "skill" as const, sourceId: `skill-edu-${s.id}` } })),
    ];
    const mergedExp = mergeIntoGroups(expenseGroups, newExpense);
    if (mergedExp !== expenseGroups) setExpenseGroups(mergedExp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist helper ────────────────────────────────────────────────────────────
  function saveAll(patch: {
    ig?: FundGroup[]; eg?: FundGroup[]; ag?: FundGroup[]; lg?: FundGroup[];
    fc?: FutureCost[]; plan?: AIFundsPlan | null;
  } = {}) {
    const ig = patch.ig ?? incomeGroups;
    const eg = patch.eg ?? expenseGroups;
    const ag = patch.ag ?? assetGroups;
    const lg = patch.lg ?? liabGroups;
    const fc = patch.fc ?? futureCosts;
    const totalIncome   = sumGroups(ig);
    const totalExpenses = sumGroups(eg);
    onChange({
      ...funds,
      incomeGroups:  ig,
      expenseGroups: eg,
      assetGroups:   ag,
      liabGroups:    lg,
      futureCosts:   fc,
      fundsPlanV2:   patch.plan !== undefined ? patch.plan : fundsPlanV2,
      // Legacy compat — keeps EnergyBlock working
      sources: totalIncome > 0
        ? [{ id: "bs-income", name: "Total income", type: "income" as const, amount: totalIncome, currency: "INR", linkedGoalIds: [], notes: "" }]
        : [],
      monthlyBurn: totalExpenses,
    });
  }

  // ── Group mutation factories ───────────────────────────────────────────────────
  function makeHandlers(
    groups: FundGroup[],
    setter: React.Dispatch<React.SetStateAction<FundGroup[]>>,
    patchKey: "ig" | "eg" | "ag" | "lg",
  ) {
    function onChange(groupName: string, ii: number, value: number) {
      const next = groups.map(g =>
        g.group !== groupName ? g : { ...g, items: g.items.map((item, j) => j !== ii ? item : { ...item, value }) }
      );
      setter(next);
      saveAll({ [patchKey]: next });
    }
    function onAdd(groupName: string, label: string) {
      const next = groups.map(g =>
        g.group !== groupName ? g : { ...g, items: [...g.items, { id: uid(), label, value: 0 }] }
      );
      setter(next);
      saveAll({ [patchKey]: next });
    }
    function onRemove(groupName: string, ii: number) {
      const next = groups.map(g =>
        g.group !== groupName ? g : { ...g, items: g.items.filter((_, j) => j !== ii) }
      );
      setter(next);
      saveAll({ [patchKey]: next });
    }
    return { onChange, onAdd, onRemove };
  }

  const incomeH  = makeHandlers(incomeGroups,  setIncomeGroups,  "ig");
  const expenseH = makeHandlers(expenseGroups, setExpenseGroups, "eg");
  const assetH   = makeHandlers(assetGroups,   setAssetGroups,   "ag");
  const liabH    = makeHandlers(liabGroups,    setLiabGroups,    "lg");

  // ── Metrics ───────────────────────────────────────────────────────────────────
  const metrics = useMemo(
    () => computeMetrics(incomeGroups, expenseGroups, assetGroups, liabGroups, futureCosts),
    [incomeGroups, expenseGroups, assetGroups, liabGroups, futureCosts],
  );
  const { totalIncome, totalExpenses, netMonthlyCash, totalAssets, totalLiabilities, netWorth, runwayMonths, savingsRate, independenceScore } = metrics;
  const runwayLabel   = isFinite(runwayMonths) ? `${runwayMonths.toFixed(1)}mo` : "∞";
  const cashPositive  = netMonthlyCash >= 0;
  const worthPositive = netWorth >= 0;

  // ── Drive-ordered income groups ────────────────────────────────────────────────
  const driveOrder = getIncomeGroupsForDrive(drive);
  const sortedIncomeGroups = useMemo(() => {
    return [...incomeGroups].sort((a, b) => {
      const ai = driveOrder.indexOf(a.group);
      const bi = driveOrder.indexOf(b.group);
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    });
  }, [incomeGroups, driveOrder]);

  // ── AI generation ─────────────────────────────────────────────────────────────
  const { loading, generate } = useAIBlock<AIFundsPlan>("/api/self/generate-funds-plan");

  function handleGenerate() {
    generate(
      {
        drive,
        goals:       goals.map(g => ({ id: g.id, title: g.statement, category: g.driveId })),
        skills:      generalSkills.filter(s => s.name).map(s => ({ id: s.id, name: s.name, level: s.level })),
        businesses:  pages.map(p => ({ id: p.id, name: p.title, stage: "active" })),
        totalIncome,
        totalExpenses,
        netWorth,
        runwayMonths: isFinite(runwayMonths) ? runwayMonths : 999,
      },
      (data) => {
        setFundsPlanV2(data);
        saveAll({ plan: data });
      },
      () => ({
        suggestions: [],
        incomeOpportunities: getDriveFallbackOpportunities(drive, generalSkills),
        fallback: true,
      }),
    );
  }

  // ── Collapsed preview (summary bar) ───────────────────────────────────────────
  const collapsedPreview = (
    <div className="flex flex-wrap gap-3 mt-1.5">
      <MetricPill label="Net worth" value={formatINR(netWorth)} />
      <MetricPill label="Income"    value={formatINR(totalIncome)} />
      <MetricPill label="Burn"      value={formatINR(totalExpenses)} />
      <MetricPill label="Runway"    value={runwayLabel} />
      <MetricPill label="Score"     value={`${independenceScore}`} highlight />
    </div>
  );

  return (
    <CollapsibleSection
      title="Funds & Independence"
      subtitle="Balance sheet · Cash flow · Independence score"
      defaultOpen={false}
      collapsedPreview={collapsedPreview}
    >
      <div className="space-y-6 pt-1">

        {/* ── Section 1: Monthly cash flow ── */}
        <section>
          <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Monthly cash flow</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <GroupColumn
              headerLabel="Income ↑"
              headerCls="text-green-400"
              groups={sortedIncomeGroups}
              total={totalIncome}
              onItemChange={incomeH.onChange}
              onItemAdd={incomeH.onAdd}
              onItemRemove={incomeH.onRemove}
            />
            <GroupColumn
              headerLabel="Expenses ↓"
              headerCls="text-red-400"
              groups={expenseGroups}
              total={totalExpenses}
              onItemChange={expenseH.onChange}
              onItemAdd={expenseH.onAdd}
              onItemRemove={expenseH.onRemove}
            />
          </div>

          {/* Net monthly */}
          <div className="mt-3 flex items-center justify-between border-t border-gray-800/70 pt-2">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Net monthly</span>
            <span className={`text-sm font-bold tabular-nums ${cashPositive ? "text-green-400" : "text-red-400"}`}>
              {cashPositive ? "+" : "−"}{formatINR(Math.abs(netMonthlyCash))}
            </span>
          </div>

          {/* Proportional bar */}
          {(totalIncome + totalExpenses) > 0 && (
            <div className="h-1 rounded-full overflow-hidden mt-1.5" style={{ background: "rgba(239,68,68,0.2)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(totalIncome / (totalIncome + totalExpenses)) * 100}%`,
                  background: "rgba(34,197,94,0.5)",
                }}
              />
            </div>
          )}
        </section>

        {/* ── Section 2: Balance sheet ── */}
        <section>
          <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Balance sheet</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <GroupColumn
              headerLabel="Assets ↑"
              headerCls="text-blue-400"
              groups={assetGroups}
              total={totalAssets}
              onItemChange={assetH.onChange}
              onItemAdd={assetH.onAdd}
              onItemRemove={assetH.onRemove}
            />
            <GroupColumn
              headerLabel="Liabilities ↓"
              headerCls="text-orange-400"
              groups={liabGroups}
              total={totalLiabilities}
              onItemChange={liabH.onChange}
              onItemAdd={liabH.onAdd}
              onItemRemove={liabH.onRemove}
            />
          </div>

          {/* Net worth */}
          <div className="mt-3 flex items-center justify-between border-t border-gray-800/70 pt-2">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Net worth</span>
            <span className={`text-sm font-bold tabular-nums ${worthPositive ? "text-blue-400" : "text-red-400"}`}>
              {worthPositive ? "" : "−"}{formatINR(Math.abs(netWorth))}
            </span>
          </div>
        </section>

        {/* ── Section 3: Upcoming costs ── */}
        <section>
          <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Upcoming costs</h4>
          <FutureCostsTable
            costs={futureCosts}
            onSet={next => { setFutureCosts(next); saveAll({ fc: next }); }}
          />
        </section>

        {/* ── Section 4: Income opportunities ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Income opportunities</h4>
            <AIGenerateButton
              loading={loading}
              hasResult={!!fundsPlanV2 && !fundsPlanV2.fallback}
              onGenerate={handleGenerate}
              labels={{ generate: "Generate", regenerate: "↺ Refresh", loading: "Generating…" }}
            />
          </div>
          {fundsPlanV2?.fallback && <FallbackBanner />}
          {(fundsPlanV2?.incomeOpportunities?.length ?? 0) > 0 ? (
            <div className="space-y-2">
              {fundsPlanV2!.incomeOpportunities.map((opp, i) => (
                <OpportunityCard key={i} opp={opp} />
              ))}
              {fundsPlanV2!.savingsPlan && (
                <div className="mt-2 p-3 rounded-xl bg-gray-800/40 border border-gray-700/40">
                  <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Savings plan</p>
                  <p className="text-xs text-gray-300 leading-relaxed">{fundsPlanV2!.savingsPlan}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {getDriveFallbackOpportunities(drive, generalSkills).map((opp, i) => (
                <OpportunityCard key={i} opp={opp} />
              ))}
            </div>
          )}
        </section>

        {/* ── Section 5: Summary stats ── */}
        <section className="border-t border-gray-800/70 pt-4">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
            {[
              { label: "Savings rate",   value: `${Math.round(Math.max(0, savingsRate))}%` },
              { label: "Runway",         value: runwayLabel },
              { label: "Independence",   value: `${independenceScore}/100` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-gray-800/40 border border-gray-700/30 px-2.5 py-2 text-center">
                <div className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</div>
                <div className="text-sm font-bold text-white tabular-nums mt-0.5">{value}</div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </CollapsibleSection>
  );
}
