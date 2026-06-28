"use client";
// blocks/EnergyBlock.tsx

import React, { useMemo } from "react";
import { CollapsibleSection } from "@/components/self/shared";
import type { HealthProfile } from "@/types/self";
// computeEnergy moved to a framework-agnostic module so server code (AI context,
// council) can share the exact same calculation. Re-exported here so existing
// `import { computeEnergy } from "@/blocks/EnergyBlock"` call sites keep working.
import { computeEnergy, type EnergyScore } from "@/lib/self/energy";

export { computeEnergy };
export type { EnergyScore };

// ─── ScoreBar ─────────────────────────────────────────────────────────────────

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round((value / 10) * 100);
  const barColor =
    value >= 7 ? "bg-green-500" :
    value >= 4 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span>{value}/10</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── FactorChip ───────────────────────────────────────────────────────────────

function FactorChip({ label, value }: { label: string; value: number }) {
  const color =
    value >= 7 ? "text-green-400 bg-green-500/10 border-green-500/30" :
    value >= 4 ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" :
                 "text-red-400 bg-red-500/10 border-red-500/30";

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs ${color}`}>
      <span className="capitalize text-gray-400">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

// ─── EnergySection ────────────────────────────────────────────────────────────

export function EnergySection({ health }: { health: HealthProfile }) {
  const energy = useMemo(() => computeEnergy(health), [health]);

  const trafficLight =
    energy.overall >= 7 ? { icon: "🟢", label: "High",     color: "text-green-400"  } :
    energy.overall >= 4 ? { icon: "🟡", label: "Moderate", color: "text-yellow-400" } :
                          { icon: "🔴", label: "Low",       color: "text-red-400"    };

  return (
    <CollapsibleSection
      title="Energy"
      subtitle="Derived from your health data"
      defaultOpen={false}
    >
      <div className="space-y-4 pt-1">

        {/* Traffic light */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">{trafficLight.icon}</span>
          <div>
            <p className={`text-lg font-semibold leading-tight ${trafficLight.color}`}>
              {trafficLight.label}
            </p>
            <p className="text-xs text-gray-500">Overall energy — {energy.overall}/10</p>
          </div>
        </div>

        {/* Physical + Mental + Joy bars */}
        <div className="space-y-2">
          <ScoreBar label="Physical" value={energy.physical} />
          <ScoreBar label="Mental"   value={energy.mental}   />
          <ScoreBar label="Joy & Life" value={energy.joy}   />
        </div>

        {/* Factors */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Factors</p>
          <div className="flex flex-wrap gap-2">
            <FactorChip label="Sleep"     value={energy.factors.sleep}     />
            <FactorChip label="Exercise"  value={energy.factors.exercise}  />
            <FactorChip label="Stress"    value={energy.factors.stress}    />
            <FactorChip label="Nutrition" value={energy.factors.nutrition} />
            <FactorChip label="Joy"       value={energy.joy}               />
          </div>
        </div>

        {/* Low energy warning */}
        {energy.overall < 5 && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <span className="text-amber-400 text-base leading-tight">⚠️</span>
            <p className="text-sm text-amber-300">
              Energy is low — consider lighter goals this week.
            </p>
          </div>
        )}

      </div>
    </CollapsibleSection>
  );
}
