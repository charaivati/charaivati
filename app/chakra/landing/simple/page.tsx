"use client";

// CHAKRA-UI-4: /chakra/landing/simple — the monochrome, zero-animation variant
// of the chakra landing. Same data (GET /api/chakra signals, tagged todos,
// self-report via PATCH /api/user/profile) and the same flow into the
// /chakra/[key] middle layer — but black & white only, a plain static list,
// no transitions/keyframes/camera/stars. For low-end devices and anyone who
// prefers a quiet page. Dormant framing stays "ready to awaken".

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CHAKRAS } from "../../chakras";
import { CHAKRA_KEYS, type ChakraKey } from "@/lib/chakra/keys";
import { useTranslations } from "@/hooks/useTranslations";
import { CHAKRA_SYMBOL } from "../../chakraSymbols";
import { REMARK_EN, SURFACE_EN, SIGNAL_EN } from "../../meta";

const T_SLUGS = [
  "chakra-title", "chakra-sub", "chakra-platform", "chakra-you",
  "chakra-add-reflection", "chakra-feel", "chakra-saved", "chakra-todos",
  "chakra-awaken", "chakra-details", "chakra-signals", "chakra-overall",
  "chakra-journey",
  ...Object.keys(SIGNAL_EN).map((k) => `chakra-signal-${k}`),
  ...CHAKRA_KEYS.map((k) => `chakra-remark-${k}`),
  ...CHAKRA_KEYS.map((k) => `chakra-surface-${k}`),
].join(",");

type Signal = { key: string; value: number };
type Detail = { score: number; platform: number; self: number | null; platformOnly: boolean; signals?: Signal[] };
type Scores = Record<ChakraKey, Detail>;
type Todo = { id: string; title: string; completed: boolean; chakra: string | null };

// chakras.ts is index-ordered root→crown, same as CHAKRA_KEYS — zip by index.
const VIS = CHAKRA_KEYS.map((key, i) => ({ key, c: CHAKRAS[i] }));

export default function ChakraLandingSimple() {
  const t = useTranslations(T_SLUGS);
  const [scores, setScores] = useState<Scores | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [report, setReport] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<ChakraKey | null>(null);

  useEffect(() => {
    fetch("/api/chakra").then((r) => r.json()).then((j) => j.ok && setScores(j.scores)).catch(() => {});
    fetch("/api/self/todos").then((r) => r.json()).then((j) => j.ok && setTodos(j.data)).catch(() => {});
    fetch("/api/user/profile").then((r) => r.json())
      .then((j) => j.ok && j.profile?.chakraSelfReport && setReport(j.profile.chakraSelfReport)).catch(() => {});
  }, []);

  const todosByChakra = useMemo(() => {
    const m = new Map<string, Todo[]>();
    for (const td of todos) if (td.chakra) (m.get(td.chakra) ?? m.set(td.chakra, []).get(td.chakra)!).push(td);
    return m;
  }, [todos]);

  const overall = useMemo(
    () => (scores ? Math.round(CHAKRA_KEYS.reduce((s, k) => s + scores[k].score, 0) / CHAKRA_KEYS.length) : null),
    [scores],
  );

  function saveReport(key: ChakraKey, value: number) {
    const next = { ...report, [key]: value };
    setReport(next);
    fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chakraSelfReport: next }),
    }).then(() => { setSaved(key); setTimeout(() => setSaved(null), 1500); }).catch(() => {});
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-md px-4 pb-12 pt-6">
        <div className="mb-6 flex items-center justify-between text-sm text-white/40">
          <Link href="/self" className="hover:text-white/80">← back</Link>
          <Link href="/chakra/landing" className="hover:text-white/80">{t("chakra-journey", "Journey")} →</Link>
        </div>

        <header className="mb-8">
          <h1 className="text-2xl font-semibold">{t("chakra-title", "Your inner spine")}</h1>
          <p className="mt-1 text-sm text-white/50">{t("chakra-sub", "Where your energy is rising")}</p>
          {overall !== null && (
            <div className="mt-3 text-sm text-white/50">
              {t("chakra-overall", "Overall openness")}: <span className="font-medium text-white">{overall}</span>
              <span className="text-white/30"> / 100</span>
            </div>
          )}
        </header>

        <div className="space-y-4">
          {VIS.map(({ key, c }, idx) => {
            const d = scores?.[key];
            const list = todosByChakra.get(key) ?? [];
            const doneCount = list.filter((td) => td.completed).length;
            const surface = t(`chakra-surface-${key}`, SURFACE_EN[key]);
            return (
              <section key={key} className="rounded-xl border border-white/15 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <svg viewBox="-56 -56 112 112" className="h-12 w-12 shrink-0">
                      <g fill="none" stroke="#fff" strokeWidth={2.5} strokeLinejoin="round" opacity={0.85}>
                        {CHAKRA_SYMBOL[key]}
                      </g>
                    </svg>
                    <div>
                      <h2 className="font-medium">{c.sanskrit}</h2>
                      <div className="text-xs text-white/40">{surface ? `${surface} · ` : ""}{idx + 1} / 7</div>
                    </div>
                  </div>
                  <div className="text-2xl font-semibold">
                    {d?.score ?? 0}<span className="text-sm text-white/30"> / 100</span>
                  </div>
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-white/80" style={{ width: `${d?.score ?? 0}%` }} />
                </div>

                <div className="mt-2 text-sm text-white/50">
                  {t("chakra-platform", "Platform sees")} {d?.platform ?? 0}
                  {d && !d.platformOnly && d.self !== null
                    ? <> · {t("chakra-you", "you feel")} {d.self}</>
                    : <span className="text-white/30"> · {t("chakra-add-reflection", "add your reflection")}</span>}
                </div>
                <p className="mt-2 text-sm text-white/70">{t(`chakra-remark-${key}`, REMARK_EN[key])}</p>

                {d?.signals && d.signals.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-2 text-xs uppercase tracking-wider text-white/40">{t("chakra-signals", "What lights this")}</div>
                    <div className="space-y-1.5">
                      {d.signals.map((sg) => (
                        <div key={sg.key} className="flex items-center gap-2">
                          <span className="w-28 shrink-0 text-xs text-white/50">{t(`chakra-signal-${sg.key}`, SIGNAL_EN[sg.key] ?? sg.key)}</span>
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-white/60" style={{ width: `${sg.value}%` }} />
                          </div>
                          <span className="w-7 shrink-0 text-right text-[10px] text-white/40">{sg.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-white/50">
                    <span>{t("chakra-feel", "How does this feel?")}</span>
                    {saved === key && <span className="text-white">{t("chakra-saved", "Saved ✓")}</span>}
                  </div>
                  <input type="range" min={1} max={7} step={1} value={report[key] ?? 4}
                    onChange={(e) => setReport({ ...report, [key]: Number(e.target.value) })}
                    onPointerUp={(e) => saveReport(key, Number((e.target as HTMLInputElement).value))}
                    onKeyUp={(e) => saveReport(key, Number((e.target as HTMLInputElement).value))}
                    className="w-full" style={{ accentColor: "#fff" }} />
                </div>

                <div className="mt-4">
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

                <div className="mt-4">
                  <Link href={`/chakra/${key}`}
                    className="block w-full rounded-lg border border-white/25 py-2 text-center text-sm font-medium text-white hover:bg-white/10">
                    {t("chakra-details", "View details")} →
                  </Link>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
