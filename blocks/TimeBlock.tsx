"use client";
// blocks/TimeBlock.tsx

import React, { useState } from "react";
import {
  CollapsibleSection,
  AIGenerateButton,
  FallbackBanner,
  uid,
} from "@/components/self/shared";
import { useAIBlock } from "@/hooks/useAIBlock";
import type { GoalEntry, DriveType } from "@/types/self";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type TimeSlot = {
  id: string;
  day: DayKey;
  startHour: number;
  endHour: number;
  goalId: string;
  activity: string;
  isFlexible: boolean;
};

export type WeekSchedule = {
  slots: TimeSlot[];
};

// ─── Default ──────────────────────────────────────────────────────────────────

export function defaultWeekSchedule(): WeekSchedule {
  return { slots: [] };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

type PeriodKey = "morning" | "afternoon" | "evening";

const PERIODS: { key: PeriodKey; label: string; startHour: number; endHour: number }[] = [
  { key: "morning",   label: "Morning",   startHour: 6,  endHour: 12 },
  { key: "afternoon", label: "Afternoon", startHour: 12, endHour: 18 },
  { key: "evening",   label: "Evening",   startHour: 18, endHour: 22 },
];

const DRIVE_COLORS: Record<DriveType, string> = {
  learning: "bg-sky-500/20 text-sky-300 border border-sky-500/30",
  helping:  "bg-rose-500/20 text-rose-300 border border-rose-500/30",
  building: "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30",
  doing:    "bg-amber-500/20 text-amber-300 border border-amber-500/30",
};

const FALLBACK_COLOR = "bg-gray-700/40 text-gray-300 border border-gray-600/40";

// ─── Component ────────────────────────────────────────────────────────────────

export function TimeSection({
  schedule,
  goals,
  onChange,
}: {
  schedule: WeekSchedule;
  goals: GoalEntry[];
  onChange: (s: WeekSchedule) => void;
}) {
  // activeCell: which (day, period) is in add-mode
  const [activeCell, setActiveCell] = useState<{ day: DayKey; period: PeriodKey } | null>(null);
  const [newActivity, setNewActivity] = useState("");
  const [newGoalId,   setNewGoalId]   = useState(goals[0]?.id ?? "");
  const [newFlex,     setNewFlex]     = useState(false);

  const { loading, generate } = useAIBlock<{ suggestions: string[]; fallback?: boolean }>(
    "/api/self/optimize-schedule"
  );
  const [suggestions, setSuggestions] = useState<{ suggestions: string[]; fallback?: boolean } | null>(null);

  function goalColor(goalId: string): string {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return FALLBACK_COLOR;
    return DRIVE_COLORS[goal.driveId] ?? FALLBACK_COLOR;
  }

  function slotsInPeriod(day: DayKey, period: PeriodKey): TimeSlot[] {
    const p = PERIODS.find(x => x.key === period)!;
    return schedule.slots.filter(
      s => s.day === day && s.startHour >= p.startHour && s.startHour < p.endHour
    );
  }

  function handleCellClick(day: DayKey, period: PeriodKey) {
    if (activeCell?.day === day && activeCell.period === period) {
      setActiveCell(null);
      return;
    }
    setActiveCell({ day, period });
    setNewActivity("");
    setNewGoalId(goals[0]?.id ?? "");
    setNewFlex(false);
  }

  function addSlot(day: DayKey, period: PeriodKey) {
    const activity = newActivity.trim();
    if (!activity) return;
    const p = PERIODS.find(x => x.key === period)!;
    const slot: TimeSlot = {
      id:         uid(),
      day,
      startHour:  p.startHour,
      endHour:    p.endHour,
      goalId:     newGoalId,
      activity,
      isFlexible: newFlex,
    };
    onChange({ ...schedule, slots: [...schedule.slots, slot] });
    setActiveCell(null);
    setNewActivity("");
  }

  function removeSlot(id: string) {
    onChange({ ...schedule, slots: schedule.slots.filter(s => s.id !== id) });
  }

  // Per-goal total hours
  const goalHours: Record<string, number> = {};
  for (const slot of schedule.slots) {
    goalHours[slot.goalId] = (goalHours[slot.goalId] ?? 0) + (slot.endHour - slot.startHour);
  }

  function handleGenerate() {
    generate(
      {
        goals: goals.map(g => ({ id: g.id, statement: g.statement })),
        slots: schedule.slots,
      },
      (data) => setSuggestions(data),
      () => ({
        suggestions: [
          "Block 2-hour focused sessions for deep work.",
          "Keep mornings for your most important goal.",
        ],
        fallback: true,
      })
    );
  }

  return (
    <CollapsibleSection
      title="Time"
      subtitle="Your ideal week"
      defaultOpen={false}
    >
      <div className="space-y-4 pt-1">

        {/* Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="w-20 text-left text-gray-500 font-medium pb-2 pr-2"></th>
                {DAYS.map(d => (
                  <th key={d.key} className="text-center text-gray-400 font-semibold pb-2 px-1 min-w-[80px]">
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map(period => (
                <tr key={period.key} className="border-t border-gray-800">
                  <td className="text-gray-500 py-2 pr-2 align-top whitespace-nowrap font-medium">
                    {period.label}
                  </td>
                  {DAYS.map(day => {
                    const slots  = slotsInPeriod(day.key, period.key);
                    const isOpen = activeCell?.day === day.key && activeCell.period === period.key;
                    return (
                      <td
                        key={day.key}
                        className="py-2 px-1 align-top"
                      >
                        <div className="min-h-[40px] space-y-1">
                          {slots.map(slot => (
                            <div
                              key={slot.id}
                              onClick={() => removeSlot(slot.id)}
                              title="Click to remove"
                              className={`cursor-pointer px-1.5 py-0.5 rounded text-xs truncate ${goalColor(slot.goalId)}`}
                            >
                              {slot.activity}
                            </div>
                          ))}
                          {!isOpen && (
                            <button
                              onClick={() => handleCellClick(day.key, period.key)}
                              className="w-full text-center text-gray-700 hover:text-gray-500 hover:bg-gray-800/50 rounded transition-colors text-lg leading-none py-0.5"
                            >
                              +
                            </button>
                          )}
                          {isOpen && (
                            <div className="space-y-1 bg-gray-800 border border-gray-700 rounded p-2">
                              <input
                                autoFocus
                                value={newActivity}
                                onChange={e => setNewActivity(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") addSlot(day.key, period.key); if (e.key === "Escape") setActiveCell(null); }}
                                placeholder="Activity"
                                className="w-full bg-gray-900 border border-gray-700 rounded px-1.5 py-1 text-xs text-white placeholder-gray-600 focus:outline-none"
                              />
                              {goals.length > 0 && (
                                <select
                                  value={newGoalId}
                                  onChange={e => setNewGoalId(e.target.value)}
                                  className="w-full bg-gray-900 border border-gray-700 rounded px-1.5 py-1 text-xs text-white focus:outline-none"
                                >
                                  {goals.map(g => (
                                    <option key={g.id} value={g.id}>
                                      {g.statement || g.driveId}
                                    </option>
                                  ))}
                                </select>
                              )}
                              <label className="flex items-center gap-1 text-gray-400 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={newFlex}
                                  onChange={e => setNewFlex(e.target.checked)}
                                  className="accent-gray-500"
                                />
                                Flexible
                              </label>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => addSlot(day.key, period.key)}
                                  className="flex-1 bg-gray-600 hover:bg-gray-500 text-white rounded px-1.5 py-1 text-xs transition-colors"
                                >
                                  Add
                                </button>
                                <button
                                  onClick={() => setActiveCell(null)}
                                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded px-1.5 py-1 text-xs transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Per-goal summary */}
        {Object.keys(goalHours).length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">This week</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(goalHours).map(([gId, hours]) => {
                const goal = goals.find(g => g.id === gId);
                return (
                  <span key={gId} className="text-xs text-gray-300 bg-gray-800 px-2 py-1 rounded-full">
                    🎯 {goal?.statement || gId} — {hours}h
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* AI button */}
        <AIGenerateButton
          loading={loading}
          hasResult={!!suggestions}
          onGenerate={handleGenerate}
          labels={{ idle: "Optimize schedule", hasResult: "Re-optimize", loading: "Optimizing…" }}
        />

        {/* Suggestions */}
        {suggestions && (
          <div className="space-y-2">
            {suggestions.fallback && <FallbackBanner />}
            <ul className="space-y-1.5 list-none">
              {suggestions.suggestions.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-300">
                  <span className="text-gray-500 shrink-0">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>
    </CollapsibleSection>
  );
}
