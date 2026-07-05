"use client";

// CHAKRA-UI-3: per-chakra detail page — the MIDDLE LAYER between the landing
// journey card and the action surface. Renders everything that shapes this
// chakra (the score's sub-signals as factor cards with "work on this" links
// into existing modules), the platform-vs-felt gap, the self-report slider,
// and this chakra's tagged todos — then one primary CTA to the action page
// (DEEP_LINKS). Same theme as the journey: black, twinkling stars, the
// chakra's colour and yantra. Dormant framing stays "ready to awaken".

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { CHAKRAS } from "../chakras";
import { CHAKRA_KEYS, isChakraKey, ARCHETYPE_CHAKRA, type ChakraKey } from "@/lib/chakra/keys";
import { useTranslations } from "@/hooks/useTranslations";
import { CHAKRA_SYMBOL } from "../chakraSymbols";
import { DEEP_LINKS, REMARK_EN, SURFACE_EN, SIGNAL_EN, SIGNAL_DESC_EN, SIGNAL_LINKS } from "../meta";

const T_SLUGS = [
  "chakra-feel", "chakra-platform", "chakra-you", "chakra-coming",
  "chakra-todos", "chakra-awaken", "chakra-saved", "chakra-goto",
  "chakra-add-reflection", "chakra-signals", "chakra-improve", "chakra-journey",
  ...Object.keys(SIGNAL_EN).map((k) => `chakra-signal-${k}`),
  ...Object.keys(SIGNAL_DESC_EN).map((k) => `chakra-signal-desc-${k}`),
  ...CHAKRA_KEYS.map((k) => `chakra-remark-${k}`),
  ...CHAKRA_KEYS.map((k) => `chakra-surface-${k}`),
].join(",");

type Signal = { key: string; value: number };
type Detail = { score: number; platform: number; self: number | null; platformOnly: boolean; signals?: Signal[] };
type Todo = { id: string; title: string; completed: boolean; chakra: string | null };
// EXECPLAN-5: compact execution-plan view for goals whose archetype maps here
type PlanGoal = {
  id: string; title: string; archetype: string; status: string;
  currentPhaseIndex: number;
  executionPlan: { nextAction?: { text?: string }; phases?: { title: string }[] } | null;
};

// Deterministic starfield (Math.sin hash, not Math.random) so SSR/client match.
const STARS = Array.from({ length: 34 }, (_, i) => {
  const r = (n: number) => { const x = Math.sin(i * 9301 + n * 49297) * 233280; return x - Math.floor(x); };
  return { top: r(1) * 100, left: r(2) * 100, size: 1 + r(3) * 1.5, delay: r(4) * 4, dur: 2 + r(5) * 3 };
});

const RING_R = 26;
const RING_C = 2 * Math.PI * RING_R;

export default function ChakraDetail() {
  const params = useParams<{ key: string }>();
  const key = params?.key;
  if (!isChakraKey(key)) notFound();
  return <ChakraDetailInner chakraKey={key as ChakraKey} />;
}

function ChakraDetailInner({ chakraKey: key }: { chakraKey: ChakraKey }) {
  const t = useTranslations(T_SLUGS);
  const c = CHAKRAS[CHAKRA_KEYS.indexOf(key)];
  const [detail, setDetail] = useState<Detail | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [planGoals, setPlanGoals] = useState<PlanGoal[]>([]);
  const [report, setReport] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false); // stars client-only (no SSR hydration mismatch)
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    fetch("/api/chakra").then((r) => r.json()).then((j) => j.ok && setDetail(j.scores?.[key] ?? null)).catch(() => {});
    fetch("/api/self/todos").then((r) => r.json()).then((j) => j.ok && setTodos(j.data)).catch(() => {});
    fetch("/api/user/profile").then((r) => r.json())
      .then((j) => j.ok && j.profile?.chakraSelfReport && setReport(j.profile.chakraSelfReport)).catch(() => {});
    // EXECPLAN-5: active goals with plans whose archetype maps to this chakra
    fetch("/api/self/goals", { credentials: "include" }).then((r) => r.json())
      .then((j) => setPlanGoals(((j.goals ?? []) as PlanGoal[])
        .filter((g) => g.status === "ACTIVE" && g.executionPlan && ARCHETYPE_CHAKRA[g.archetype] === key)))
      .catch(() => {});
  }, [key]);

  const list = useMemo(() => todos.filter((td) => td.chakra === key), [todos, key]);
  const doneCount = list.filter((td) => td.completed).length;
  const href = DEEP_LINKS[key];
  const surface = t(`chakra-surface-${key}`, SURFACE_EN[key]);

  function saveReport(value: number) {
    const next = { ...report, [key]: value };
    setReport(next);
    fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chakraSelfReport: next }),
    }).then(() => { setSaved(true); setTimeout(() => setSaved(false), 1500); }).catch(() => {});
  }

  return (
    <main className="relative min-h-screen bg-black text-white">
      <style>{`
        @keyframes chakraTwinkle { 0%,100% { opacity: .15; } 50% { opacity: 1; } }
        @keyframes chakraSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes chakraCardIn { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: none; } }
        .chakra-spin { animation: chakraSpin 60s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .chakra-spin { animation: none; } }
      `}</style>

      {/* Twinkling stars + a soft glow in this chakra's colour */}
      {mounted && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          {STARS.map((s, i) => (
            <span key={i} style={{ position: "absolute", top: `${s.top}%`, left: `${s.left}%`,
              width: s.size, height: s.size, borderRadius: "50%", background: "#fff",
              animation: `chakraTwinkle ${s.dur}s ease-in-out ${s.delay}s infinite` }} />
          ))}
        </div>
      )}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0"
        style={{ background: `radial-gradient(90% 50% at 50% 0%, ${c.color}22 0%, transparent 65%)` }} />

      <Link href="/chakra/landing" className="fixed top-4 left-4 z-20 text-sm text-white/40 hover:text-white/80">
        ← {t("chakra-journey", "Journey")}
      </Link>

      <div className="relative z-10 mx-auto w-full max-w-md px-4 pb-10 pt-16" style={{ animation: "chakraCardIn .35s ease-out" }}>
        {/* header: spinning yantra + names + score ring */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <svg viewBox="-56 -56 112 112" className="h-20 w-20 shrink-0">
              <circle cx="0" cy="0" r="50" fill={c.color} opacity="0.12" />
              <g className="chakra-spin" fill="none" stroke={c.color} strokeWidth={2.5} strokeLinejoin="round"
                style={{ transformBox: "fill-box", transformOrigin: "center" }}>
                {CHAKRA_SYMBOL[key]}
              </g>
            </svg>
            <div>
              <h1 className="text-xl font-semibold">{c.sanskrit}</h1>
              <div className="text-sm text-white/40">{surface || c.name}</div>
            </div>
          </div>
          <svg width="72" height="72" viewBox="0 0 64 64" className="shrink-0">
            <circle cx="32" cy="32" r={RING_R} stroke="rgba(255,255,255,0.1)" strokeWidth="4" fill="none" />
            <circle cx="32" cy="32" r={RING_R} stroke={c.color} strokeWidth="4" fill="none" strokeLinecap="round"
              strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - (detail?.score ?? 0) / 100)}
              transform="rotate(-90 32 32)" style={{ transition: "stroke-dashoffset 1.2s ease .2s" }} />
            <text x="32" y="37" textAnchor="middle" fill="#fff" fontSize="15" fontWeight="600">{detail?.score ?? 0}</text>
          </svg>
        </div>

        {/* measured vs felt + calm remark */}
        <div className="mt-4 text-sm text-white/50">
          {t("chakra-platform", "Platform sees")} {detail?.platform ?? 0}
          {detail && !detail.platformOnly && detail.self !== null
            ? <> · {t("chakra-you", "you feel")} {detail.self}</>
            : <span className="text-white/30"> · {t("chakra-add-reflection", "add your reflection")}</span>}
        </div>
        <p className="mt-2 text-sm text-white/70">{t(`chakra-remark-${key}`, REMARK_EN[key])}</p>

        {/* factor cards — every sub-signal, with a path into the module that moves it */}
        <div className="mt-6">
          <div className="mb-2 text-xs uppercase tracking-wider text-white/40">{t("chakra-signals", "What lights this")}</div>
          {!detail ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl border border-white/5 bg-white/5" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(detail.signals ?? []).map((sg) => {
                const link = SIGNAL_LINKS[sg.key] ?? null;
                return (
                  <div key={sg.key} className="rounded-xl border p-4"
                    style={{ borderColor: `${c.color}26`, background: "rgba(8,8,14,0.62)" }}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">{t(`chakra-signal-${sg.key}`, SIGNAL_EN[sg.key] ?? sg.key)}</span>
                      <span className="text-xs text-white/40">{sg.value} / 100</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${sg.value}%`, background: c.color, opacity: 0.85, transition: "width 1s ease .2s" }} />
                    </div>
                    <p className="mt-2 text-xs text-white/50">{t(`chakra-signal-desc-${sg.key}`, SIGNAL_DESC_EN[sg.key] ?? "")}</p>
                    {link && (
                      <Link href={link} className="mt-2 inline-block text-xs font-medium hover:underline" style={{ color: c.color }}>
                        {t("chakra-improve", "Work on this")} →
                      </Link>
                    )}
                  </div>
                );
              })}
              {(detail.signals ?? []).length === 0 && (
                <p className="text-sm text-white/40">{t("chakra-awaken", "Nothing here yet — ready to awaken.")}</p>
              )}
            </div>
          )}
        </div>

        {/* self-report slider */}
        <div className="mt-6">
          <div className="mb-1 flex justify-between text-xs text-white/50">
            <span>{t("chakra-feel", "How does this feel?")}</span>
            {saved && <span style={{ color: c.color }}>{t("chakra-saved", "Saved ✓")}</span>}
          </div>
          <input type="range" min={1} max={7} step={1} value={report[key] ?? 4}
            onChange={(e) => setReport({ ...report, [key]: Number(e.target.value) })}
            onPointerUp={(e) => saveReport(Number((e.target as HTMLInputElement).value))}
            onKeyUp={(e) => saveReport(Number((e.target as HTMLInputElement).value))}
            className="w-full" style={{ accentColor: c.color }} />
        </div>

        {/* EXECPLAN-5: execution plans working on this chakra */}
        {planGoals.length > 0 && (
          <div className="mt-6">
            <div className="mb-1 text-xs uppercase tracking-wider text-white/40">Execution plan</div>
            <div className="space-y-2">
              {planGoals.map((g) => {
                const phases = g.executionPlan?.phases ?? [];
                const phaseIdx = Math.max(0, Math.min(g.currentPhaseIndex, phases.length - 1));
                return (
                  <Link key={g.id} href={`/self?tab=time&goalId=${g.id}`}
                    className="block rounded-xl border p-4 transition-colors hover:bg-white/[0.04]"
                    style={{ borderColor: `${c.color}26`, background: "rgba(8,8,14,0.62)" }}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">{g.title}</span>
                      {phases.length > 0 && (
                        <span className="text-[10px] whitespace-nowrap text-white/40">
                          Phase {phaseIdx + 1}/{phases.length}
                        </span>
                      )}
                    </div>
                    {g.executionPlan?.nextAction?.text && (
                      <p className="mt-1.5 text-xs text-white/60">→ {g.executionPlan.nextAction.text}</p>
                    )}
                    <span className="mt-2 inline-block text-xs font-medium" style={{ color: c.color }}>
                      Open the plan →
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* tagged todos */}
        <div className="mt-6">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-wider text-white/40">{t("chakra-todos", "To-dos")}</span>
            {list.length > 0 && <span className="text-[10px] text-white/30">{doneCount}/{list.length}</span>}
          </div>
          {list.length === 0 ? (
            <p className="text-sm text-white/40">{t("chakra-awaken", "Nothing here yet — ready to awaken.")}</p>
          ) : (
            <ul className="space-y-1">
              {list.map((td) => (
                <li key={td.id} className={`text-sm ${td.completed ? "text-white/30 line-through" : "text-white/80"}`}>• {td.title}</li>
              ))}
            </ul>
          )}
        </div>

        {/* primary CTA — the action surface; crown stays parked */}
        <div className="mt-8">
          {href ? (
            <Link href={href} className="block w-full rounded-xl py-3 text-center text-sm font-medium"
              style={{ background: c.color, color: "#0b0b10" }}>
              {t("chakra-goto", "Go to")} {surface} →
            </Link>
          ) : (
            <span className="block w-full rounded-xl bg-white/5 py-3 text-center text-sm text-white/30">
              {t("chakra-coming", "Coming soon")}
            </span>
          )}
        </div>
      </div>
    </main>
  );
}
