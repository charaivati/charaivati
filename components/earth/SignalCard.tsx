"use client";
// components/earth/SignalCard.tsx — planetary signal card with inline sparkline

import React from "react";
import type { SignalDetail } from "./earthData";

interface SignalCardProps {
  signal: SignalDetail;
  onClick: () => void;
}

function valueColor(v: number): string {
  if (v >= 70) return "text-emerald-400";
  if (v >= 50) return "text-amber-400";
  return "text-red-400";
}

function TrendBadge({ delta, trend }: { delta: number; trend: SignalDetail["trend"] }) {
  if (trend === "up")
    return <span className="text-emerald-400 text-xs">▲ +{delta.toFixed(1)}%</span>;
  if (trend === "down")
    return <span className="text-red-400 text-xs">▼ {delta.toFixed(1)}%</span>;
  return <span className="text-gray-500 text-xs">● 0.0%</span>;
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const W = 80;
  const H = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / range) * (H - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={W} height={H} aria-hidden className="opacity-60">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function SignalCard({ signal, onClick }: SignalCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-white/10 bg-white/5 p-4
        hover:border-white/20 hover:bg-white/8 transition-all duration-200 cursor-pointer
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-white leading-snug">{signal.name}</h3>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <TrendBadge delta={signal.delta} trend={signal.trend} />
          <span className={`text-base font-bold ${valueColor(signal.value)}`}>
            {signal.value}%
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-400 leading-relaxed mb-3">{signal.description}</p>

      {/* Sparkline */}
      <div className={`${valueColor(signal.value)}`}>
        <Sparkline data={signal.sparklineData} />
      </div>
    </button>
  );
}
