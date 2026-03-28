// app/tests/ai/page.tsx
// Simple manual test page for all 3 AI routes
// Visit /tests/ai to use it
"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type RouteResult = {
  status: number;
  ok: boolean;
  data: unknown;
  ms: number;
  fallback: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function callRoute(path: string, body: object): Promise<RouteResult> {
  const start = Date.now();
  const res   = await fetch(path, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return {
    status:   res.status,
    ok:       res.ok,
    data,
    ms:       Date.now() - start,
    fallback: data?._fallback === true,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ResultBox({ result }: { result: RouteResult | null }) {
  if (!result) return null;
  return (
    <div className={`rounded-xl border p-4 mt-3 text-xs font-mono whitespace-pre-wrap break-all
      ${result.fallback
        ? "border-amber-500/40 bg-amber-500/5 text-amber-200"
        : result.ok
          ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-200"
          : "border-red-500/40 bg-red-500/5 text-red-300"
      }`}>
      <div className="flex items-center gap-3 mb-2 pb-2 border-b border-white/10">
        <span className={`font-semibold ${result.ok ? "text-emerald-400" : "text-red-400"}`}>
          {result.ok ? "✓ OK" : "✗ ERROR"} {result.status}
        </span>
        <span className="text-gray-400">{result.ms}ms</span>
        {result.fallback && (
          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs">
            ⚠ FALLBACK — AI did not respond
          </span>
        )}
        {!result.fallback && result.ok && (
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-xs">
            ✦ Real AI response
          </span>
        )}
      </div>
      {JSON.stringify(result.data, null, 2)}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5 space-y-4">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <input type="text" value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm text-white
        placeholder-gray-600 outline-none focus:border-indigo-500 transition-colors"
    />
  );
}

function RunButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={loading}
      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium
        transition-colors disabled:opacity-50 flex items-center gap-2">
      {loading && (
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      )}
      {loading ? "Running…" : "Run"}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AITestPage() {
  // ── generate-timeline fields ──────────────────────────────────
  const [tlDrives,   setTlDrives]   = useState("Learning, Building");
  const [tlGoal1,    setTlGoal1]    = useState("Learn guitar");
  const [tlSkill1,   setTlSkill1]   = useState("Guitar");
  const [tlGoal2,    setTlGoal2]    = useState("Start a 3D printing business");
  const [tlSkill2,   setTlSkill2]   = useState("3D modelling");
  const [tlHealth,   setTlHealth]   = useState("Vegetarian, Mixed 3x/wk, age 28");
  const [tlResult,   setTlResult]   = useState<RouteResult | null>(null);
  const [tlLoading,  setTlLoading]  = useState(false);
  const [tlPhases,   setTlPhases]   = useState<unknown>(null); // carry phases forward

  async function runTimeline() {
    setTlLoading(true);
    const body = {
      drives: tlDrives.split(",").map(s => s.trim()).filter(Boolean),
      goals: [
        { title: tlGoal1, skill: tlSkill1, drive: tlDrives.split(",")[0]?.trim() },
        ...(tlGoal2 ? [{ title: tlGoal2, skill: tlSkill2, drive: tlDrives.split(",")[1]?.trim() }] : []),
      ],
      health: { note: tlHealth },
    };
    const r = await callRoute("/api/ai/generate-timeline", body).catch(err => ({
      status: 0, ok: false, data: { error: String(err) }, ms: 0, fallback: false,
    }));
    setTlResult(r);
    if (r.ok && (r.data as any)?.phases) setTlPhases((r.data as any).phases);
    setTlLoading(false);
  }

  // ── generate-week-plan fields ─────────────────────────────────
  const [wpPhase,   setWpPhase]   = useState("foundation");
  const [wpDays,    setWpDays]    = useState("5");
  const [wpResult,  setWpResult]  = useState<RouteResult | null>(null);
  const [wpLoading, setWpLoading] = useState(false);

  async function runWeekPlan() {
    setWpLoading(true);
    const body = {
      phases:       tlPhases ?? [],
      currentPhase: wpPhase,
      availableDays: Number(wpDays),
    };
    const r = await callRoute("/api/ai/generate-week-plan", body).catch(err => ({
      status: 0, ok: false, data: { error: String(err) }, ms: 0, fallback: false,
    }));
    setWpResult(r);
    setWpLoading(false);
  }

  // ── suggest-actions fields ────────────────────────────────────
  const [saPhase,    setSaPhase]    = useState("foundation");
  const [saGoal,     setSaGoal]     = useState("Learn guitar");
  const [saSkills,   setSaSkills]   = useState("Guitar, Music theory");
  const [saRecent,   setSaRecent]   = useState("stretching, deep work");
  const [saResult,   setSaResult]   = useState<RouteResult | null>(null);
  const [saLoading,  setSaLoading]  = useState(false);

  async function runSuggest() {
    setSaLoading(true);
    const body = {
      currentPhase:   saPhase,
      goals:          [{ title: saGoal, skill: saSkills.split(",")[0]?.trim() }],
      skills:         saSkills.split(",").map(s => s.trim()).filter(Boolean),
      recentActivity: saRecent.split(",").map(s => s.trim()).filter(Boolean),
    };
    const r = await callRoute("/api/ai/suggest-actions", body).catch(err => ({
      status: 0, ok: false, data: { error: String(err) }, ms: 0, fallback: false,
    }));
    setSaResult(r);
    setSaLoading(false);
  }

  // ── Run all ───────────────────────────────────────────────────
  const [allLoading, setAllLoading] = useState(false);
  async function runAll() {
    setAllLoading(true);
    await runTimeline();
    await runWeekPlan();
    await runSuggest();
    setAllLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Route Tester</h1>
          <p className="text-sm text-gray-400 mt-1">
            Tests <code className="text-indigo-400">/api/ai/*</code> routes directly.
            A green badge = real AI. An amber badge = fallback (check API keys).
          </p>
        </div>
        <button type="button" onClick={runAll} disabled={allLoading}
          className="px-4 py-2 rounded-lg border border-indigo-500 text-indigo-300 text-sm
            hover:bg-indigo-500/10 transition-colors disabled:opacity-50">
          {allLoading ? "Running all…" : "Run all"}
        </button>
      </div>

      {/* ── 1. generate-timeline ── */}
      <Section title="1 · generate-timeline">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Drives (comma-separated)">
            <Input value={tlDrives} onChange={setTlDrives} placeholder="Learning, Building" />
          </Field>
          <Field label="Health note">
            <Input value={tlHealth} onChange={setTlHealth} placeholder="Vegetarian, Mixed 3x/wk" />
          </Field>
          <Field label="Goal 1">
            <Input value={tlGoal1} onChange={setTlGoal1} placeholder="Learn guitar" />
          </Field>
          <Field label="Skill 1">
            <Input value={tlSkill1} onChange={setTlSkill1} placeholder="Guitar" />
          </Field>
          <Field label="Goal 2 (optional)">
            <Input value={tlGoal2} onChange={setTlGoal2} placeholder="3D printing business" />
          </Field>
          <Field label="Skill 2 (optional)">
            <Input value={tlSkill2} onChange={setTlSkill2} placeholder="3D modelling" />
          </Field>
        </div>
        <RunButton onClick={runTimeline} loading={tlLoading} />
        {!!tlPhases && !tlResult?.fallback && (
          <p className="text-xs text-emerald-400">✓ Phases saved — use below in week plan test</p>
        )}
        <ResultBox result={tlResult} />
      </Section>

      {/* ── 2. generate-week-plan ── */}
      <Section title="2 · generate-week-plan">
        <p className="text-xs text-gray-500">
          Uses phases from the timeline test above (run that first for real data).
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Current phase">
            <select value={wpPhase} onChange={e => setWpPhase(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm
                text-white outline-none focus:border-indigo-500 transition-colors">
              <option value="foundation">Foundation</option>
              <option value="growth">Growth</option>
              <option value="mastery">Mastery</option>
            </select>
          </Field>
          <Field label="Available days">
            <select value={wpDays} onChange={e => setWpDays(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm
                text-white outline-none focus:border-indigo-500 transition-colors">
              {[3,4,5,6,7].map(n => <option key={n} value={n}>{n} days</option>)}
            </select>
          </Field>
        </div>
        <RunButton onClick={runWeekPlan} loading={wpLoading} />
        <ResultBox result={wpResult} />
      </Section>

      {/* ── 3. suggest-actions ── */}
      <Section title="3 · suggest-actions">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Current phase">
            <select value={saPhase} onChange={e => setSaPhase(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm
                text-white outline-none focus:border-indigo-500 transition-colors">
              <option value="foundation">Foundation</option>
              <option value="growth">Growth</option>
              <option value="mastery">Mastery</option>
            </select>
          </Field>
          <Field label="Goal">
            <Input value={saGoal} onChange={setSaGoal} placeholder="Learn guitar" />
          </Field>
          <Field label="Skills (comma-separated)">
            <Input value={saSkills} onChange={setSaSkills} placeholder="Guitar, Music theory" />
          </Field>
          <Field label="Recent activity (comma-separated)">
            <Input value={saRecent} onChange={setSaRecent} placeholder="stretching, deep work" />
          </Field>
        </div>
        <RunButton onClick={runSuggest} loading={saLoading} />
        <ResultBox result={saResult} />
      </Section>

      <p className="text-xs text-gray-600 text-center pb-6">
        This page is for development only. Remove or protect it before going to production.
      </p>
    </div>
  );
}