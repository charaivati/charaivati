// app/(business)/business/plan/page.tsx
"use client";
import React, { useState } from "react";

type FormState = {
  title: string;
  ownerEmail?: string;
  ownerPhone?: string;
  isExistingBusiness: "new" | "existing";
  shortDescription: string;
  marketGap: string;
  competitors: string;
  estimatedMarketSize?: number;
  rent?: number;
  staffCost?: number;
  otherCosts?: number;
  price?: number;
  expectedCustomersPerMonth?: number;
};

export default function BusinessPlanPage() {
  const [form, setForm] = useState<FormState>({
    title: "",
    isExistingBusiness: "new",
    shortDescription: "",
    marketGap: "",
    competitors: "",
    price: 0,
    expectedCustomersPerMonth: 0,
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ planId: string; retrievalToken: string; shareUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  // small derived calculation: monthly revenue & breakeven customers
  const monthlyRevenue = (Number(form.price) || 0) * (Number(form.expectedCustomersPerMonth) || 0);
  const monthlyFixed = (Number(form.rent) || 0) + (Number(form.staffCost) || 0) + (Number(form.otherCosts) || 0);
  const breakevenCustomers = (monthlyFixed > 0 && (Number(form.price) > 0)) ? Math.ceil(monthlyFixed / Number(form.price)) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const payload = {
      title: form.title || "Untitled plan",
      ownerEmail: form.ownerEmail || null,
      ownerPhone: form.ownerPhone || null,
      data: {
        shortDescription: form.shortDescription,
        marketGap: form.marketGap,
        competitors: form.competitors,
        estimatedMarketSize: form.estimatedMarketSize,
        finance: {
          rent: form.rent,
          staffCost: form.staffCost,
          otherCosts: form.otherCosts,
          price: form.price,
          expectedCustomersPerMonth: form.expectedCustomersPerMonth
        }
      }
    };

    try {
      const res = await fetch("/api/business/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Server error");
      }
      const json = await res.json();
      if (json.ok) {
        setResult({ planId: json.planId, retrievalToken: json.retrievalToken, shareUrl: json.shareUrl });
      } else {
        setError(json.message || "Unknown error");
      }
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Business Plan Builder</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <input
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="Business name"
            className="p-2 border rounded"
            required
          />
          <select
            value={form.isExistingBusiness}
            onChange={(e) => update("isExistingBusiness", e.target.value as any)}
            className="p-2 border rounded"
          >
            <option value="new">New business</option>
            <option value="existing">Existing owner</option>
          </select>
        </div>

        <textarea
          value={form.shortDescription}
          onChange={(e) => update("shortDescription", e.target.value)}
          placeholder="Short description: what's the idea? (1–2 lines)"
          className="w-full p-2 border rounded"
          rows={2}
        />

        <div className="grid grid-cols-2 gap-3">
          <input
            value={form.ownerEmail ?? ""}
            onChange={(e) => update("ownerEmail", e.target.value)}
            placeholder="Email (optional)"
            className="p-2 border rounded"
          />
          <input
            value={form.ownerPhone ?? ""}
            onChange={(e) => update("ownerPhone", e.target.value)}
            placeholder="Phone (optional)"
            className="p-2 border rounded"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input
            value={form.marketGap}
            onChange={(e) => update("marketGap", e.target.value)}
            placeholder="Market gap (problem)"
            className="p-2 border rounded"
          />
          <input
            value={form.competitors}
            onChange={(e) => update("competitors", e.target.value)}
            placeholder="Competitors (comma separated)"
            className="p-2 border rounded"
          />
        </div>

        <h4 className="font-medium">Simple finance (monthly)</h4>
        <div className="grid grid-cols-3 gap-3">
          <input type="number" placeholder="Rent" value={form.rent ?? 0} onChange={(e) => update("rent", Number(e.target.value))} className="p-2 border rounded" />
          <input type="number" placeholder="Staff cost" value={form.staffCost ?? 0} onChange={(e) => update("staffCost", Number(e.target.value))} className="p-2 border rounded" />
          <input type="number" placeholder="Other fixed costs" value={form.otherCosts ?? 0} onChange={(e) => update("otherCosts", Number(e.target.value))} className="p-2 border rounded" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input type="number" placeholder="Price per customer" value={form.price ?? 0} onChange={(e) => update("price", Number(e.target.value))} className="p-2 border rounded" />
          <input type="number" placeholder="Expected customers / month" value={form.expectedCustomersPerMonth ?? 0} onChange={(e) => update("expectedCustomersPerMonth", Number(e.target.value))} className="p-2 border rounded" />
        </div>

        <div className="bg-gray-50 p-3 rounded">
          <div>Estimated monthly revenue: <strong>{monthlyRevenue}</strong></div>
          <div>Monthly fixed cost: <strong>{monthlyFixed}</strong></div>
          <div>Breakeven customers (per month): <strong>{breakevenCustomers ?? "—"}</strong></div>
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded">
            {loading ? "Building..." : "Build plan & save"}
          </button>
          <button type="button" onClick={() => { setForm({
            title: "",
            isExistingBusiness: "new",
            shortDescription: "",
            marketGap: "",
            competitors: "",
            price: 0,
            expectedCustomersPerMonth: 0
          }); setResult(null); setError(null);}} className="px-4 py-2 border rounded">
            Reset
          </button>
        </div>

        {error && <div className="text-red-600">{error}</div>}
        {result && (
          <div className="bg-green-50 p-3 rounded">
            <div><strong>Saved</strong></div>
            <div>Plan id: {result.planId}</div>
            <div>Share URL: <a className="text-blue-600 underline" href={result.shareUrl} target="_blank" rel="noreferrer">{result.shareUrl}</a></div>
          </div>
        )}
      </form>
    </main>
  );
}
