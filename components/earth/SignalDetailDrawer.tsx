"use client";
// components/earth/SignalDetailDrawer.tsx — slide-up (mobile) / slide-right (desktop) drawer

import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { SignalDetail } from "./earthData";

interface SignalDetailDrawerProps {
  signal: SignalDetail | null;
  onClose: () => void;
}

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function WideSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const W = 260;
  const H = 48;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / range) * (H - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const step = W / (data.length - 1);
  return (
    <div>
      <svg width={W} height={H} aria-hidden className="text-emerald-400">
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="flex" style={{ width: W }}>
        {MONTHS.map((m, i) => (
          <span key={i} className="text-gray-600 text-[9px]"
            style={{ width: step, textAlign: "center", flexShrink: 0 }}>{m}</span>
        ))}
      </div>
    </div>
  );
}

function valueColor(v: number) {
  if (v >= 70) return "text-emerald-400";
  if (v >= 50) return "text-amber-400";
  return "text-red-400";
}

export default function SignalDetailDrawer({ signal, onClose }: SignalDetailDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!signal) return;
    setTimeout(() => closeRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [signal, onClose]);

  const isOpen = !!signal;
  const drawerTransform = isOpen
    ? "translate(0, 0)"
    : isDesktop ? "translate(100%, 0)" : "translate(0, 100%)";

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300"
        style={{ opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none" }}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal
        aria-label={signal?.name ?? "Signal details"}
        className="fixed z-50 bg-gray-950 border-white/10 overflow-y-auto
          bottom-0 left-0 right-0 max-h-[80vh] rounded-t-2xl border-t
          md:bottom-0 md:top-0 md:left-auto md:right-0 md:w-[420px] md:max-h-none
          md:rounded-none md:rounded-l-2xl md:border-t-0 md:border-l"
        style={{ transform: drawerTransform, transition: "transform 300ms ease-in-out" }}
      >
        {signal && (
          <div className="p-5 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">{signal.name}</h2>
                <span className={`text-3xl font-bold ${valueColor(signal.value)}`}>
                  {signal.value}%
                </span>
              </div>
              <button ref={closeRef} type="button" onClick={onClose} aria-label="Close"
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Wide sparkline */}
            <WideSparkline data={signal.sparklineData} />

            {/* Pulldown factors */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                What's pulling this down
              </p>
              <ul className="space-y-1.5">
                {signal.pulldownFactors.map((f, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-300">
                    <span className="text-red-400 flex-shrink-0 mt-0.5">↓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Key regions */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Key regions affected
              </p>
              <div className="space-y-1.5">
                {signal.regionsAffected.map((r) => (
                  <div key={r.region} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{r.region}</span>
                    <span className={`font-semibold ${valueColor(r.value)}`}>{r.value}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Related stories */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Related stories
              </p>
              <div className="space-y-1.5">
                {signal.relatedStories.map((s) => (
                  <a key={s.slug} href="#"
                    className="block text-sm text-teal-400 hover:text-teal-300 underline underline-offset-2 transition-colors">
                    {s.title}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
