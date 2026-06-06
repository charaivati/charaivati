// app/(business)/business/share/[token]/page.tsx
// Public read-only share page. No auth required — the token IS the access grant.
// The page fetches one document by shareToken and renders it read-only.
// Only the matched document is visible; no other documents are exposed.

import { notFound } from "next/navigation";
import { db } from "@/lib/db";

/* ─── Types ─────────────────────────────────────────────────────────────── */

type SWOTContent = { strengths: string; weaknesses: string; opportunities: string; threats: string };
type BMCContent = {
  keyPartners: string; keyActivities: string; keyResources: string;
  valuePropositions: string; customerRelationships: string; channels: string;
  customerSegments: string; costStructure: string; revenueStreams: string;
};
type YearFinancials = { revenue: string; cogs: string; operatingCosts: string; marketingCosts: string; otherCosts: string };
type FinancialsContent = { year1: YearFinancials; year2: YearFinancials; year3: YearFinancials };

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function fmtINR(s: string): string {
  const n = parseFloat(s);
  if (!s || isNaN(n)) return "—";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function calcProfit(y: YearFinancials): number {
  return (
    (parseFloat(y.revenue) || 0) -
    (parseFloat(y.cogs) || 0) -
    (parseFloat(y.operatingCosts) || 0) -
    (parseFloat(y.marketingCosts) || 0) -
    (parseFloat(y.otherCosts) || 0)
  );
}

function calcTotalCosts(y: YearFinancials): number {
  return (
    (parseFloat(y.cogs) || 0) +
    (parseFloat(y.operatingCosts) || 0) +
    (parseFloat(y.marketingCosts) || 0) +
    (parseFloat(y.otherCosts) || 0)
  );
}

/* ─── Read-only panel components ────────────────────────────────────────── */

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">
        {value || <span className="text-slate-600 italic">Not filled</span>}
      </p>
    </div>
  );
}

function SWOTView({ content }: { content: SWOTContent }) {
  const quadrants = [
    { key: "strengths" as const, label: "Strengths", color: "border-green-500/50 bg-green-500/5" },
    { key: "weaknesses" as const, label: "Weaknesses", color: "border-red-500/50 bg-red-500/5" },
    { key: "opportunities" as const, label: "Opportunities", color: "border-blue-500/50 bg-blue-500/5" },
    { key: "threats" as const, label: "Threats", color: "border-yellow-500/50 bg-yellow-500/5" },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {quadrants.map((q) => (
        <div key={q.key} className={`p-4 rounded-xl border ${q.color}`}>
          <ReadonlyField label={q.label} value={content[q.key]} />
        </div>
      ))}
    </div>
  );
}

function BMCView({ content }: { content: BMCContent }) {
  const cells = [
    { key: "keyPartners" as const, label: "Key Partners" },
    { key: "keyActivities" as const, label: "Key Activities" },
    { key: "valuePropositions" as const, label: "Value Propositions" },
    { key: "customerRelationships" as const, label: "Customer Relationships" },
    { key: "customerSegments" as const, label: "Customer Segments" },
    { key: "keyResources" as const, label: "Key Resources" },
    { key: "channels" as const, label: "Channels" },
    { key: "costStructure" as const, label: "Cost Structure" },
    { key: "revenueStreams" as const, label: "Revenue Streams" },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cells.map((c) => (
        <div key={c.key} className="p-4 rounded-xl bg-slate-800/40 border border-slate-700">
          <ReadonlyField label={c.label} value={content[c.key]} />
        </div>
      ))}
    </div>
  );
}

function FinancialsView({ content }: { content: FinancialsContent }) {
  const years = [
    { key: "year1" as const, label: "Year 1" },
    { key: "year2" as const, label: "Year 2" },
    { key: "year3" as const, label: "Year 3" },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {years.map(({ key, label }) => {
          const y = content[key];
          const profit = calcProfit(y);
          const profitColor = profit > 0 ? "text-green-400" : profit < 0 ? "text-red-400" : "text-slate-400";
          return (
            <div key={key} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4">{label}</h3>
              <div className="space-y-2 text-sm">
                {[
                  { l: "Revenue", v: fmtINR(y.revenue) },
                  { l: "COGS", v: fmtINR(y.cogs) },
                  { l: "Operating Costs", v: fmtINR(y.operatingCosts) },
                  { l: "Marketing Costs", v: fmtINR(y.marketingCosts) },
                  { l: "Other Costs", v: fmtINR(y.otherCosts) },
                ].map(({ l, v }) => (
                  <div key={l} className="flex justify-between">
                    <span className="text-slate-400">{l}</span>
                    <span className="text-white">{v}</span>
                  </div>
                ))}
                <div className="border-t border-slate-700 pt-2 mt-2 flex justify-between font-semibold">
                  <span className="text-slate-300">Net Profit / Loss</span>
                  <span className={profitColor}>{fmtINR(String(profit))}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* Summary table */}
      <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700 overflow-x-auto">
        <h3 className="text-base font-bold text-white mb-3">Summary</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 border-b border-slate-700">
              <th className="text-left py-2 pr-4">Metric</th>
              {years.map(({ key, label }) => (
                <th key={key} className="text-right py-2 px-4">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {(["Revenue", "Total Costs", "Net Profit"] as const).map((metric) => {
              return (
                <tr key={metric}>
                  <td className="py-2 pr-4 text-slate-300">{metric}</td>
                  {years.map(({ key }) => {
                    const y = content[key];
                    const val =
                      metric === "Revenue"
                        ? parseFloat(y.revenue) || 0
                        : metric === "Total Costs"
                        ? calcTotalCosts(y)
                        : calcProfit(y);
                    const color =
                      metric === "Net Profit"
                        ? val > 0
                          ? "text-green-400 font-semibold"
                          : val < 0
                          ? "text-red-400 font-semibold"
                          : "text-slate-400"
                        : "text-slate-300";
                    return (
                      <td key={key} className={`text-right py-2 px-4 ${color}`}>
                        {fmtINR(String(val))}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

const TYPE_LABELS: Record<string, string> = {
  SWOT: "SWOT Analysis",
  BMC: "Business Model Canvas",
  FINANCIALS: "3-Year Financial Plan",
};

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const doc = await (db as any).businessDocument.findFirst({
    where: { shareToken: token },
    select: {
      id: true,
      type: true,
      title: true,
      content: true,
      status: true,
      updatedAt: true,
    },
  });

  if (!doc) notFound();

  const typeLabel = TYPE_LABELS[doc.type] ?? doc.type;
  const downloadUrl = `/api/business/share/${token}/pdf`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 pb-16">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs text-purple-400 uppercase tracking-widest mb-1">
                Charaivati Business Plan
              </p>
              <h1 className="text-2xl font-bold text-white">{typeLabel}</h1>
              {doc.title && (
                <p className="text-slate-400 mt-1 text-sm">{doc.title}</p>
              )}
              <p className="text-xs text-slate-500 mt-2">
                Read-only · Last updated{" "}
                {new Date(doc.updatedAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            {["SWOT", "BMC", "FINANCIALS"].includes(doc.type) && (
              <a
                href={downloadUrl}
                download
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition flex items-center gap-2"
              >
                ↓ Download PDF
              </a>
            )}
          </div>
        </div>

        {/* Document content — read-only */}
        <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6">
          {doc.type === "SWOT" && <SWOTView content={doc.content as SWOTContent} />}
          {doc.type === "BMC" && <BMCView content={doc.content as BMCContent} />}
          {doc.type === "FINANCIALS" && (
            <FinancialsView content={doc.content as FinancialsContent} />
          )}
          {!["SWOT", "BMC", "FINANCIALS"].includes(doc.type) && (
            <p className="text-slate-400 text-sm">This document type cannot be displayed.</p>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-600 mt-8">
          Shared via{" "}
          <a href="https://charaivati.com" className="text-purple-500 hover:text-purple-400">
            Charaivati
          </a>{" "}
          · This is a view-only link
        </p>
      </div>
    </div>
  );
}
