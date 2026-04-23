"use client";
// components/health/EditHealthModal.tsx — quick-edit modal for core health metrics

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { PillButton, FieldLabel } from "@/components/self/shared";
import type { HealthProfile } from "@/types/self";

const EXERCISE_OPTIONS = ["Yoga", "Cardio", "Strength", "Mixed"];

type Props = {
  health: HealthProfile;
  onSave: (updated: HealthProfile) => void;
  onClose: () => void;
};

export default function EditHealthModal({ health, onSave, onClose }: Props) {
  const router = useRouter();

  const [heightCm,        setHeightCm]        = useState(String(health.heightCm ?? ""));
  const [weightKg,        setWeightKg]        = useState(String(health.weightKg ?? ""));
  const [age,             setAge]             = useState(String(health.age ?? ""));
  const [sleepQuality,    setSleepQuality]    = useState(health.sleepQuality ?? "");
  const [mood,            setMood]            = useState(health.mood ?? "");
  const [stressLevel,     setStressLevel]     = useState(health.stressLevel ?? "");
  const [exercise,        setExercise]        = useState(health.exercise ?? "Mixed");
  const [sessionsPerWeek, setSessionsPerWeek] = useState(health.sessionsPerWeek ?? 3);

  const h = parseFloat(heightCm);
  const w = parseFloat(weightKg);
  const bmi = h > 0 && w > 0 ? (w / Math.pow(h / 100, 2)).toFixed(1) : null;
  const dailyCalories = health.healthPlan?.health_targets.daily_calories_kcal ?? null;

  function handleSave() {
    onSave({
      ...health,
      heightCm,
      weightKg,
      age,
      sleepQuality: sleepQuality as HealthProfile["sleepQuality"],
      mood:         mood         as HealthProfile["mood"],
      stressLevel:  stressLevel  as HealthProfile["stressLevel"],
      exercise,
      sessionsPerWeek,
    });
    onClose();
  }

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return createPortal(
    /* Backdrop — covers the whole viewport, mounted at document.body */
    <div
      className="fixed inset-0 z-[9999] flex flex-col justify-end sm:justify-center sm:items-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/*
        Mobile  : full-width bottom sheet, 82svh tall, rounded top corners
        Desktop : centred card, max-w-xl, max-h-[85svh]
      */}
      <div
        className="
          w-full h-[82svh] flex flex-col
          bg-[#111] border-t border-gray-800 rounded-t-2xl shadow-2xl
          sm:h-auto sm:max-h-[85svh] sm:max-w-xl sm:rounded-2xl sm:border sm:mx-4
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
          <h2 className="text-base font-semibold text-white">Edit Health Data</h2>
          <button type="button" onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-5">

          {/* Read-only derived row */}
          {(bmi || dailyCalories) && (
            <div className="flex gap-6 py-3 border-y border-gray-800">
              {bmi && (
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">BMI</p>
                  <p className="text-sm font-semibold text-white">{bmi}</p>
                </div>
              )}
              {dailyCalories && (
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Daily Calories</p>
                  <p className="text-sm font-semibold text-white">{dailyCalories} kcal</p>
                </div>
              )}
            </div>
          )}

          {/* Height / Weight / Age */}
          <div className="grid grid-cols-3 gap-3">
            {([
              ["Height (cm)", heightCm, setHeightCm, "170"],
              ["Weight (kg)", weightKg, setWeightKg, "65"],
              ["Age",         age,      setAge,       "28"],
            ] as [string, string, (v: string) => void, string][]).map(([label, val, setter, ph]) => (
              <div key={label}>
                <FieldLabel>{label}</FieldLabel>
                <input type="number" value={val} onChange={e => setter(e.target.value)} placeholder={ph}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            ))}
          </div>

          {/* Sleep / Mood */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Sleep quality</FieldLabel>
              <select value={sleepQuality} onChange={e => setSleepQuality(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer">
                <option value="" disabled>Select…</option>
                <option value="bad">Bad · &lt;6 hrs</option>
                <option value="moderate">Moderate</option>
                <option value="good">Good · 6–8 hrs</option>
              </select>
            </div>
            <div>
              <FieldLabel>Mood</FieldLabel>
              <select value={mood} onChange={e => setMood(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer">
                <option value="" disabled>Select…</option>
                <option value="😞">😞 Low</option>
                <option value="😐">😐 Neutral</option>
                <option value="🙂">🙂 Good</option>
                <option value="😄">😄 Great</option>
              </select>
            </div>
          </div>

          {/* Stress */}
          <div>
            <FieldLabel>Stress level</FieldLabel>
            <div className="flex gap-2 pt-1">
              {(["Low", "Mid", "High"] as const).map(v => (
                <PillButton key={v} active={stressLevel === v} onClick={() => setStressLevel(v)}>{v}</PillButton>
              ))}
            </div>
          </div>

          {/* Movement */}
          <div>
            <FieldLabel>Movement</FieldLabel>
            <div className="flex flex-wrap gap-2 mb-2.5">
              {EXERCISE_OPTIONS.map(e => (
                <PillButton key={e} active={exercise === e} onClick={() => setExercise(e)}>{e}</PillButton>
              ))}
            </div>
            <div className="flex gap-2">
              {[2, 3, 4, 5].map(n => (
                <PillButton key={n} active={sessionsPerWeek === n} onClick={() => setSessionsPerWeek(n)}>
                  {n}×/wk
                </PillButton>
              ))}
            </div>
          </div>

        </div>

        {/* Footer — always visible at bottom */}
        <div className="shrink-0 px-5 pt-3 pb-6 sm:pb-5 space-y-2 border-t border-gray-800">
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-700 bg-gray-900 hover:border-gray-500 text-sm text-gray-300 transition-colors">
              Cancel
            </button>
            <button type="button" onClick={handleSave}
              className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
              Save
            </button>
          </div>
          <button type="button"
            onClick={() => { onClose(); router.push("/health?section=data"); }}
            className="w-full py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors text-center">
            Advanced settings →
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
