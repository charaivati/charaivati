"use client";

// CHAKRA-1: the Self-layer chakra landing. A faint seated silhouette with 7
// glyphs glowing by openness score (visual inspiration only — no chakra names),
// over a scrollable list of interactive chakra cards: tagged todos, a 1–7
// self-report slider, and a deep-link into that chakra's real surface.
// 2D SVG is primary and static (no per-scroll transforms) so it stays smooth on
// low-end Android. Dormant framing is "ready to awaken", never "blocked".

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CHAKRAS } from "../chakras";
import { CHAKRA_KEYS, type ChakraKey } from "@/lib/chakra/keys";
import { useTranslations } from "@/hooks/useTranslations";
import { FigureBody } from "./figureBody";
import { CHAKRA_SYMBOL } from "../chakraSymbols";

// CHAKRA-5: glyphs share ONE vertical axis = the body's real spine (x≈510 in the
// 0 0 1024 1024 trace space). y placed head→seat, root raised to sit ON the seat
// (not in the reflection, which the viewBox crop below removes anyway).
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

// CHAKRA-2 corrected destinations. sacral = Self→Social TAB (not the Society
// layer); solar = Self→Learning TAB. ?tab= keys verified in self/page.tsx.
const DEEP_LINKS: Record<ChakraKey, string | null> = {
  root: "/earn",
  sacral: "/self?tab=social",
  solar: "/self?tab=learn",
  heart: "/app/initiatives",
  throat: "/society",
  third_eye: "/listen",
  crown: null, // PARKED — Sahasrara not built (see TECH_DEBT.md)
};

// English fallbacks (real strings live in TabTranslation, category ui-chakra).
// Remarks are calm one-liners — dormant reads as "ready to awaken", never broken.
const REMARK_EN: Record<ChakraKey, string> = {
  root: "Your foundation. Steady the ground beneath you.",
  sacral: "Your flow. Let creativity and connection move.",
  solar: "Your fire. Small wins build real momentum.",
  heart: "Your compassion. Serving others opens this.",
  throat: "Your voice. Speak and share what's true.",
  third_eye: "Your insight. Reflection sharpens the inner gaze.",
  crown: "Awareness beyond. Ready to awaken in time.",
};
const SURFACE_EN: Record<ChakraKey, string> = {
  root: "Earning", sacral: "Social", solar: "Learning", heart: "Initiatives",
  throat: "Society", third_eye: "Listen", crown: "",
};

const T_SLUGS = [
  "chakra-feel", "chakra-platform", "chakra-you", "chakra-coming",
  "chakra-todos", "chakra-awaken", "chakra-saved", "chakra-title", "chakra-sub",
  "chakra-goto", "chakra-add-reflection",
  ...CHAKRA_KEYS.map((k) => `chakra-remark-${k}`),
  ...CHAKRA_KEYS.map((k) => `chakra-surface-${k}`),
].join(",");

type Detail = { score: number; platform: number; self: number | null; platformOnly: boolean };
type Scores = Record<ChakraKey, Detail>;
type Todo = { id: string; title: string; completed: boolean; chakra: string | null };

// chakras.ts is index-ordered root→crown, same as CHAKRA_KEYS — zip by index.
const VIS = CHAKRA_KEYS.map((key, i) => ({ key, c: CHAKRAS[i] }));

// Deterministic starfield (Math.sin hash, not Math.random) so SSR/client match.
const STARS = Array.from({ length: 70 }, (_, i) => {
  const r = (n: number) => { const x = Math.sin(i * 9301 + n * 49297) * 233280; return x - Math.floor(x); };
  return { top: r(1) * 100, left: r(2) * 100, size: 1 + r(3) * 1.6, delay: r(4) * 4, dur: 2 + r(5) * 3 };
});

export default function ChakraLanding() {
  const t = useTranslations(T_SLUGS);
  const [scores, setScores] = useState<Scores | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [report, setReport] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<ChakraKey | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [saved, setSaved] = useState<ChakraKey | null>(null);
  const [mounted, setMounted] = useState(false); // stars render client-only (no SSR hydration mismatch)
  useEffect(() => setMounted(true), []);

  // Water line references the root chakra: measure its on-screen centre so the
  // line (and the mirror axis) always passes through the root glyph.
  const rootRef = useRef<SVGGElement>(null);
  const [lineY, setLineY] = useState<number | null>(null);
  useEffect(() => {
    const measure = () => {
      const r = rootRef.current?.getBoundingClientRect();
      if (r) setLineY(r.top + r.height / 2);
    };
    measure();
    const raf = () => requestAnimationFrame(measure);
    window.addEventListener("resize", raf);
    window.addEventListener("scroll", raf, { passive: true });
    return () => { window.removeEventListener("resize", raf); window.removeEventListener("scroll", raf); };
  }, [mounted, scores]);

  // Shooting stars: spawn one at a random spot every 3–12s, remove after it falls.
  const [shooting, setShooting] = useState<{ id: number; top: number; left: number; len: number; dur: number }[]>([]);
  useEffect(() => {
    let alive = true, t: ReturnType<typeof setTimeout>;
    const spawn = () => {
      if (!alive) return;
      const id = Date.now() + Math.random();
      const s = { id, top: Math.random() * 45, left: 15 + Math.random() * 70, len: 60 + Math.random() * 90, dur: 0.8 + Math.random() * 0.7 };
      setShooting((p) => [...p, s]);
      setTimeout(() => setShooting((p) => p.filter((x) => x.id !== id)), s.dur * 1000 + 200);
      t = setTimeout(spawn, 3000 + Math.random() * 9000);
    };
    t = setTimeout(spawn, 2000 + Math.random() * 3000);
    return () => { alive = false; clearTimeout(t); };
  }, []);

  // CHAKRA-5: open the card anchored at the tapped element (glyph or list row).
  function openAt(e: { currentTarget: Element }, key: ChakraKey) {
    const r = e.currentTarget.getBoundingClientRect();
    setAnchor({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    setOpen(key);
  }

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
  // Line = root glyph's screen centre (px from top). Falls back to a %-estimate
  // until the first measurement lands. Everything below derives from it.
  const LINE_TOP = lineY != null ? `${lineY}px` : "calc(66.67% + 11px)";
  const BELOW_INSET = lineY != null ? `calc(100% - ${lineY}px)` : "calc(33.33% - 11px)";
  const ABOVE_LINE_CLIP = `inset(0 0 ${BELOW_INSET} 0)`; // keep only above the line

  // Shooting stars, reused for the real layer and its mirror.
  const shootField = shooting.map((s) => (
    <span key={s.id} style={{ position: "absolute", top: `${s.top}%`, left: `${s.left}%`,
      width: s.len, height: 2, borderRadius: 2, transformOrigin: "left center",
      background: "linear-gradient(90deg, transparent, #fff)",
      animation: `chakraShoot ${s.dur}s ease-out forwards` }} />
  ));

  return (
    <main className="relative min-h-screen bg-black text-white">
      <style>{`
        @keyframes chakraCardIn { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: none; } }
        @keyframes chakraFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes chakraTwinkle { 0%,100% { opacity: .15; } 50% { opacity: 1; } }
        @keyframes chakraOrbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes chakraShoot { 0% { transform: translate3d(0,0,0) rotate(40deg); opacity: 0; } 12% { opacity: 1; } 100% { transform: translate3d(240px,200px,0) rotate(40deg); opacity: 0; } }
        @keyframes chakraShimmer { from { background-position: 220% 0; } to { background-position: -220% 0; } }
        @keyframes chakraRipple { 0%,100% { opacity: .5; transform: scaleY(1); } 50% { opacity: 1; transform: scaleY(2.5); } }
      `}</style>

      {/* Orbiting starfield above the line + its mirror reflected below the line.
          Both clipped to the above-line region; the mirror flips about the line
          so its orbit runs in reverse (mirrored movement). Client-only. */}
      {mounted && (
        <>
          <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
            style={{ clipPath: ABOVE_LINE_CLIP }}>{starField}</div>
          <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
            style={{ clipPath: ABOVE_LINE_CLIP, transform: "scaleY(-1)", transformOrigin: `50% ${LINE_TOP}` }}>{starField}</div>
        </>
      )}

      {/* Falling / shooting stars — clipped to fall only to the line, mirrored below */}
      {mounted && (
        <>
          <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
            style={{ clipPath: ABOVE_LINE_CLIP }}>{shootField}</div>
          <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
            style={{ clipPath: ABOVE_LINE_CLIP, transform: "scaleY(-1)", transformOrigin: `50% ${LINE_TOP}` }}>{shootField}</div>
        </>
      )}

      {/* Water body below the line — blurs + darkens the reflected stars so the
          mirror reads as a reflection on a water surface. A slow caustic sheen
          drifts across for movement. */}
      <div aria-hidden className="pointer-events-none fixed left-0 right-0 bottom-0 z-0 overflow-hidden"
        style={{ top: LINE_TOP, backdropFilter: "blur(1.5px)", WebkitBackdropFilter: "blur(1.5px)",
          background: "linear-gradient(to bottom, rgba(255,255,255,0.12), rgba(255,255,255,0.06) 60%, rgba(255,255,255,0.03))" }}>
        <div style={{ position: "absolute", inset: "-20% -20%", backgroundSize: "180% 100%",
          background: "linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.08) 50%, transparent 70%)",
          animation: "chakraShimmer 14s linear infinite" }} />
      </div>

      {/* Water surface — plain static line through the root chakra centre */}
      <div aria-hidden className="pointer-events-none fixed left-0 right-0 z-0"
        style={{ top: LINE_TOP, height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)" }} />

      <Link href="/self" className="fixed top-4 left-4 z-20 text-sm text-white/40 hover:text-white/80">← back</Link>

      {/* Real seated silhouette (CHAKRA-3) + score-lit glyphs, no labels */}
      <section className="relative z-10 flex justify-center pt-16 pb-8"
        style={{ background: "radial-gradient(120% 85% at 50% 32%, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 40%, transparent 70%)" }}>
        {/* viewBox frames the whole figure incl. its shadow/reflection (trace
            bottom ≈ y 855); x cropped to 200–820 to tighten sides only. */}
        <svg viewBox="200 100 620 1000"
          className={`w-[min(80vw,340px)] h-auto transition-transform duration-300 ease-out ${open ? "lg:-translate-x-40" : ""}`}>
          <defs>
            {/* rim-glow via feGaussianBlur (WebView-safe — no feMorphology) */}
            <filter id="bodyAura" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="14" /></filter>
            {/* tighter blur → distinct, saturated bands instead of a muddy blend */}
            <filter id="og" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="10" /></filter>
          </defs>
          <FigureBody />
          {/* sushumna: straight spine line, segments brighten by average openness */}
          {scores && VIS.slice(0, -1).map(({ key }, i) => {
            const next = VIS[i + 1];
            const a = ANCHORS[key], b = ANCHORS[next.key];
            const lit = ((scores[key].score + scores[next.key].score) / 2) / 100;
            return <line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#fff"
              strokeWidth={3} style={{ opacity: 0.1 + lit * 0.7 }} />;
          })}
          {VIS.map(({ key, c }) => {
            const s = scores ? scores[key].score / 100 : 0.05;
            const { x, y } = ANCHORS[key];
            return (
              <g key={key} ref={key === "root" ? rootRef : undefined} onClick={(e) => openAt(e, key)} style={{ cursor: "pointer" }}>
                {/* faint glow, then the real line-art yantra (symbols.svg) centred here */}
                <circle cx={x} cy={y} r={26} fill={c.color} filter="url(#og)" style={{ opacity: 0.04 + s * 0.18 }} />
                <g transform={`translate(${x} ${y}) scale(0.62)`} fill="none" stroke={c.color} strokeWidth={2.5}
                  strokeLinejoin="round" style={{ opacity: 0.55 + s * 0.45 }}>
                  {CHAKRA_SYMBOL[key]}
                </g>
              </g>
            );
          })}
        </svg>
      </section>

      {/* Popup card — one overlay for the open chakra. Backdrop / X closes. */}
      {open && (() => {
        const key = open;
        const c = CHAKRAS[CHAKRA_KEYS.indexOf(key)];
        const d = scores?.[key];
        const list = todosByChakra.get(key) ?? [];
        const href = DEEP_LINKS[key];
        // CHAKRA-5: anchor the card beside the tapped glyph, clamped on-screen
        // (flip to the other side near an edge). Falls back to viewport centre.
        const vw = window.innerWidth, vh = window.innerHeight;
        const cardW = Math.min(vw * 0.92, 360), estH = Math.min(vh * 0.8, 460);
        const a = anchor ?? { x: vw / 2, y: vh / 2 };
        let left = a.x + 28;
        if (left + cardW > vw - 8) left = a.x - 28 - cardW;        // flip left
        if (left < 8) left = Math.max(8, (vw - cardW) / 2);         // centre fallback
        const top = Math.min(Math.max(a.y - 40, 8), Math.max(8, vh - estH - 8));
        return (
          <div className="fixed inset-0 z-30 bg-black/40" onClick={() => setOpen(null)}
            style={{ animation: "chakraFadeIn .2s ease-out" }}>
            <div className="rounded-2xl border p-5"
              style={{ position: "fixed", left, top, width: cardW, maxHeight: "80vh", overflowY: "auto",
                borderColor: `${c.color}55`, background: "#0b0b10", animation: "chakraCardIn .22s ease-out" }}
              onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-full text-xl"
                  style={{ background: c.color, boxShadow: `0 0 16px ${c.color}` }}>{c.bija}</span>
                <button onClick={() => setOpen(null)} className="text-white/40 hover:text-white/80" aria-label="Close">✕</button>
              </div>

              {/* a. score  +  b. measured vs felt */}
              <div className="text-4xl font-semibold text-white">{d?.score ?? 0}<span className="text-lg text-white/30"> / 100</span></div>
              <div className="mt-1 text-sm text-white/50">
                {t("chakra-platform", "Platform sees")} {d?.platform ?? 0}
                {d && !d.platformOnly && d.self !== null
                  ? <> · {t("chakra-you", "you feel")} {d.self}</>
                  : <span className="text-white/30"> · {t("chakra-add-reflection", "add your reflection")}</span>}
              </div>

              {/* d. calm remark */}
              <p className="mt-3 text-sm text-white/70">{t(`chakra-remark-${key}`, REMARK_EN[key])}</p>

              {/* c. self-report slider */}
              <div className="mt-5">
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
              <div className="mt-5">
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

              {/* e. primary button — corrected deep-link, crown disabled */}
              <div className="mt-6">
                {href ? (
                  <Link href={href} className="block w-full rounded-xl py-2.5 text-center text-sm font-medium"
                    style={{ background: c.color, color: "#0b0b10" }}>
                    {t("chakra-goto", "Go to")} {t(`chakra-surface-${key}`, SURFACE_EN[key])} →
                  </Link>
                ) : (
                  <span className="block w-full rounded-xl bg-white/5 py-2.5 text-center text-sm text-white/30">
                    {t("chakra-coming", "Coming soon")}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
}
