"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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

type DocType = "SWOT" | "BMC" | "FINANCIALS" | "COMPETITOR";

const DOC_TYPES: { key: DocType; label: string; icon: string; comingSoon?: boolean }[] = [
  { key: "SWOT", label: "SWOT Analysis", icon: "🎯" },
  { key: "BMC", label: "Business Model Canvas", icon: "🗂️" },
  { key: "FINANCIALS", label: "3-Year Financials", icon: "📈" },
  { key: "COMPETITOR", label: "Competitor Study", icon: "🔍", comingSoon: true },
];

/* -------------------- Helpers -------------------- */

const emptyYear = (): YearFinancials => ({
  revenue: "",
  cogs: "",
  operatingCosts: "",
  marketingCosts: "",
  otherCosts: "",
});

const emptySWOT = (): SWOTData => ({
  strengths: "",
  weaknesses: "",
  opportunities: "",
  threats: "",
});

const emptyBMC = (): BMCData => ({
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

const emptyFinancials = (): FinancialPlan => ({
  year1: emptyYear(),
  year2: emptyYear(),
  year3: emptyYear(),
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

function SWOTPanel({ data, onChange }: { data: SWOTData; onChange: (d: SWOTData) => void }) {
  const set = (key: keyof SWOTData) => (v: string) => onChange({ ...data, [key]: v });

  const quadrants: { key: keyof SWOTData; label: string; color: string; placeholder: string }[] = [
    { key: "strengths", label: "Strengths", color: "border-green-500/50 bg-green-500/5", placeholder: "What do you do well? Unique skills, resources, competitive advantages..." },
    { key: "weaknesses", label: "Weaknesses", color: "border-red-500/50 bg-red-500/5", placeholder: "Where do you lack? Gaps in skills, resources, processes..." },
    { key: "opportunities", label: "Opportunities", color: "border-blue-500/50 bg-blue-500/5", placeholder: "Market trends, unmet needs, regulatory changes that help you..." },
    { key: "threats", label: "Threats", color: "border-yellow-500/50 bg-yellow-500/5", placeholder: "Competition, market risks, economic factors, regulatory challenges..." },
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
            <TextArea label={q.label} value={data[q.key]} onChange={set(q.key)} placeholder={q.placeholder} rows={5} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------- BMC Panel -------------------- */

function BMCPanel({ data, onChange }: { data: BMCData; onChange: (d: BMCData) => void }) {
  const set = (key: keyof BMCData) => (v: string) => onChange({ ...data, [key]: v });

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">Business Model Canvas</h2>
      <p className="text-slate-400 text-sm mb-6">
        Define the 9 building blocks of your business model.
      </p>

      {/* Row 1: Key Partners | Key Activities | Value Propositions | Customer Relationships | Customer Segments */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700">
          <TextArea label="Key Partners" value={data.keyPartners} onChange={set("keyPartners")} placeholder="Who are your key suppliers and partners?" rows={6} />
        </div>
        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700">
          <TextArea label="Key Activities" value={data.keyActivities} onChange={set("keyActivities")} placeholder="What key activities does your value proposition require?" rows={6} />
        </div>
        <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/50 md:row-span-2">
          <TextArea label="Value Propositions" value={data.valuePropositions} onChange={set("valuePropositions")} placeholder="What value do you deliver? What problem do you solve?" rows={13} />
        </div>
        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700">
          <TextArea label="Customer Relationships" value={data.customerRelationships} onChange={set("customerRelationships")} placeholder="How do you acquire, retain, and grow customers?" rows={6} />
        </div>
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/50 md:row-span-2">
          <TextArea label="Customer Segments" value={data.customerSegments} onChange={set("customerSegments")} placeholder="Who are you creating value for? Who are your most important customers?" rows={13} />
        </div>
      </div>

      {/* Row 2: Key Resources | (VP spans) | Channels | (CS spans) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700">
          <TextArea label="Key Resources" value={data.keyResources} onChange={set("keyResources")} placeholder="Physical, intellectual, human, and financial resources..." rows={5} />
        </div>
        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700">
          {/* spacer — empty so VP and CS columns from row 1 span into this row */}
        </div>
        {/* col 3 and 5 are occupied by row-span-2 cells above */}
        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700">
          <TextArea label="Channels" value={data.channels} onChange={set("channels")} placeholder="How do you reach your customer segments?" rows={5} />
        </div>
        <div className="hidden md:block" /> {/* CS span placeholder */}
      </div>

      {/* Row 3: Cost Structure | Revenue Streams */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/30">
          <TextArea label="Cost Structure" value={data.costStructure} onChange={set("costStructure")} placeholder="What are the most important costs? Fixed vs variable costs..." rows={4} />
        </div>
        <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/30">
          <TextArea label="Revenue Streams" value={data.revenueStreams} onChange={set("revenueStreams")} placeholder="How does your business earn revenue? Pricing model, one-time vs recurring..." rows={4} />
        </div>
      </div>
    </div>
  );
}

/* -------------------- Financials Panel -------------------- */

function FinancialsPanel({ data, onChange }: { data: FinancialPlan; onChange: (d: FinancialPlan) => void }) {
  const setYear = (year: keyof FinancialPlan) => (key: keyof YearFinancials) => (v: string) =>
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
          const profitColor = profit > 0 ? "text-green-400" : profit < 0 ? "text-red-400" : "text-slate-400";

          return (
            <div key={key} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4">{label}</h3>
              <div className="space-y-3">
                <NumberInput label="Total Revenue (₹)" value={y.revenue} onChange={setYear(key)("revenue")} placeholder="500000" />
                <div className="border-t border-slate-700 pt-2 mt-2">
                  <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Costs</p>
                  <div className="space-y-2">
                    <NumberInput label="Cost of Goods Sold (₹)" value={y.cogs} onChange={setYear(key)("cogs")} placeholder="200000" />
                    <NumberInput label="Operating Costs (₹)" value={y.operatingCosts} onChange={setYear(key)("operatingCosts")} placeholder="100000" />
                    <NumberInput label="Marketing Costs (₹)" value={y.marketingCosts} onChange={setYear(key)("marketingCosts")} placeholder="50000" />
                    <NumberInput label="Other Costs (₹)" value={y.otherCosts} onChange={setYear(key)("otherCosts")} placeholder="30000" />
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
                    return (parseFloat(y.cogs) || 0) + (parseFloat(y.operatingCosts) || 0) + (parseFloat(y.marketingCosts) || 0) + (parseFloat(y.otherCosts) || 0);
                  }
                  return calcProfit(y);
                });
                return (
                  <tr key={metric}>
                    <td className="py-2 pr-4 text-slate-300">{metric}</td>
                    {vals.map((v, i) => (
                      <td key={i} className={`text-right py-2 px-4 ${metric === "Net Profit" ? (v > 0 ? "text-green-400 font-semibold" : v < 0 ? "text-red-400 font-semibold" : "text-slate-400") : "text-slate-300"}`}>
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

  const [activeType, setActiveType] = useState<DocType>("SWOT");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [generating, setGenerating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [swot, setSWOT] = useState<SWOTData>(emptySWOT());
  const [bmc, setBMC] = useState<BMCData>(emptyBMC());
  const [financials, setFinancials] = useState<FinancialPlan>(emptyFinancials());

  // PDF & share state
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [shareTokens, setShareTokens] = useState<Partial<Record<DocType, string>>>({});
  const [shareMinting, setShareMinting] = useState(false);
  const [copied, setCopied] = useState(false);

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load all documents for this idea on mount
  useEffect(() => {
    if (!ideaId) return;
    let alive = true;

    async function loadDocs() {
      try {
        const res = await fetch(`/api/business/documents?ideaId=${ideaId}`);
        if (!res.ok) {
          if (res.status === 403) {
            setLoadError("You don't have access to this business plan.");
          }
          return;
        }
        const docs: { type: string; content: any; shareToken?: string }[] = await res.json();
        if (!alive) return;

        const tokens: Partial<Record<DocType, string>> = {};
        for (const doc of docs) {
          if (doc.type === "SWOT" && doc.content) setSWOT(doc.content as SWOTData);
          if (doc.type === "BMC" && doc.content) setBMC(doc.content as BMCData);
          if (doc.type === "FINANCIALS" && doc.content) setFinancials(doc.content as FinancialPlan);
          if (doc.shareToken) tokens[doc.type as DocType] = doc.shareToken;
        }
        setShareTokens(tokens);
      } catch (e) {
        console.error("Failed to load documents:", e);
      }
    }

    loadDocs();
    return () => { alive = false; };
  }, [ideaId]);

  // Debounced save to DB — fires 1.5s after last change
  const scheduleSave = useCallback(
    (type: DocType, content: any) => {
      if (!ideaId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      setSaveState("saving");

      saveTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch("/api/business/documents", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ideaId, type, content }),
          });
          if (res.ok) {
            setSaveState("saved");
            setTimeout(() => setSaveState("idle"), 1500);
          } else {
            setSaveState("error");
          }
        } catch {
          setSaveState("error");
        }
      }, 1500);
    },
    [ideaId]
  );

  function handleSWOTChange(d: SWOTData) {
    setSWOT(d);
    scheduleSave("SWOT", d);
  }
  function handleBMCChange(d: BMCData) {
    setBMC(d);
    scheduleSave("BMC", d);
  }
  function handleFinancialsChange(d: FinancialPlan) {
    setFinancials(d);
    scheduleSave("FINANCIALS", d);
  }

  // AI generate for the current active type
  async function handleGenerate() {
    if (!ideaId || generating) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/business/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId, type: activeType }),
      });
      if (!res.ok) throw new Error("Generate failed");
      const { content } = await res.json();

      if (activeType === "SWOT" && content) {
        const next = { ...swot, ...content };
        setSWOT(next);
        scheduleSave("SWOT", next);
      } else if (activeType === "BMC" && content) {
        const next = { ...bmc, ...content };
        setBMC(next);
        scheduleSave("BMC", next);
      } else if (activeType === "FINANCIALS" && content) {
        const next = { ...financials, ...content };
        setFinancials(next);
        scheduleSave("FINANCIALS", next);
      }
    } catch (e) {
      console.error("AI generate error:", e);
    } finally {
      setGenerating(false);
    }
  }

  // Download PDF for the active document type
  async function handleDownloadPdf() {
    if (!ideaId || pdfDownloading) return;
    setPdfDownloading(true);
    try {
      const url = `/api/business/documents/pdf/download?ideaId=${ideaId}&type=${activeType}`;
      const res = await fetch(url);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Failed to generate PDF. Save the document first.");
        return;
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${activeType.toLowerCase()}-plan.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      console.error("PDF download error:", e);
    } finally {
      setPdfDownloading(false);
    }
  }

  // Mint a share token for the active document type
  async function handleShare() {
    if (!ideaId || shareMinting) return;
    const existing = shareTokens[activeType];
    if (existing) {
      // Already minted — just copy
      copyShareLink(existing);
      return;
    }
    setShareMinting(true);
    try {
      const res = await fetch("/api/business/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId, type: activeType }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Failed to create share link. Save the document first.");
        return;
      }
      const { shareToken } = await res.json();
      setShareTokens((prev) => ({ ...prev, [activeType]: shareToken }));
      copyShareLink(shareToken);
    } catch (e) {
      console.error("Share error:", e);
    } finally {
      setShareMinting(false);
    }
  }

  function copyShareLink(token: string) {
    const url = `${window.location.origin}/business/share/${token}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const shareToken = shareTokens[activeType];
  const shareUrl = shareToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/business/share/${shareToken}` : null;

  const saveLabel = saveState === "saving" ? "Saving…" : saveState === "saved" ? "✓ Saved" : saveState === "error" ? "Save failed" : "";

  if (!ideaId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <p className="text-white">No idea ID provided.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <p className="text-red-300 text-lg mb-2">{loadError}</p>
          <a href="/business/idea" className="text-purple-400 hover:text-purple-300 text-sm underline">
            Start a new evaluation
          </a>
        </div>
      </div>
    );
  }

  const activeDocType = DOC_TYPES.find((d) => d.key === activeType)!;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 pb-16">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex gap-2 mb-5 flex-wrap">
            <a href="/self?tab=earn" className="px-3 py-1.5 rounded-lg text-xs bg-slate-800/70 hover:bg-slate-700/70 text-slate-300 hover:text-white border border-slate-700 transition">
              ← Earn Tab
            </a>
            <a href="/business/idea" className="px-3 py-1.5 rounded-lg text-xs bg-slate-800/70 hover:bg-slate-700/70 text-slate-300 hover:text-white border border-slate-700 transition">
              ↩ Evaluation
            </a>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Business Plan</h1>
              <p className="text-slate-400 mt-1">Build your complete business plan step by step.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {saveLabel && (
                <span className={`text-xs ${saveState === "error" ? "text-red-400" : "text-slate-400"}`}>
                  {saveLabel}
                </span>
              )}
              {activeType !== "COMPETITOR" && (
                <>
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="px-3 py-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white text-sm font-medium transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {generating ? (
                      <><span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />Generating…</>
                    ) : "✨ AI Draft"}
                  </button>
                  <button
                    onClick={handleDownloadPdf}
                    disabled={pdfDownloading}
                    className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {pdfDownloading ? (
                      <><span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />Preparing…</>
                    ) : "↓ PDF"}
                  </button>
                  <button
                    onClick={handleShare}
                    disabled={shareMinting}
                    className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {shareMinting ? (
                      <><span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />Creating…</>
                    ) : copied ? "✓ Copied!" : shareToken ? "🔗 Copy Link" : "🔗 Share"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Document Type Dropdown */}
        <div className="flex gap-2 mb-8 flex-wrap items-center">
          {DOC_TYPES.map((dt) => (
            <button
              key={dt.key}
              onClick={() => !dt.comingSoon && setActiveType(dt.key)}
              disabled={dt.comingSoon}
              title={dt.comingSoon ? "Coming soon" : undefined}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                dt.comingSoon
                  ? "bg-slate-800/30 text-slate-600 cursor-not-allowed border border-slate-700/40"
                  : activeType === dt.key
                  ? "bg-purple-600 text-white"
                  : "bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              <span>{dt.icon}</span>
              {dt.label}
              {dt.comingSoon && (
                <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">Soon</span>
              )}
            </button>
          ))}
        </div>

        {/* Share link strip — visible when a share token exists for the active type */}
        {shareUrl && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700 text-sm">
            <span className="text-slate-500 text-xs shrink-0">Share link:</span>
            <span className="text-slate-300 truncate flex-1 font-mono text-xs">{shareUrl}</span>
            <button
              onClick={() => copyShareLink(shareToken!)}
              className="shrink-0 text-xs text-purple-400 hover:text-purple-300 transition"
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs text-slate-500 hover:text-slate-300 transition"
            >
              Open ↗
            </a>
          </div>
        )}

        {/* Panel Content */}
        <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6">
          {activeType === "SWOT" && <SWOTPanel data={swot} onChange={handleSWOTChange} />}
          {activeType === "BMC" && <BMCPanel data={bmc} onChange={handleBMCChange} />}
          {activeType === "FINANCIALS" && <FinancialsPanel data={financials} onChange={handleFinancialsChange} />}
          {activeType === "COMPETITOR" && (
            <div className="text-center py-16 text-slate-500">
              <p className="text-4xl mb-4">🔍</p>
              <p className="text-lg font-medium text-slate-400">Competitor Study coming soon</p>
              <p className="text-sm mt-2">This document type is being built. Try SWOT, BMC, or Financials.</p>
            </div>
          )}
        </div>

        {/* Bottom nav */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => {
              const activeDocs = DOC_TYPES.filter((d) => !d.comingSoon);
              const idx = activeDocs.findIndex((d) => d.key === activeType);
              if (idx > 0) setActiveType(activeDocs[idx - 1].key);
            }}
            disabled={activeType === DOC_TYPES[0].key}
            className="px-4 py-2 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50 transition text-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <button
            onClick={() => {
              const activeDocs = DOC_TYPES.filter((d) => !d.comingSoon);
              const idx = activeDocs.findIndex((d) => d.key === activeType);
              if (idx < activeDocs.length - 1) setActiveType(activeDocs[idx + 1].key);
            }}
            disabled={activeType === "FINANCIALS"}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition text-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
