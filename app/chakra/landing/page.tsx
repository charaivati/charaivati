"use client";

// CHAKRA-1: the Self-layer chakra landing. A faint seated silhouette with 7
// glyphs glowing by openness score (visual inspiration only — no chakra names),
// over a scrollable list of interactive chakra cards: tagged todos, a 1–7
// self-report slider, and a deep-link into that chakra's real surface.
// 2D SVG is primary and static (no per-scroll transforms) so it stays smooth on
// low-end Android. Dormant framing is "ready to awaken", never "blocked".

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CHAKRAS } from "../chakras";
import { CHAKRA_KEYS, type ChakraKey } from "@/lib/chakra/keys";
import { useTranslations } from "@/hooks/useTranslations";

const DEEP_LINKS: Record<ChakraKey, string | null> = {
  root: "/earn",
  sacral: "/society",
  solar: "/self",
  heart: "/app/initiatives",
  throat: "/society",
  third_eye: "/listen",
  crown: null, // PARKED — Sahasrara not built (see TECH_DEBT.md)
};

const T_SLUGS = [
  "chakra-feel", "chakra-platform", "chakra-you", "chakra-open", "chakra-coming",
  "chakra-todos", "chakra-awaken", "chakra-saved", "chakra-title", "chakra-sub",
].join(",");

type Detail = { score: number; platform: number; self: number | null; platformOnly: boolean };
type Scores = Record<ChakraKey, Detail>;
type Todo = { id: string; title: string; completed: boolean; chakra: string | null };

// chakras.ts is index-ordered root→crown, same as CHAKRA_KEYS — zip by index.
const VIS = CHAKRA_KEYS.map((key, i) => ({ key, c: CHAKRAS[i] }));

export default function ChakraLanding() {
  const t = useTranslations(T_SLUGS);
  const [scores, setScores] = useState<Scores | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [report, setReport] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<ChakraKey | null>(null);
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
      <Link href="/self" className="fixed top-4 left-4 z-20 text-sm text-white/40 hover:text-white/80">← back</Link>

      {/* Inspirational figure: static silhouette + score-lit glyphs, no labels */}
      <section className="relative flex justify-center pt-16 pb-8"
        style={{ background: "radial-gradient(120% 80% at 50% 30%, #15102b 0%, #0a0712 55%, #000 100%)" }}>
        <svg viewBox="0 0 240 372" className="w-[min(72vw,320px)] h-auto" aria-hidden="true">
          <defs>
            <filter id="fg" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="8" /></filter>
            <filter id="og" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="5" /></filter>
          </defs>
          <g filter="url(#fg)" opacity="0.4"><Figure fill="#6d5bd0" /></g>
          <g><Figure fill="#05060a" /></g>
          {/* sushumna: segments between glyphs brighten by average openness */}
          {scores && VIS.slice(0, -1).map(({ key, c }, i) => {
            const next = VIS[i + 1];
            const a = 300 - c.spineY * 266, b = 300 - next.c.spineY * 266;
            const lit = ((scores[key].score + scores[next.key].score) / 2) / 100;
            return <line key={key} x1={120} y1={a} x2={120} y2={b} stroke="#fff"
              strokeWidth={2} style={{ opacity: 0.1 + lit * 0.7 }} />;
          })}
          {VIS.map(({ key, c }) => {
            const s = scores ? scores[key].score / 100 : 0.05;
            const y = 300 - c.spineY * 266;
            return (
              <g key={key}>
                <circle cx={120} cy={y} r={24} fill={c.color} filter="url(#og)" style={{ opacity: 0.15 + s * 0.6 }} />
                <circle cx={120} cy={y} r={3 + s * 5} fill="#fff" style={{ opacity: 0.4 + s * 0.6 }} />
                <circle cx={120} cy={y} r={9} fill="none" stroke={c.color} strokeWidth={1.5} style={{ opacity: 0.3 + s * 0.7 }} />
              </g>
            );
          })}
        </svg>
      </section>

      <div className="mx-auto max-w-md px-4 pb-24">
        <h1 className="text-center text-xl font-semibold">{t("chakra-title", "Your inner spine")}</h1>
        <p className="mt-1 mb-6 text-center text-sm text-white/40">{t("chakra-sub", "Where your energy is rising")}</p>

        {VIS.map(({ key, c }) => {
          const d = scores?.[key];
          const score = d?.score ?? 0;
          const dim = d ? d.score / 100 : 0.1;
          const list = todosByChakra.get(key) ?? [];
          const isOpen = open === key;
          const href = DEEP_LINKS[key];
          return (
            <div key={key} className="mb-3 rounded-2xl border" style={{ borderColor: `${c.color}40`, background: "#ffffff06" }}>
              <button onClick={() => setOpen(isOpen ? null : key)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg"
                  style={{ background: c.color, opacity: 0.3 + dim * 0.7, boxShadow: `0 0 ${4 + dim * 16}px ${c.color}` }}>
                  {c.bija}
                </span>
                <span className="flex-1">
                  {/* score bar — openness, no chakra name */}
                  <span className="block h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <span className="block h-full rounded-full" style={{ width: `${score}%`, background: c.color }} />
                  </span>
                </span>
                <span className="w-9 shrink-0 text-right text-xs text-white/50">{score}</span>
              </button>

              {isOpen && d && (
                <div className="space-y-4 px-4 pb-4">
                  {/* self-report slider — felt sense, framed as insight not deficiency */}
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-white/50">
                      <span>{t("chakra-feel", "How does this feel?")}</span>
                      {saved === key && <span style={{ color: c.color }}>{t("chakra-saved", "Saved ✓")}</span>}
                    </div>
                    <input type="range" min={1} max={7} step={1} value={report[key] ?? 4}
                      onChange={(e) => setReport({ ...report, [key]: Number(e.target.value) })}
                      onPointerUp={(e) => saveReport(key, Number((e.target as HTMLInputElement).value))}
                      onKeyUp={(e) => saveReport(key, Number((e.target as HTMLInputElement).value))}
                      className="w-full" style={{ accentColor: c.color }} />
                    <div className="mt-1 text-xs text-white/40">
                      {t("chakra-platform", "Platform sees")} {d.platform}
                      {d.self !== null && <> · {t("chakra-you", "you feel")} {d.self}</>}
                    </div>
                  </div>

                  {/* tagged todos */}
                  <div>
                    <div className="mb-1 text-xs uppercase tracking-wider text-white/40">{t("chakra-todos", "To-dos")}</div>
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

                  {href ? (
                    <Link href={href} className="inline-block rounded-lg px-3 py-1.5 text-sm font-medium"
                      style={{ background: `${c.color}30`, color: c.color }}>
                      {t("chakra-open", "Open")} →
                    </Link>
                  ) : (
                    <span className="inline-block rounded-lg bg-white/5 px-3 py-1.5 text-sm text-white/30">
                      {t("chakra-coming", "Coming soon")}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

// Minimal seated padmasana silhouette (from the /chakra/svg prototype).
function Figure({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      <ellipse cx="120" cy="62" rx="27" ry="31" />
      <path d="M93 92 Q120 84 147 92 L150 150 Q150 200 138 232 L102 232 Q90 200 90 150 Z" />
      <ellipse cx="120" cy="312" rx="110" ry="52" />
      <path d="M150 104 C196 130 210 250 196 300 C188 312 168 312 162 300 C150 250 140 150 138 118 Z" />
      <path d="M90 104 C44 130 30 250 44 300 C52 312 72 312 78 300 C90 250 100 150 102 118 Z" />
      <ellipse cx="46" cy="300" rx="24" ry="16" />
      <ellipse cx="194" cy="300" rx="24" ry="16" />
    </g>
  );
}
