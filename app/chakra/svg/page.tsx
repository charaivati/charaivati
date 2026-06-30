"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { CHAKRAS, type Chakra } from "../chakras";

// Map a chakra's spineY (0 base, 1 crown) to a y-coordinate on the figure.
const SPINE_BASE = 300;
const SPINE_SPAN = 266;
const orbY = (spineY: number) => SPINE_BASE - spineY * SPINE_SPAN;

// Each chakra lights as scroll progress passes its threshold, then stays lit
// (energy rises up the spine and remains).
function litStart(index: number) {
  return (index / CHAKRAS.length) * 0.92;
}

function Orb({ chakra, index, progress }: { chakra: Chakra; index: number; progress: MotionValue<number> }) {
  const start = litStart(index);
  const lit = useTransform(progress, [start, start + 0.07], [0, 1]);
  const haloOpacity = useTransform(lit, [0, 1], [0, 0.6]);
  const coreR = useTransform(lit, [0, 1], [1.5, 7]);
  const x = 120;
  const y = orbY(chakra.spineY);
  return (
    <g>
      <motion.circle cx={x} cy={y} r={26} fill={chakra.color} filter="url(#orbGlow)" style={{ opacity: haloOpacity }} />
      <motion.circle cx={x} cy={y} fill="#fff" r={coreR} style={{ opacity: lit }} />
      <motion.circle cx={x} cy={y} r={9} fill="none" stroke={chakra.color} strokeWidth={2} style={{ opacity: lit }} />
    </g>
  );
}

function Panel({ chakra, index, progress }: { chakra: Chakra; index: number; progress: MotionValue<number> }) {
  const start = litStart(index);
  // Appear as energy reaches this chakra, fade as it moves to the next.
  const opacity = useTransform(progress, [start - 0.07, start, start + 0.1, start + 0.17], [0, 1, 1, 0]);
  const y = useTransform(progress, [start - 0.07, start], [24, 0]);
  return (
    <motion.div style={{ opacity, y }} className="absolute inset-0 flex flex-col justify-center">
      <div className="text-sm uppercase tracking-[0.3em] mb-3" style={{ color: chakra.color }}>
        {chakra.sanskrit}
      </div>
      <div className="text-4xl sm:text-5xl font-semibold text-white">{chakra.name}</div>
      <p className="mt-4 text-white/50 max-w-xs">{chakra.line}</p>
    </motion.div>
  );
}

export default function ChakraSvg() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  return (
    <main className="bg-black text-white">
      <Link href="/chakra" className="fixed top-5 left-5 z-20 text-sm text-white/40 hover:text-white/80 transition">
        ← back
      </Link>

      {/* tall scroll track; figure is pinned inside */}
      <div ref={ref} className="relative h-[700vh]">
        <div className="sticky top-0 h-screen overflow-hidden">
          {/* cosmic backdrop */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 90% at 50% 60%, #15102b 0%, #0a0712 45%, #000 100%)",
            }}
          />

          <div className="relative h-full mx-auto max-w-5xl px-6 grid sm:grid-cols-2 items-center gap-8">
            {/* figure */}
            <div className="flex justify-center">
              <svg viewBox="0 0 240 372" className="w-[min(70vw,360px)] h-auto" aria-label="Meditating figure with chakras">
                <defs>
                  <filter id="figureGlow" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="8" />
                  </filter>
                  <filter id="orbGlow" x="-150%" y="-150%" width="400%" height="400%">
                    <feGaussianBlur stdDeviation="6" />
                  </filter>
                </defs>

                {/* aura: blurred union of the body, fixed cool glow */}
                <g filter="url(#figureGlow)" opacity="0.5">
                  <FigureShapes fill="#6d5bd0" />
                </g>
                {/* solid dark body on top */}
                <g>
                  <FigureShapes fill="#05060a" />
                </g>

                {CHAKRAS.map((c, i) => (
                  <Orb key={c.key} chakra={c} index={i} progress={scrollYProgress} />
                ))}
              </svg>
            </div>

            {/* crossfading text */}
            <div className="relative h-48">
              {CHAKRAS.map((c, i) => (
                <Panel key={c.key} chakra={c} index={i} progress={scrollYProgress} />
              ))}
            </div>
          </div>

          {/* scroll hint */}
          <motion.div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/30 text-xs tracking-widest"
            style={{ opacity: useTransform(scrollYProgress, [0, 0.05], [1, 0]) }}
          >
            scroll ↓ to rise
          </motion.div>
        </div>
      </div>
    </main>
  );
}

// The seated padmasana silhouette, composed of primitives. Filled with one
// colour so the blurred copy reads as a single clean aura.
function FigureShapes({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      {/* head */}
      <ellipse cx="120" cy="62" rx="27" ry="31" />
      {/* torso */}
      <path d="M93 92 Q120 84 147 92 L150 150 Q150 200 138 232 L102 232 Q90 200 90 150 Z" />
      {/* crossed legs / lotus base */}
      <ellipse cx="120" cy="312" rx="110" ry="52" />
      {/* arms resting toward the knees */}
      <path d="M150 104 C196 130 210 250 196 300 C188 312 168 312 162 300 C150 250 140 150 138 118 Z" />
      <path d="M90 104 C44 130 30 250 44 300 C52 312 72 312 78 300 C90 250 100 150 102 118 Z" />
      {/* hands on knees */}
      <ellipse cx="46" cy="300" rx="24" ry="16" />
      <ellipse cx="194" cy="300" rx="24" ry="16" />
    </g>
  );
}

// ponytail: smooth scroll is native + framer scroll-link, no Lenis. Add `lenis`
// only if inertial momentum is wanted.
