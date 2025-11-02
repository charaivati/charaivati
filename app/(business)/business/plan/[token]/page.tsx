// app/business/plan/[token]/page.tsx
import React from "react";
import Link from "next/link";

type Params = { params: { token: string } };

async function fetchPlan(token: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/business/plan/${token}`, {
    // server-side fetch; no-store ensures always fresh
    cache: "no-store",
  });

  if (!res.ok) {
    return null;
  }
  return res.json();
}

export default async function PlanPage({ params }: Params) {
  const token = params.token;
  const plan = await fetchPlan(token);

  if (!plan) {
    return (
      <main className="min-h-screen p-8 bg-[#07070a] text-gray-100">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Plan not found</h1>
          <p className="text-gray-400">We couldn't locate a business plan for that link.</p>
          <div className="mt-6">
            <Link href="/business/plan" className="px-4 py-2 bg-blue-600 rounded">
              Start a new plan
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // dataJson could be a nested object; guard it
  const data = plan.dataJson ?? {};
  const idea = data.shortDescription ?? data.idea ?? data.summary ?? "";
  const marketGap = data.marketGap ?? data.problem ?? "";
  const competitors = data.competitors ?? "";
  const finance = data.finance ?? null; // optional structure: { revenue:..., cost:..., breakeven:... }

  const shareUrl = (() => {
    // if you have canonical domain, NEXT_PUBLIC_BASE_URL should be set; fallback to relative URL
    const base = process.env.NEXT_PUBLIC_BASE_URL || "";
    return base ? `${base}/business/plan/${params.token}` : `/business/plan/${params.token}`;
  })();

  return (
    <main className="min-h-screen p-8 bg-[#07070a] text-gray-100">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold">{plan.title ?? "Untitled plan"}</h1>
          <p className="text-sm text-gray-400 mt-2">
            Created: {new Date(plan.createdAt).toLocaleString()} • Status:{" "}
            <span className="capitalize">{plan.status}</span>
          </p>
        </header>

        <section className="bg-[#0b0b0f] p-6 rounded-lg shadow-sm mb-6">
          <h2 className="font-semibold mb-2">Idea</h2>
          <p className="text-gray-300 mb-4">{idea || "No short summary provided."}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium text-sm mb-1">Market gap / Problem</h3>
              <p className="text-gray-300">{marketGap || "Not specified"}</p>
            </div>
            <div>
              <h3 className="font-medium text-sm mb-1">Competitors</h3>
              <p className="text-gray-300">{competitors || "None listed"}</p>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h3 className="font-semibold mb-3">Simple finance (monthly)</h3>
          {finance ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-[#0b0b0f] rounded">
                <div className="text-sm text-gray-400">Revenue</div>
                <div className="mt-1 font-medium">{finance.revenue ?? "—"}</div>
              </div>
              <div className="p-4 bg-[#0b0b0f] rounded">
                <div className="text-sm text-gray-400">Fixed costs</div>
                <div className="mt-1 font-medium">{finance.fixedCosts ?? "—"}</div>
              </div>
              <div className="p-4 bg-[#0b0b0f] rounded">
                <div className="text-sm text-gray-400">Variable costs</div>
                <div className="mt-1 font-medium">{finance.variableCosts ?? "—"}</div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-[#0b0b0f] rounded text-gray-300">
              No finance numbers provided yet.
            </div>
          )}
        </section>

        <section className="mb-6">
          <h3 className="font-semibold mb-2">Business Model Canvas (quick view)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-[#0b0b0f] rounded">
              <div className="text-xs text-gray-400">Key partners</div>
              <div className="mt-2 text-sm text-gray-200">{data.kv_partners ?? "—"}</div>
            </div>
            <div className="p-3 bg-[#0b0b0f] rounded">
              <div className="text-xs text-gray-400">Value proposition</div>
              <div className="mt-2 text-sm text-gray-200">{data.valueProposition ?? "—"}</div>
            </div>
            <div className="p-3 bg-[#0b0b0f] rounded">
              <div className="text-xs text-gray-400">Customer segments</div>
              <div className="mt-2 text-sm text-gray-200">{data.customers ?? "—"}</div>
            </div>
          </div>
        </section>

        <section className="flex items-center gap-3">
          <button
            onClick={() => {
              // client-side: copy
              if (typeof window !== "undefined") {
                navigator.clipboard.writeText(shareUrl);
                // toast could be added later
                alert("Link copied to clipboard");
              }
            }}
            className="px-4 py-2 bg-blue-600 rounded"
          >
            Copy share link
          </button>

          {plan.pdfPath ? (
            <a
              href={plan.pdfPath}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded"
            >
              Open PDF
            </a>
          ) : null}

          <Link href="/business/plan" className="px-4 py-2 bg-transparent border border-gray-700 rounded">
            Build your own plan
          </Link>

          {/* Optional: small owner contact */}
          {plan.ownerEmail ? (
            <div className="ml-auto text-sm text-gray-400">
              Owner: {plan.ownerEmail} {plan.ownerVerified ? "• verified" : ""}
            </div>
          ) : null}
        </section>

        <footer className="mt-10 text-xs text-gray-500">
          <div>Generated by Charaivati • token: {params.token}</div>
        </footer>
      </div>
    </main>
  );
}
