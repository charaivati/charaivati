"use client";
// blocks/HealthBlock.tsx — compact health dashboard card in the Self tab

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CollapsibleSection } from "@/components/self/shared";
import EditHealthModal from "@/components/health/EditHealthModal";
import type { HealthProfile, AIHealthPlan } from "@/types/self";

export type { HealthProfile, AIHealthPlan };

export function HealthSection({ health, setHealth }: {
  health: HealthProfile;
  setHealth: (h: HealthProfile) => void;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);

  const hcm = parseFloat(String(health.heightCm ?? ""));
  const wkg  = parseFloat(String(health.weightKg ?? ""));
  const bmi  = hcm > 0 && wkg > 0 ? (wkg / Math.pow(hcm / 100, 2)).toFixed(1) : null;
  const targetBmi     = health.healthPlan?.health_targets.target_bmi ?? null;
  const dailyCalories = health.healthPlan?.health_targets.daily_calories_kcal ?? null;

  const sleepLabel: Record<string, string> = {
    bad: "Bad (<6 hrs)", moderate: "Moderate", good: "Good (6–8 hrs)",
  };
  const movementLabel = health.exercise
    ? `${health.exercise}${health.sessionsPerWeek ? ` · ${health.sessionsPerWeek}×/wk` : ""}`
    : null;

  const rows: { label: string; value: string | null; sub?: string | null }[] = [
    { label: "BMI",      value: bmi,                                                            sub: targetBmi ? `target ${targetBmi}` : null },
    { label: "Sleep",    value: health.sleepQuality ? sleepLabel[health.sleepQuality] : null },
    { label: "Mood",     value: health.mood ?? null,                                             sub: health.stressLevel ? `${health.stressLevel} stress` : null },
    { label: "Movement", value: movementLabel },
    { label: "Calories", value: dailyCalories ? `${dailyCalories} kcal/day` : null },
  ];

  const hasData = rows.some(r => r.value !== null);

  function handleSave(updated: HealthProfile) {
    setHealth(updated);
    // Persist immediately via the profile API (useSelfState auto-save may lag)
    fetch("/api/user/profile", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ health: updated }),
    }).catch(() => {});
  }

  return (
    <CollapsibleSection title="Health">
      <div className="space-y-4 pt-2">
        <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
          {hasData ? (
            <div className="space-y-2.5 mb-4">
              {rows.map(row => (
                <div key={row.label} className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-gray-500 shrink-0 w-20">{row.label}</span>
                  {row.value ? (
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="text-sm text-white font-medium truncate">{row.value}</span>
                      {row.sub && <span className="text-xs text-gray-500 shrink-0">{row.sub}</span>}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-600 italic">Not set</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic mb-4">
              No health data yet. Add your details to get started.
            </p>
          )}

          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="flex-1 min-w-[120px] py-2 rounded-lg border border-indigo-600/50 bg-indigo-600/20
                text-sm font-medium text-indigo-300 hover:bg-indigo-600/30 transition-colors text-center"
            >
              Edit Health Data
            </button>
            <button
              type="button"
              onClick={() => router.push("/health")}
              className="flex-1 min-w-[120px] py-2 rounded-lg border border-gray-700 bg-gray-900
                text-sm font-medium text-gray-300 hover:bg-gray-800 transition-colors text-center"
            >
              View My Plan
            </button>
          </div>
        </div>
      </div>

      {editOpen && (
        <EditHealthModal
          health={health}
          onSave={handleSave}
          onClose={() => setEditOpen(false)}
        />
      )}
    </CollapsibleSection>
  );
}
