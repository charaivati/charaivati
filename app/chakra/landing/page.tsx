"use client";

// CHAKRA-1 → CHAKRA-UI-2: the Self-layer chakra landing as a SCROLL JOURNEY.
// Seven full-viewport stages ascend root → crown over a pinned scene (starfield,
// water reflection, seated silhouette). The "camera" pans up the body one stage
// at a time; each chakra awakens (glow ramps, yantra spins, halo breathes) as
// its stage enters. Stage cards render inline — score ring, platform-vs-felt,
// per-signal breakdown bars, self-report slider, tagged todos, deep-link.
// Performance doctrine: IntersectionObserver flips a discrete stage index and
// CSS transitions/keyframes do ALL the motion — no per-frame scroll JS — so it
// stays smooth on low-end Android. Dormant framing is "ready to awaken", never
// "blocked". prefers-reduced-motion disables the ambient loops.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CHAKRAS } from "../chakras";
import { CHAKRA_KEYS, type ChakraKey } from "@/lib/chakra/keys";
import { useTranslations } from "@/hooks/useTranslations";
import { FigureBody } from "./figureBody";
import { CHAKRA_SYMBOL } from "../chakraSymbols";
import { REMARK_EN, SURFACE_EN, SIGNAL_EN } from "../meta";

// CHAKRA-5: glyphs share ONE vertical axis = the body's real spine (x≈510 in the
// 0 0 1024 1024 trace space). y placed head→seat, root raised to sit ON the seat.
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
// viewBox constants the camera math depends on (must match the <svg> below).
const VB = { x: 200, y: 100, w: 620, h: 1000 };

// CHAKRA-UI-3: DEEP_LINKS / REMARK_EN / SURFACE_EN / SIGNAL_EN moved to
// app/chakra/meta.ts (shared with the /chakra/[key] detail pages). The card's
// CTA now goes to the detail page (middle layer), which owns the action link.

const T_SLUGS = [
  "chakra-feel", "chakra-platform", "chakra-you",
  "chakra-todos", "chakra-awaken", "chakra-saved", "chakra-title", "chakra-sub",
  "chakra-add-reflection", "chakra-scroll", "chakra-overall",
  "chakra-signals", "chakra-details",
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

// Deterministic starfield (Math.sin hash, not Math.random) so SSR/client match.
const STARS = Array.from({ length: 70 }, (_, i) => {
  const r = (n: number) => { const x = Math.sin(i * 9301 + n * 49297) * 233280; return x - Math.floor(x); };
  return { top: r(1) * 100, left: r(2) * 100, size: 1 + r(3) * 1.6, delay: r(4) * 4, dur: 2 + r(5) * 3 };
});

const RING_R = 26;
const RING_C = 2 * Math.PI * RING_R;

export default function ChakraLanding() {
  const router = useRouter();
  const t = useTranslations(T_SLUGS);
  const [scores, setScores] = useState<Scores | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [report, setReport] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<ChakraKey | null>(null);
  const [stage, setStage] = useState(0); // 0=root … 6=crown — the awakened frontier
  const [mounted, setMounted] = useState(false); // stars render client-only (no SSR hydration mismatch)
  useEffect(() => setMounted(true), []);

  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  // Stage detection: IntersectionObserver flips the discrete stage index; every
  // visual change downstream is a CSS transition. No scroll-position math.
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

  // Camera: translate/scale the pinned figure so the active chakra sits in the
  // clear zone above (mobile) or beside (desktop) the stage card. Recomputed
  // only on stage change / resize — the 0.9s transform transition is the pan.
  const [cam, setCam] = useState<{ ty: number; z: number; lineY: number } | null>(null);
  useEffect(() => {
    const compute = () => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const lg = vw >= 1024;
      const W = Math.min(vw * 0.8, 340);           // rendered svg width (matches class below)
      const u = W / VB.w;                           // px per viewBox unit
      const H = VB.h * u;                           // rendered svg height
      const z = lg ? 1.5 : 1.35;                    // zoom so ~3 chakras fill the view
      const target = vh * (lg ? 0.46 : 0.33);       // where the active glyph should sit
      const off = (ANCHORS[CHAKRA_KEYS[stage]].y - VB.y) * u - H / 2; // glyph offset from svg centre
      const ty = target - vh / 2 - off * z;
      const rootOff = (ANCHORS.root.y - VB.y) * u - H / 2;
      setCam({ ty, z, lineY: vh / 2 + rootOff * z + ty });
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [stage]);

  // Shooting stars: spawn one at a random spot every 3–12s, remove after it falls.
  const [shooting, setShooting] = useState<{ id: number; top: number; left: number; len: number; dur: number }[]>([]);
  useEffect(() => {
    let alive = true, timer: ReturnType<typeof setTimeout>;
    const spawn = () => {
      if (!alive) return;
      const id = Date.now() + Math.random();
      const s = { id, top: Math.random() * 45, left: 15 + Math.random() * 70, len: 60 + Math.random() * 90, dur: 0.8 + Math.random() * 0.7 };
      setShooting((p) => [...p, s]);
      setTimeout(() => setShooting((p) => p.filter((x) => x.id !== id)), s.dur * 1000 + 200);
      timer = setTimeout(spawn, 3000 + Math.random() * 9000);
    };
    timer = setTimeout(spawn, 2000 + Math.random() * 3000);
    return () => { alive = false; clearTimeout(timer); };
  }, []);

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

  // Orbiting starfield, reused for the real layer and its mirror.
  const starField = (
    <div className="absolute" style={{ top: "50%", left: "50%", width: "170vmax", height: "170vmax", transform: "translate(-50%,-50%)" }}>
      <div style={{ width: "100%", height: "100%", transformOrigin: "center", animation: "chakraOrbit 220s linear infinite" }}>
        {STARS.map((s, i) => (
          <span key={i} style={{ position: "absolute", top: `${s.top}%`, left: `${s.left}%`,
            width: s.size, height: s.size, borderRadius: "50%", background: "#fff",
            animation: `chakraTwinkle ${s.dur}s ease-in-out ${s.delay}s infinite` }} />
        ))}
      </div>
    </div>
  );
  // Water line = root glyph's screen centre, derived from the same camera math
  // (no DOM measurement), so it follows the figure's pan.
  const LINE_TOP = cam ? `${cam.lineY}px` : "66%";
  const BELOW_INSET = cam ? `calc(100% - ${cam.lineY}px)` : "34%";
  const ABOVE_LINE_CLIP = `inset(0 0 ${BELOW_INSET} 0)`; // keep only above the line

  // Shooting stars, reused for the real layer and its mirror.
  const shootField = shooting.map((s) => (
    <span key={s.id} style={{ position: "absolute", top: `${s.top}%`, left: `${s.left}%`,
      width: s.len, height: 2, borderRadius: 2, transformOrigin: "left center",
      background: "linear-gradient(90deg, transparent, #fff)",
      animation: `chakraShoot ${s.dur}s ease-out forwards` }} />
  ));

  const activeKey = CHAKRA_KEYS[stage];

  return (
    <main className="relative bg-black text-white">
      <style>{`
        @keyframes chakraCardIn { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: none; } }
        @keyframes chakraTwinkle { 0%,100% { opacity: .15; } 50% { opacity: 1; } }
        @keyframes chakraOrbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes chakraShoot { 0% { transform: translate3d(0,0,0) rotate(40deg); opacity: 0; } 12% { opacity: 1; } 100% { transform: translate3d(240px,200px,0) rotate(40deg); opacity: 0; } }
        @keyframes chakraShimmer { from { background-position: 220% 0; } to { background-position: -220% 0; } }
        @keyframes chakraSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes chakraBreathe { 0%,100% { transform: scale(1); opacity: .35; } 50% { transform: scale(1.18); opacity: .8; } }
        @keyframes chakraRise { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: .9; } 85% { opacity: .9; } 100% { transform: translateY(var(--rise)); opacity: 0; } }
        @keyframes chakraHint { 0%,100% { transform: translateY(0); opacity: .5; } 50% { transform: translateY(6px); opacity: 1; } }
        .chakra-spin { animation: chakraSpin 48s linear infinite; }
        .chakra-breathe { animation: chakraBreathe 3.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .chakra-spin, .chakra-breathe { animation: none; }
          .chakra-rise, .chakra-hint { display: none; }
        }
      `}</style>

      {/* ── Pinned scene: stars, water, figure. Content scrolls over it. ── */}
      {mounted && (
        <>
          <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
            style={{ clipPath: ABOVE_LINE_CLIP }}>{starField}</div>
          <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
            style={{ clipPath: ABOVE_LINE_CLIP, transform: "scaleY(-1)", transformOrigin: `50% ${LINE_TOP}` }}>{starField}</div>
          <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
            style={{ clipPath: ABOVE_LINE_CLIP }}>{shootField}</div>
          <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
            style={{ clipPath: ABOVE_LINE_CLIP, transform: "scaleY(-1)", transformOrigin: `50% ${LINE_TOP}` }}>{shootField}</div>
        </>
      )}

      {/* Water body below the line — blurs + darkens the reflected stars; slow
          caustic sheen for movement. `top` transitions with the camera pan. */}
      <div aria-hidden className="pointer-events-none fixed left-0 right-0 bottom-0 z-0 overflow-hidden"
        style={{ top: LINE_TOP, transition: "top .9s cubic-bezier(.22,1,.36,1)",
          backdropFilter: "blur(1.5px)", WebkitBackdropFilter: "blur(1.5px)",
          background: "linear-gradient(to bottom, rgba(255,255,255,0.12), rgba(255,255,255,0.06) 60%, rgba(255,255,255,0.03))" }}>
        <div style={{ position: "absolute", inset: "-20% -20%", backgroundSize: "180% 100%",
          background: "linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.08) 50%, transparent 70%)",
          animation: "chakraShimmer 14s linear infinite" }} />
      </div>
      <div aria-hidden className="pointer-events-none fixed left-0 right-0 z-0"
        style={{ top: LINE_TOP, height: 1, transition: "top .9s cubic-bezier(.22,1,.36,1)",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)" }} />

      {/* Figure — vertically centred wrapper, camera transform pans/zooms to the
          active chakra. On lg the figure sits left so cards get the right half. */}
      <div className="fixed inset-0 z-0">
        <div className="absolute left-1/2 top-1/2 lg:left-[30%]" style={{ transform: "translate(-50%,-50%)" }}>
          <div style={{
            transform: cam ? `translateY(${cam.ty}px) scale(${cam.z})` : undefined,
            transition: "transform .9s cubic-bezier(.22,1,.36,1)",
            background: "radial-gradient(closest-side, rgba(255,255,255,0.10), transparent 75%)",
          }}>
            <svg viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} className="h-auto w-[min(80vw,340px)]">
              <defs>
                {/* rim-glow via feGaussianBlur (WebView-safe — no feMorphology) */}
                <filter id="bodyAura" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="14" /></filter>
                {/* tighter blur → distinct, saturated bands instead of a muddy blend */}
                <filter id="og" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="10" /></filter>
              </defs>
              <FigureBody />
              {/* sushumna: spine segments light up to the awakened frontier */}
              {VIS.slice(0, -1).map(({ key }, i) => {
                const next = VIS[i + 1];
                const a = ANCHORS[key], b = ANCHORS[next.key];
                const lit = scores ? ((scores[key].score + scores[next.key].score) / 2) / 100 : 0.1;
                const passed = i < stage;
                return <line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#fff"
                  strokeWidth={3} style={{ opacity: passed ? 0.15 + lit * 0.65 : 0.05, transition: "opacity 1s ease" }} />;
              })}
              {/* energy pulse rising from root to the active chakra */}
              {stage > 0 && (
                <circle className="chakra-rise" cx={SPINE_X + 2} cy={ANCHORS.root.y} r={4.5} fill="#fff"
                  style={{ "--rise": `${ANCHORS[activeKey].y - ANCHORS.root.y}px`,
                    animation: "chakraRise 2.8s ease-in-out infinite", opacity: 0 } as CSSProperties} />
              )}
              {VIS.map(({ key, c }, idx) => {
                const s = scores ? scores[key].score / 100 : 0.05;
                const awakened = idx <= stage;
                const active = idx === stage;
                const { x, y } = ANCHORS[key];
                return (
                  // tapping the active glyph opens its detail page; others scroll to their stage
                  <g key={key} onClick={() => (idx === stage ? router.push(`/chakra/${key}`) : goTo(idx))} style={{ cursor: "pointer" }}>
                    {/* soft glow, breathing halo when active, then the line-art yantra */}
                    <circle cx={x} cy={y} r={26} fill={c.color} filter="url(#og)"
                      style={{ opacity: awakened ? 0.08 + s * 0.3 : 0.02, transition: "opacity 1.1s ease" }} />
                    {active && (
                      <circle className="chakra-breathe" cx={x} cy={y} r={34} fill="none" stroke={c.color} strokeWidth={1.5}
                        style={{ transformBox: "fill-box", transformOrigin: "center" }} />
                    )}
                    <g transform={`translate(${x} ${y}) scale(0.62)`} fill="none" stroke={c.color} strokeWidth={2.5}
                      strokeLinejoin="round">
                      <g className={active ? "chakra-spin" : undefined}
                        style={{ transformBox: "fill-box", transformOrigin: "center",
                          opacity: awakened ? 0.55 + s * 0.45 : 0.14, transition: "opacity 1.1s ease" }}>
                        {CHAKRA_SYMBOL[key]}
                      </g>
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      <Link href="/self" className="fixed top-4 left-4 z-20 text-sm text-white/40 hover:text-white/80">← back</Link>

      {/* Progress rail — root at bottom, crown at top, mirroring the body */}
      <div className="fixed right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col-reverse gap-2.5">
        {VIS.map(({ key, c }, idx) => (
          <button key={key} onClick={() => goTo(idx)} aria-label={c.sanskrit}
            className="h-3 w-3 rounded-full"
            style={{ background: idx <= stage ? c.color : "rgba(255,255,255,0.15)",
              transform: idx === stage ? "scale(1.5)" : "scale(1)",
              boxShadow: idx === stage ? `0 0 10px ${c.color}` : "none",
              transition: "transform .3s ease, background .5s ease, box-shadow .5s ease" }} />
        ))}
      </div>

      {/* ── The journey: one full-viewport stage per chakra, root → crown ── */}
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
              className="relative flex min-h-screen flex-col items-center justify-start pl-4 pr-9 pb-8 pt-[40vh] lg:items-end lg:justify-center lg:pt-16 lg:pr-[9vw]">
              {idx === 0 && (
                <header className="pointer-events-auto absolute top-14 left-0 right-0 text-center" style={{ animation: "chakraCardIn .5s ease-out" }}>
                  <h1 className="text-2xl font-semibold">{t("chakra-title", "Your inner spine")}</h1>
                  <p className="mt-1 text-sm text-white/50">{t("chakra-sub", "Where your energy is rising")}</p>
                </header>
              )}

              <div className="pointer-events-auto w-full max-w-sm overflow-y-auto rounded-2xl border p-5 backdrop-blur-md max-h-[52vh] lg:max-h-[64vh]"
                style={{ borderColor: `${c.color}${active ? "66" : "26"}`, background: "rgba(8,8,14,0.62)",
                  boxShadow: active ? `0 0 44px -14px ${c.color}` : "none",
                  opacity: active ? 1 : 0.38,
                  transform: active ? "none" : "translateY(10px)",
                  transition: "opacity .6s ease, transform .6s ease, box-shadow .8s ease, border-color .8s ease" }}>
                {/* header: bija + names + score ring */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-xl"
                      style={{ background: c.color, boxShadow: awakened ? `0 0 16px ${c.color}` : "none" }}>{c.bija}</span>
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

                {/* per-signal breakdown — what actually lights this chakra */}
                {d?.signals && d.signals.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-2 text-xs uppercase tracking-wider text-white/40">{t("chakra-signals", "What lights this")}</div>
                    <div className="space-y-1.5">
                      {d.signals.map((sg) => (
                        <div key={sg.key} className="flex items-center gap-2">
                          <span className="w-28 shrink-0 text-xs text-white/50">{t(`chakra-signal-${sg.key}`, SIGNAL_EN[sg.key] ?? sg.key)}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full"
                              style={{ width: awakened ? `${sg.value}%` : "0%", background: c.color,
                                opacity: 0.85, transition: "width 1s ease .3s" }} />
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

                {/* primary button — CHAKRA-UI-3 middle layer: the per-chakra
                    detail page owns the factors + the onward action link */}
                <div className="mt-5">
                  <Link href={`/chakra/${key}`} className="block w-full rounded-xl py-2.5 text-center text-sm font-medium"
                    style={{ background: c.color, color: "#0b0b10" }}>
                    {t("chakra-details", "View details")} →
                  </Link>
                </div>
              </div>

              {idx === 0 && (
                <div className="chakra-hint pointer-events-none mt-4 text-center text-xs text-white/50"
                  style={{ animation: "chakraHint 2s ease-in-out infinite" }}>
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
