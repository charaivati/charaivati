"use client";

import { useState } from "react";
import type { TestResult, EnvStatus } from "@/app/api/tests/model-env-check/route";

type ApiResponse = { envStatus: EnvStatus; tests: TestResult[] };

export default function ModelEnvCheckPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runTests() {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/tests/model-env-check");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8 font-mono">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">AI Model &amp; Env Check</h1>
          <p className="text-gray-400 text-sm mt-1">
            Tests each configured provider with a live ping. Results are printed to server console too.
          </p>
        </div>

        <button
          onClick={runTests}
          disabled={loading}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white font-semibold transition-colors"
        >
          {loading ? "Running tests…" : "Run Tests"}
        </button>

        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded p-4 text-red-300 text-sm">
            ❌ {error}
          </div>
        )}

        {loading && (
          <div className="text-gray-400 text-sm animate-pulse">
            Sending prompts to all providers — this may take up to 30 s…
          </div>
        )}

        {data && (
          <>
            {/* Env vars */}
            <section>
              <h2 className="text-lg font-semibold text-gray-200 mb-3">Environment Variables</h2>
              <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400">
                      <th className="text-left px-4 py-2">Variable</th>
                      <th className="text-left px-4 py-2">Status / Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.envStatus).map(([key, val]) => {
                      const isBool = typeof val === "boolean";
                      const isNull = val === null;
                      return (
                        <tr key={key} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="px-4 py-2 text-gray-300">{key}</td>
                          <td className="px-4 py-2">
                            {isBool ? (
                              val ? (
                                <span className="text-emerald-400">✅ set</span>
                              ) : (
                                <span className="text-red-400">❌ missing</span>
                              )
                            ) : isNull ? (
                              <span className="text-gray-500">— not set</span>
                            ) : (
                              <span className="text-yellow-300">{String(val)}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Test results */}
            <section>
              <h2 className="text-lg font-semibold text-gray-200 mb-3">Provider Tests</h2>
              <div className="space-y-3">
                {data.tests.map((t, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border p-4 ${
                      t.skipped
                        ? "bg-gray-900/50 border-gray-700"
                        : t.success
                        ? "bg-emerald-950/30 border-emerald-800"
                        : "bg-red-950/30 border-red-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-sm">{t.label}</p>
                        <p className="text-gray-400 text-xs mt-0.5">
                          {t.provider} · <span className="text-gray-500">{t.model}</span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {t.skipped ? (
                          <span className="text-gray-500 font-bold text-sm">⏭ skipped</span>
                        ) : t.success ? (
                          <span className="text-emerald-400 font-bold text-sm">✅ {t.latencyMs} ms</span>
                        ) : (
                          <span className="text-red-400 font-bold text-sm">❌ {t.latencyMs} ms</span>
                        )}
                      </div>
                    </div>

                    {t.success && t.response && (
                      <p className="mt-2 text-emerald-300 text-xs bg-emerald-950/50 rounded px-3 py-2 whitespace-pre-wrap break-words">
                        {t.response}
                      </p>
                    )}
                    {!t.success && t.error && (
                      <p className="mt-2 text-red-300 text-xs bg-red-950/50 rounded px-3 py-2 break-words">
                        {t.error}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Summary bar */}
            <section className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-sm flex flex-wrap gap-6">
              {(() => {
                const ran = data.tests.filter(t => !t.skipped);
                const passed = ran.filter(t => t.success).length;
                const failed = ran.filter(t => !t.success).length;
                const skipped = data.tests.filter(t => t.skipped).length;
                const avgMs = ran.length
                  ? Math.round(ran.reduce((s, t) => s + t.latencyMs, 0) / ran.length)
                  : 0;
                return (
                  <>
                    <span className="text-gray-400">Ran: <strong className="text-white">{ran.length}</strong></span>
                    <span className="text-emerald-400">Passed: <strong>{passed}</strong></span>
                    <span className="text-red-400">Failed: <strong>{failed}</strong></span>
                    {skipped > 0 && (
                      <span className="text-gray-500">Skipped: <strong>{skipped}</strong></span>
                    )}
                    <span className="text-gray-400">Avg latency: <strong className="text-white">{avgMs} ms</strong></span>
                  </>
                );
              })()}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
