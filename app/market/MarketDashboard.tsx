"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import Link from "next/link";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const sign = (n: number) => (n >= 0 ? "text-green-400" : "text-red-400");

type Holding = {
  tradingsymbol: string;
  quantity: number;
  average_price: number;
  last_price: number;
  pnl: number;
  day_change: number;
  day_change_percentage: number;
};
type Position = {
  tradingsymbol: string;
  quantity: number;
  buy_price?: number;
  average_price: number;
  last_price: number;
  pnl: number;
};

const TABS = [
  { key: "overview", label: "Overview", href: "/market" },
  { key: "holdings", label: "Holdings", href: "/market/holdings" },
  { key: "positions", label: "Positions", href: "/market/positions" },
  { key: "pnl", label: "P&L", href: "/market/pnl" },
] as const;

export default function MarketDashboard({ tab }: { tab: string }) {
  const [state, setState] = useState<"loading" | "connected" | "disconnected" | "error">("loading");
  const [expired, setExpired] = useState(false);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [err, setErr] = useState("");

  const [analysing, setAnalysing] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setState("loading");
    try {
      const [h, p] = await Promise.all([
        fetch("/api/kite/holdings"),
        fetch("/api/kite/positions"),
      ]);
      if (h.status === 401) {
        const j = await h.json().catch(() => ({}));
        setExpired(Boolean(j.expired));
        setState("disconnected");
        return;
      }
      if (!h.ok) {
        setErr("Couldn't load your portfolio.");
        setState("error");
        return;
      }
      setHoldings((await h.json()).holdings ?? []);
      setPositions(p.ok ? (await p.json()).positions ?? [] : []);
      setState("connected");
    } catch {
      setErr("Network error.");
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function analyse(h: Holding) {
    if (analysing === h.tradingsymbol) return;
    if (analysis[h.tradingsymbol]) {
      setAnalysis((a) => {
        const next = { ...a };
        delete next[h.tradingsymbol];
        return next;
      });
      return;
    }
    setAnalysing(h.tradingsymbol);
    try {
      const res = await fetch("/api/market/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holding: h }),
      });
      const j = await res.json();
      setAnalysis((a) => ({ ...a, [h.tradingsymbol]: j.analysis || j.error || "No analysis." }));
    } catch {
      setAnalysis((a) => ({ ...a, [h.tradingsymbol]: "Analysis failed." }));
    } finally {
      setAnalysing(null);
    }
  }

  // ── Summary (holdings-based) ──────────────────────────────────────────────
  const invested = holdings.reduce((s, h) => s + h.average_price * h.quantity, 0);
  const current = holdings.reduce((s, h) => s + h.last_price * h.quantity, 0);
  const totalReturns = current - invested;
  const returnsPct = invested ? (totalReturns / invested) * 100 : 0;
  const dayPnl = holdings.reduce((s, h) => s + h.day_change * h.quantity, 0);

  return (
    <div className="min-h-screen bg-black text-gray-100">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-bold mb-1">Market</h1>
        <p className="text-sm text-gray-500 mb-5">Your Zerodha portfolio</p>

        {state === "loading" && <Skeleton />}

        {state === "error" && (
          <Card>
            <p className="text-red-400">{err}</p>
            <button onClick={load} className="mt-3 rounded-md bg-gray-800 px-4 py-2 text-sm hover:bg-gray-700">
              Retry
            </button>
          </Card>
        )}

        {state === "disconnected" && (
          <Card>
            <h2 className="text-lg font-semibold mb-2">
              {expired ? "Your Zerodha session expired" : "Connect your Zerodha account"}
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              {expired
                ? "Kite access tokens reset daily. Reconnect to view your live portfolio."
                : "Sign in with Kite Connect to see your holdings, positions and P&L. We never store your login or place orders."}
            </p>
            <a
              href="/api/kite/login"
              className="inline-block rounded-md bg-amber-500 px-5 py-2.5 font-medium text-black hover:bg-amber-400"
            >
              {expired ? "Reconnect Zerodha" : "Connect Zerodha →"}
            </a>
          </Card>
        )}

        {state === "connected" && (
          <>
            <nav className="mb-5 flex gap-1 border-b border-gray-800">
              {TABS.map((t) => (
                <Link
                  key={t.key}
                  href={t.href}
                  className={`px-4 py-2 text-sm -mb-px border-b-2 ${
                    tab === t.key
                      ? "border-amber-500 text-white"
                      : "border-transparent text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {t.label}
                </Link>
              ))}
            </nav>

            {(tab === "overview" || tab === "pnl") && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
                <Stat label="Invested" value={inr.format(invested)} />
                <Stat label="Current value" value={inr.format(current)} />
                <Stat
                  label="Total returns"
                  value={inr.format(totalReturns)}
                  sub={pct(returnsPct)}
                  tone={sign(totalReturns)}
                />
                <Stat label="Day's P&L" value={inr.format(dayPnl)} tone={sign(dayPnl)} />
              </div>
            )}

            {(tab === "overview" || tab === "holdings") && (
              <Section title="Holdings" empty={holdings.length === 0 ? "No holdings." : null}>
                <Table head={["Symbol", "Qty", "Avg", "LTP", "P&L", "Day", ""]}>
                  {holdings.map((h) => (
                    <Fragment key={h.tradingsymbol}>
                      <tr className="border-t border-gray-800">
                        <td className="py-2 pr-3 font-medium">{h.tradingsymbol}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{h.quantity}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{inr.format(h.average_price)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{inr.format(h.last_price)}</td>
                        <td className={`py-2 pr-3 text-right tabular-nums ${sign(h.pnl)}`}>{inr.format(h.pnl)}</td>
                        <td className={`py-2 pr-3 text-right tabular-nums ${sign(h.day_change)}`}>
                          {pct(h.day_change_percentage)}
                        </td>
                        <td className="py-2 text-right">
                          <button
                            onClick={() => analyse(h)}
                            disabled={analysing === h.tradingsymbol}
                            className="rounded bg-gray-800 px-2 py-1 text-xs hover:bg-gray-700 disabled:opacity-50"
                          >
                            {analysing === h.tradingsymbol
                              ? "Analysing…"
                              : analysis[h.tradingsymbol]
                              ? "Hide"
                              : "Analyse with AI"}
                          </button>
                        </td>
                      </tr>
                      {analysis[h.tradingsymbol] && (
                        <tr className="border-t border-gray-900 bg-gray-950/60">
                          <td colSpan={7} className="px-3 py-3 text-sm text-gray-300 whitespace-pre-wrap">
                            {analysis[h.tradingsymbol]}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </Table>
              </Section>
            )}

            {(tab === "overview" || tab === "positions") && (
              <Section title="Positions" empty={positions.length === 0 ? "No open positions." : null}>
                <Table head={["Symbol", "Qty", "Buy", "LTP", "P&L"]}>
                  {positions.map((p) => (
                    <tr key={p.tradingsymbol} className="border-t border-gray-800">
                      <td className="py-2 pr-3 font-medium">{p.tradingsymbol}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{p.quantity}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {inr.format(p.buy_price ?? p.average_price)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{inr.format(p.last_price)}</td>
                      <td className={`py-2 text-right tabular-nums ${sign(p.pnl)}`}>{inr.format(p.pnl)}</td>
                    </tr>
                  ))}
                </Table>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-gray-800 bg-gray-950 p-6">{children}</div>;
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${tone ?? ""}`}>{value}</div>
      {sub && <div className={`text-xs ${tone ?? "text-gray-500"}`}>{sub}</div>}
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string | null; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="mb-2 text-sm font-semibold text-gray-400">{title}</h3>
      {empty ? <p className="text-sm text-gray-600">{empty}</p> : children}
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="text-xs text-gray-500">
            {head.map((h, i) => (
              <th key={i} className={`px-3 py-2 font-normal ${i === 0 ? "text-left" : "text-right"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-900" />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-xl bg-gray-900" />
    </div>
  );
}
