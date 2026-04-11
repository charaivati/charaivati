"use client";
// blocks/EnergyBlock.tsx

import React, { useMemo } from "react";
import { CollapsibleSection } from "@/components/self/shared";
import type { HealthProfile } from "@/types/self";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EnergyScore = {
  overall: number;
  physical: number;
  mental: number;
  trend: "up" | "down" | "stable";
  factors: {
    sleep: number;
    exercise: number;
    stress: number;
    nutrition: number;
  };
};

// ─── computeEnergy ────────────────────────────────────────────────────────────

export function computeEnergy(health: HealthProfile): EnergyScore {
  // Sleep
  const sleep =
    health.sleepQuality === "bad"      ? 2 :
    health.sleepQuality === "moderate" ? 6 :
    health.sleepQuality === "good"     ? 9 : 5;

  // Exercise
  const sessions = health.sessionsPerWeek ?? 0;
  const exercise =
    sessions === 0           ? 2 :
    sessions <= 2            ? 5 :
    sessions <= 4            ? 8 : 9;

  // Stress
  const stress =
    health.stressLevel === "High" ? 2 :
    health.stressLevel === "Mid"  ? 6 :
    health.stressLevel === "Low"  ? 9 : 5;

  // Nutrition
  const availableFoods = health.availableFoods ?? [];
  let nutrition =
    health.food === "Vegan"          ? 8 :
    health.food === "Vegetarian"     ? 7 :
    health.food === "Eggetarian"     ? 6 :
    health.food === "Non-Vegetarian" ? 5 : 5;
  if (availableFoods.length > 3) nutrition = Math.min(10, nutrition + 1);

  const physical = Math.round((sleep + exercise) / 2);
  const mental   = Math.round((stress + nutrition) / 2);
  const overall  = Math.round((physical + mental) / 2);

  return {
    overall,
    physical,
    mental,
    trend: "stable",
    factors: { sleep, exercise, stress, nutrition },
  };
}

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

        {/* Physical + Mental bars */}
        <div className="space-y-2">
          <ScoreBar label="Physical" value={energy.physical} />
          <ScoreBar label="Mental"   value={energy.mental}   />
        </div>

        {/* Factors */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Factors</p>
          <div className="flex flex-wrap gap-2">
            <FactorChip label="Sleep"     value={energy.factors.sleep}     />
            <FactorChip label="Exercise"  value={energy.factors.exercise}  />
            <FactorChip label="Stress"    value={energy.factors.stress}    />
            <FactorChip label="Nutrition" value={energy.factors.nutrition} />
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
