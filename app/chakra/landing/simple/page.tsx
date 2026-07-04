"use client";

// CHAKRA-UI-4b: /chakra/landing/simple — monochrome variant of the chakra
// landing that KEEPS the silhouette SVG and the scroll journey (seven
// full-viewport stages, pinned figure, camera pan, IntersectionObserver stage
// flips) but drops every ambient/decorative animation and all colour:
// no starfield, no shooting stars, no water reflection, no breathing halo,
// no yantra spin, no rising energy pulse — white line-art only. Transitions
// that respond to scrolling (camera pan, glyph/spine lighting, bar fills)
// stay: nothing moves while the page is at rest. Same data + the same
// "View details →" flow into /chakra/[key]. Dormant is "ready to awaken".

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CHAKRAS } from "../../chakras";
import { CHAKRA_KEYS, type ChakraKey } from "@/lib/chakra/keys";
import { useTranslations } from "@/hooks/useTranslations";
import { FigureBody } from "../figureBody";
import { CHAKRA_SYMBOL } from "../../chakraSymbols";
import { REMARK_EN, SURFACE_EN, SIGNAL_EN } from "../../meta";

// Same spine anchors + viewBox as the full landing (see landing/page.tsx).
const SPINE_X = 510;
const ANCHORS: Record<ChakraKey, { x: number; y: number }> = {
  crown:     { x: SPINE_X, y: 155 },
  third_eye: { x: SPINE_X, y: 225 },
  throat:    { x: SPINE_X + 3, y: 325 },
  heart:     { x: SPINE_X + 4, y: 440 },
  solar:     { x: SPINE_X + 4, y: 547 },
  sacral:    { x: SPINE_X + 4, y: 618 },
  root:      { x: SPINE_X + 4, y: 675 },
};
const VB = { x: 200, y: 100, w: 620, h: 1000 };

const T_SLUGS = [
  "chakra-feel", "chakra-platform", "chakra-you",
  "chakra-todos", "chakra-awaken", "chakra-saved", "chakra-title", "chakra-sub",
  "chakra-add-reflection", "chakra-scroll", "chakra-overall",
  "chakra-signals", "chakra-details", "chakra-journey",
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

const RING_R = 26;
const RING_C = 2 * Math.PI * RING_R;
const WHITE = "#ffffff";

export default function ChakraLandingSimple() {
  const router = useRouter();
  const t = useTranslations(T_SLUGS);
  const [scores, setScores] = useState<Scores | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [report, setReport] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<ChakraKey | null>(null);
  const [stage, setStage] = useState(0); // 0=root … 6=crown — the awakened frontier

  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  // Stage detection — same discrete IntersectionObserver flip as the landing.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const idx = Number((e.target as HTMLElement).dataset.stage);
          if (!Number.isNaN(idx)) setStage(idx);
        }
      },
      { threshold: 0.55 },
    );
    sectionRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // Camera — same math as the landing: pan/zoom the pinned figure so the
  // active chakra sits above (mobile) or beside (desktop) the stage card.
  const [cam, setCam] = useState<{ ty: number; z: number } | null>(null);
  useEffect(() => {
    const compute = () => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const lg = vw >= 1024;
      const W = Math.min(vw * 0.8, 340);
      const u = W / VB.w;
      const H = VB.h * u;
      const z = lg ? 1.5 : 1.35;
      const target = vh * (lg ? 0.46 : 0.33);
      const off = (ANCHORS[CHAKRA_KEYS[stage]].y - VB.y) * u - H / 2;
      setCam({ ty: target - vh / 2 - off * z, z });
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [stage]);

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

  function goTo(idx: number) {
    sectionRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="relative bg-black text-white">
      {/* Pinned figure — monochrome, no stars/water; camera pans per stage */}
      <div className="fixed inset-0 z-0">
        <div className="absolute left-1/2 top-1/2 lg:left-[30%]" style={{ transform: "translate(-50%,-50%)" }}>
          <div style={{
            transform: cam ? `translateY(${cam.ty}px) scale(${cam.z})` : undefined,
            transition: "transform .9s cubic-bezier(.22,1,.36,1)",
          }}>
            <svg viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} className="h-auto w-[min(80vw,340px)]">
              <defs>
                {/* rim-glow via feGaussianBlur (WebView-safe — no feMorphology) */}
                <filter id="bodyAura" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="14" /></filter>
                <filter id="og" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="10" /></filter>
              </defs>
              <FigureBody />
              {/* sushumna: spine segments light up to the awakened frontier */}
              {VIS.slice(0, -1).map(({ key }, i) => {
                const next = VIS[i + 1];
                const a = ANCHORS[key], b = ANCHORS[next.key];
                const lit = scores ? ((scores[key].score + scores[next.key].score) / 2) / 100 : 0.1;
                const passed = i < stage;
                return <line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={WHITE}
                  strokeWidth={3} style={{ opacity: passed ? 0.15 + lit * 0.65 : 0.05, transition: "opacity 1s ease" }} />;
              })}
              {VIS.map(({ key, c }, idx) => {
                const s = scores ? scores[key].score / 100 : 0.05;
                const awakened = idx <= stage;
                const active = idx === stage;
                const { x, y } = ANCHORS[key];
                // minimal colour: only the ACTIVE chakra shows its colour; the
                // rest of the figure stays quiet white line-art.
                const tint = active ? c.color : WHITE;
                return (
                  // tapping the active glyph opens its detail page; others scroll to their stage
                  <g key={key} onClick={() => (idx === stage ? router.push(`/chakra/${key}`) : goTo(idx))} style={{ cursor: "pointer" }}>
                    <circle cx={x} cy={y} r={26} fill={tint} filter="url(#og)"
                      style={{ opacity: awakened ? 0.05 + s * 0.22 : 0.02, transition: "opacity 1.1s ease" }} />
                    {active && (
                      <circle cx={x} cy={y} r={34} fill="none" stroke={c.color} strokeWidth={1.5} opacity={0.55} />
                    )}
                    <g transform={`translate(${x} ${y}) scale(0.62)`} fill="none" stroke={tint} strokeWidth={2.5}
                      strokeLinejoin="round"
                      style={{ opacity: awakened ? 0.55 + s * 0.45 : 0.14, transition: "opacity 1.1s ease, stroke .6s ease" }}>
                      {CHAKRA_SYMBOL[key]}
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      <div className="fixed top-4 left-4 right-4 z-20 flex justify-between text-sm text-white/40">
        <Link href="/self" className="hover:text-white/80">← back</Link>
        <Link href="/chakra/landing" className="hover:text-white/80">{t("chakra-journey", "Journey")} →</Link>
      </div>

      {/* Progress rail — root at bottom, crown at top, mirroring the body */}
      <div className="fixed right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col-reverse gap-2.5">
        {VIS.map(({ c }, idx) => (
          <button key={c.key} onClick={() => goTo(idx)} aria-label={c.sanskrit}
            className="h-3 w-3 rounded-full"
            style={{ background: idx === stage ? c.color : idx < stage ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.15)",
              transform: idx === stage ? "scale(1.5)" : "scale(1)",
              transition: "transform .3s ease, background .5s ease" }} />
        ))}
      </div>

      {/* The journey: one full-viewport stage per chakra, root → crown */}
      <div className="pointer-events-none relative z-10">
        {VIS.map(({ key, c }, idx) => {
          const d = scores?.[key];
          const list = todosByChakra.get(key) ?? [];
          const doneCount = list.filter((td) => td.completed).length;
          const active = idx === stage;
          const awakened = idx <= stage;
          const surface = t(`chakra-surface-${key}`, SURFACE_EN[key]);
          return (
            <section key={key} data-stage={idx}
              ref={(el) => { sectionRefs.current[idx] = el; }}
              className="relative flex min-h-screen flex-col items-center justify-start pl-4 pr-9 pb-8 pt-[40vh] lg:items-end lg:justify-center lg:pt-16 lg:pr-[20vw]">
              {idx === 0 && (
                <header className="pointer-events-auto absolute top-14 left-0 right-0 text-center">
                  <h1 className="text-2xl font-semibold">{t("chakra-title", "Your inner spine")}</h1>
                  <p className="mt-1 text-sm text-white/50">{t("chakra-sub", "Where your energy is rising")}</p>
                </header>
              )}

              <div className="pointer-events-auto w-full max-w-sm overflow-y-auto rounded-2xl border p-5 max-h-[52vh] lg:max-h-[64vh]"
                style={{ borderColor: active ? `${c.color}66` : "rgba(255,255,255,0.12)",
                  background: "rgba(8,8,10,0.85)",
                  opacity: active ? 1 : 0.38,
                  transition: "opacity .6s ease, border-color .8s ease" }}>
                {/* header: bija + names + score ring */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border text-xl"
                      style={{ borderColor: `${c.color}88`, background: `${c.color}18` }}>{c.bija}</span>
                    <div>
                      <div className="font-medium">{c.sanskrit}</div>
                      <div className="text-xs text-white/40">{surface ? `${surface} · ` : ""}{idx + 1} / 7</div>
                    </div>
                  </div>
                  <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0">
                    <circle cx="32" cy="32" r={RING_R} stroke="rgba(255,255,255,0.1)" strokeWidth="4" fill="none" />
                    <circle cx="32" cy="32" r={RING_R} stroke={c.color} strokeWidth="4" fill="none" strokeLinecap="round"
                      strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - (awakened ? (d?.score ?? 0) : 0) / 100)}
                      transform="rotate(-90 32 32)" style={{ transition: "stroke-dashoffset 1.2s ease .25s" }} />
                    <text x="32" y="37" textAnchor="middle" fill="#fff" fontSize="15" fontWeight="600">{d?.score ?? 0}</text>
                  </svg>
                </div>

                {/* measured vs felt */}
                <div className="mt-3 text-sm text-white/50">
                  {t("chakra-platform", "Platform sees")} {d?.platform ?? 0}
                  {d && !d.platformOnly && d.self !== null
                    ? <> · {t("chakra-you", "you feel")} {d.self}</>
                    : <span className="text-white/30"> · {t("chakra-add-reflection", "add your reflection")}</span>}
                </div>

                {/* calm remark */}
                <p className="mt-2 text-sm text-white/70">{t(`chakra-remark-${key}`, REMARK_EN[key])}</p>

                {/* per-signal breakdown */}
                {d?.signals && d.signals.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-2 text-xs uppercase tracking-wider text-white/40">{t("chakra-signals", "What lights this")}</div>
                    <div className="space-y-1.5">
                      {d.signals.map((sg) => (
                        <div key={sg.key} className="flex items-center gap-2">
                          <span className="w-28 shrink-0 text-xs text-white/50">{t(`chakra-signal-${sg.key}`, SIGNAL_EN[sg.key] ?? sg.key)}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full"
                              style={{ width: awakened ? `${sg.value}%` : "0%", background: c.color, opacity: 0.85, transition: "width 1s ease .3s" }} />
                          </div>
                          <span className="w-7 shrink-0 text-right text-[10px] text-white/40">{sg.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* crown stage doubles as the journey summary */}
                {key === "crown" && overall !== null && (
                  <div className="mt-4 rounded-xl bg-white/5 p-3">
                    <div className="text-xs uppercase tracking-wider text-white/40">{t("chakra-overall", "Overall openness")}</div>
                    <div className="mt-1 text-2xl font-semibold">{overall}<span className="text-sm text-white/30"> / 100</span></div>
                    <div className="mt-2 flex gap-1.5">
                      {VIS.map(({ key: k, c: cc }) => (
                        <span key={k} className="h-2 flex-1 rounded-full"
                          style={{ background: cc.color, opacity: 0.2 + ((scores?.[k].score ?? 0) / 100) * 0.8 }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* self-report slider */}
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-white/50">
                    <span>{t("chakra-feel", "How does this feel?")}</span>
                    {saved === key && <span style={{ color: c.color }}>{t("chakra-saved", "Saved ✓")}</span>}
                  </div>
                  <input type="range" min={1} max={7} step={1} value={report[key] ?? 4}
                    onChange={(e) => setReport({ ...report, [key]: Number(e.target.value) })}
                    onPointerUp={(e) => saveReport(key, Number((e.target as HTMLInputElement).value))}
                    onKeyUp={(e) => saveReport(key, Number((e.target as HTMLInputElement).value))}
                    className="w-full" style={{ accentColor: c.color }} />
                </div>

                {/* tagged todos */}
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

                {/* CTA into the middle layer */}
                <div className="mt-5">
                  <Link href={`/chakra/${key}`}
                    className="block w-full rounded-xl border py-2.5 text-center text-sm font-medium text-white hover:bg-white/10"
                    style={{ borderColor: `${c.color}66` }}>
                    {t("chakra-details", "View details")} →
                  </Link>
                </div>
              </div>

              {idx === 0 && (
                <div className="pointer-events-none mt-4 text-center text-xs text-white/50">
                  {t("chakra-scroll", "Scroll to rise")} ↓
                </div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
