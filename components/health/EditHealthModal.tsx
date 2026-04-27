"use client";
// components/health/EditHealthModal.tsx — full health data editor (portal modal)

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { PillButton, FieldLabel } from "@/components/self/shared";
import type { HealthProfile, JoyProfile, JoySection, FrequencyType } from "@/types/self";

// ─── Constants ────────────────────────────────────────────────────────────────

const EXERCISE_OPTIONS = ["Yoga", "Cardio", "Strength", "Mixed"];
const FOOD_OPTIONS     = ["Vegetarian", "Eggetarian", "Non-Vegetarian", "Vegan"];
const KOLKATA_FOODS    = [
  "Rice (steamed)", "Roti / Chapati", "Dal (lentils)", "Luchi",
  "Posto (poppy seed)", "Mustard fish curry", "Hilsa (ilish) fish",
  "Chingri (prawns)", "Begun bhaja (fried eggplant)", "Aloo dum",
  "Chhana (paneer)", "Doi (yogurt)", "Mishti doi", "Muri (puffed rice)",
  "Chanachur", "Kochuri", "Egg curry", "Chicken curry",
  "Soybean / Tofu", "Oats",
];
const HOBBY_OPTIONS  = ["Reading", "Music", "Gaming", "Art", "Cooking", "Gardening", "Photography", "Writing", "Crafts"];
const SPORT_OPTIONS  = ["Football", "Cricket", "Running", "Swimming", "Gym", "Cycling", "Tennis", "Basketball", "Yoga"];
const SOCIAL_OPTIONS = ["Family", "Friends", "Partner", "Community", "Colleagues", "Solo time"];
const REST_OPTIONS   = ["Screen-free time", "Nature walks", "Meditation", "Naps", "Reading", "Music"];

const FREQ_OPTIONS: { value: FrequencyType; label: string }[] = [
  { value: "daily",        label: "Daily"   },
  { value: "few_per_week", label: "Few×/wk" },
  { value: "weekly",       label: "Weekly"  },
  { value: "rarely",       label: "Rarely"  },
];
const EMPTY_JOY: JoySection = { types: [], frequency: "weekly" };

// ─── JoySubSection ────────────────────────────────────────────────────────────

function JoySubSection({
  label, options, value, onChange, customAllowed = false,
}: {
  label: string; options: string[]; value: JoySection;
  onChange: (v: JoySection) => void; customAllowed?: boolean;
}) {
  const [custom, setCustom] = useState("");
  function toggle(t: string) {
    const next = value.types.includes(t) ? value.types.filter(x => x !== t) : [...value.types, t];
    onChange({ ...value, types: next });
  }
  function addCustom() {
    const t = custom.trim();
    if (!t || value.types.includes(t)) return;
    onChange({ ...value, types: [...value.types, t] });
    setCustom("");
  }
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <PillButton key={o} active={value.types.includes(o)} onClick={() => toggle(o)}>{o}</PillButton>
        ))}
        {customAllowed && (
          <div className="flex items-center gap-1.5">
            <input value={custom} onChange={e => setCustom(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
              placeholder="+ Custom"
              className="w-24 rounded-lg border border-dashed border-gray-700 bg-gray-950/40 px-2 py-1 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition-colors"
            />
            {custom.trim() && (
              <button type="button" onClick={addCustom}
                className="px-2 py-1 rounded-lg border border-gray-700 bg-gray-800 text-xs text-gray-400 hover:border-indigo-500/50 hover:text-indigo-300 transition-colors">
                Add
              </button>
            )}
          </div>
        )}
      </div>
      {value.types.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {FREQ_OPTIONS.map(f => (
            <PillButton key={f.value} active={value.frequency === f.value}
              onClick={() => onChange({ ...value, frequency: f.value })}>
              {f.label}
            </PillButton>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────

function Divider({ label }: { label: string }) {
  return (
    <div className="pt-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider pb-1 border-t border-gray-800 pt-4">
        {label}
      </p>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

type Props = {
  health: HealthProfile;
  onSave: (updated: HealthProfile) => void;
  onClose: () => void;
};

export default function EditHealthModal({ health, onSave, onClose }: Props) {
  // Core metrics
  const [heightCm,        setHeightCm]        = useState(String(health.heightCm ?? ""));
  const [weightKg,        setWeightKg]        = useState(String(health.weightKg ?? ""));
  const [age,             setAge]             = useState(String(health.age ?? ""));
  const [sleepQuality,    setSleepQuality]    = useState(health.sleepQuality ?? "");
  const [mood,            setMood]            = useState(health.mood ?? "");
  const [stressLevel,     setStressLevel]     = useState(health.stressLevel ?? "");
  const [exercise,        setExercise]        = useState(health.exercise ?? "Mixed");
  const [sessionsPerWeek, setSessionsPerWeek] = useState(health.sessionsPerWeek ?? 3);

  // Extended body metrics
  const [bodyFatPct,       setBodyFatPct]       = useState(String(health.bodyFatPct      ?? ""));
  const [waistCm,          setWaistCm]          = useState(String(health.waistCm         ?? ""));
  const [hipCm,            setHipCm]            = useState(String(health.hipCm           ?? ""));
  const [bicepCm,          setBicepCm]          = useState(String(health.bicepCm         ?? ""));
  const [chestCm,          setChestCm]          = useState(String(health.chestCm         ?? ""));
  const [medicalConditions, setMedicalConditions] = useState(health.medicalConditions ?? "");
  const [healthIssues,      setHealthIssues]      = useState<string[]>(health.healthIssues ?? []);
  const [issueInput,        setIssueInput]        = useState("");
  const [focusClarity,     setFocusClarity]     = useState(health.focusClarity      ?? "");
  const [socialInteraction,setSocialInteraction] = useState(health.socialInteraction ?? "");
  const [energyLevel,      setEnergyLevel]      = useState(health.energyLevel       ?? "");

  // Joy & Life
  const initJoy = health.joy ?? {
    hobbies: { ...EMPTY_JOY }, sports: { ...EMPTY_JOY },
    social:  { ...EMPTY_JOY }, rest:   { ...EMPTY_JOY },
  };
  const [joy, setJoy] = useState<JoyProfile>(initJoy);
  function updateJoy(section: keyof JoyProfile, val: JoySection) {
    setJoy(j => ({ ...j, [section]: val }));
  }

  // Food
  const [food,            setFood]            = useState(health.food ?? "Vegetarian");
  const [availableFoods,  setAvailableFoods]  = useState<string[]>(health.availableFoods ?? []);
  const [customFood,      setCustomFood]      = useState("");
  const [foodExpanded,    setFoodExpanded]    = useState(false);

  const customFoods     = availableFoods.filter(f => !KOLKATA_FOODS.includes(f));
  const allDisplayFoods = [...KOLKATA_FOODS, ...customFoods];

  function toggleFood(f: string) {
    setAvailableFoods(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  }
  function addCustomFood() {
    const t = customFood.trim();
    if (!t || availableFoods.includes(t)) return;
    setAvailableFoods(prev => [...prev, t]);
    setCustomFood("");
  }

  // Derived read-only
  const h = parseFloat(heightCm);
  const w = parseFloat(weightKg);
  const bmi = h > 0 && w > 0 ? (w / Math.pow(h / 100, 2)).toFixed(1) : null;
  const dailyCalories = health.healthPlan?.health_targets.daily_calories_kcal ?? null;

  function addIssue() {
    const t = issueInput.trim();
    if (!t) return;
    setHealthIssues(prev => [...prev, t]);
    setIssueInput("");
  }

  function handleSave() {
    onSave({
      ...health,
      heightCm, weightKg, age,
      sleepQuality:     sleepQuality     as HealthProfile["sleepQuality"],
      mood:             mood             as HealthProfile["mood"],
      stressLevel:      stressLevel      as HealthProfile["stressLevel"],
      exercise,         sessionsPerWeek,
      bodyFatPct, waistCm, hipCm, bicepCm, chestCm,
      medicalConditions,
      healthIssues,
      focusClarity:      focusClarity      as HealthProfile["focusClarity"],
      socialInteraction: socialInteraction as HealthProfile["socialInteraction"],
      energyLevel:       energyLevel       as HealthProfile["energyLevel"],
      joy,
      food,
      availableFoods,
    });
    onClose();
  }

  // Portal mount guard
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col justify-end sm:justify-center sm:items-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full h-[88svh] flex flex-col bg-[#111] border-t border-gray-800 rounded-t-2xl shadow-2xl
          sm:h-[85svh] sm:max-w-xl sm:rounded-2xl sm:border sm:mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
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

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-5">

          {/* BMI / Calories read-only */}
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

          {/* ── General Status ── */}
          <Divider label="General Status" />

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

          <div>
            <FieldLabel>Stress level</FieldLabel>
            <div className="flex gap-2 pt-1">
              {(["Low", "Mid", "High"] as const).map(v => (
                <PillButton key={v} active={stressLevel === v} onClick={() => setStressLevel(v)}>{v}</PillButton>
              ))}
            </div>
          </div>

          {/* ── Body Measurements ── */}
          <Divider label="Body Measurements" />

          <div className="grid grid-cols-2 gap-3">
            {([
              ["Body fat %",  bodyFatPct,  setBodyFatPct],
              ["Waist (cm)",  waistCm,     setWaistCm],
              ["Hip (cm)",    hipCm,       setHipCm],
              ["Bicep (cm)",  bicepCm,     setBicepCm],
              ["Chest (cm)",  chestCm,     setChestCm],
            ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
              <div key={label}>
                <FieldLabel>{label}</FieldLabel>
                <input type="number" value={val} onChange={e => setter(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {([
              ["Focus",  focusClarity,      setFocusClarity],
              ["Social", socialInteraction, setSocialInteraction],
              ["Energy", energyLevel,       setEnergyLevel],
            ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
              <div key={label}>
                <FieldLabel>{label}</FieldLabel>
                <div className="flex flex-col gap-1.5 pt-1">
                  {(["Low", "Mid", "High"] as const).map(v => (
                    <PillButton key={v} active={val === v} onClick={() => setter(v)}>{v}</PillButton>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ── Movement ── */}
          <Divider label="Movement" />

          <div className="flex flex-wrap gap-2">
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

          {/* ── Joy & Life ── */}
          <Divider label="Joy & Life" />

          <JoySubSection label="Hobbies" options={HOBBY_OPTIONS} value={joy.hobbies} onChange={v => updateJoy("hobbies", v)} customAllowed />
          <JoySubSection label="Sports"  options={SPORT_OPTIONS}  value={joy.sports}  onChange={v => updateJoy("sports", v)}  customAllowed />
          <JoySubSection label="Social"  options={SOCIAL_OPTIONS} value={joy.social}  onChange={v => updateJoy("social", v)} />
          <JoySubSection label="Rest"    options={REST_OPTIONS}   value={joy.rest}    onChange={v => updateJoy("rest", v)}    customAllowed />

          {/* ── Food ── */}
          <Divider label="Food Preference" />

          <div className="flex flex-wrap gap-2">
            {FOOD_OPTIONS.map(f => (
              <PillButton key={f} active={food === f} onClick={() => setFood(f)}>{f}</PillButton>
            ))}
          </div>

          <div>
            <FieldLabel>What&apos;s available at home?</FieldLabel>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {(foodExpanded ? allDisplayFoods : allDisplayFoods.slice(0, 6)).map(item => (
                <button key={item} type="button" onClick={() => toggleFood(item)}
                  className={`px-3 py-1.5 rounded-lg border text-xs text-left transition-colors ${
                    availableFoods.includes(item)
                      ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                      : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500"
                  }`}>
                  {item}
                </button>
              ))}
              <div className="flex gap-1.5 col-span-2">
                <input value={customFood} onChange={e => setCustomFood(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomFood(); } }}
                  placeholder="+ Add custom food"
                  className="flex-1 min-w-0 rounded-lg border border-dashed border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition-colors"
                />
                {customFood.trim() && (
                  <button type="button" onClick={addCustomFood}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-700 bg-gray-800 text-xs text-gray-400 hover:border-indigo-500/50 hover:text-indigo-300 transition-colors flex-shrink-0">
                    Add
                  </button>
                )}
              </div>
            </div>
            <button type="button" onClick={() => setFoodExpanded(v => !v)}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              {foodExpanded ? "− Show less" : `＋ Show all (${allDisplayFoods.length} items)`}
            </button>
          </div>

          {/* ── Current Health Issues ── */}
          <Divider label="Current Physical or Mental Health Issues" />

          <div>
            <FieldLabel>Medical conditions</FieldLabel>
            <textarea value={medicalConditions} onChange={e => setMedicalConditions(e.target.value)}
              placeholder="e.g. Type 2 diabetes, hypertension, lactose intolerance…" rows={2}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-indigo-500 resize-none transition-colors"
            />
          </div>

          {/* Bullet-point issues list */}
          <div>
            <FieldLabel>Specific issues</FieldLabel>
            {healthIssues.length > 0 && (
              <ul className="mb-2 space-y-1.5">
                {healthIssues.map((issue, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2">
                    <span className="text-gray-500 mt-0.5 shrink-0">•</span>
                    <span className="flex-1 text-sm text-gray-200 leading-snug">{issue}</span>
                    <button type="button" onClick={() => setHealthIssues(prev => prev.filter((_, j) => j !== i))}
                      className="text-gray-600 hover:text-red-400 transition-colors text-xs shrink-0 mt-0.5">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                value={issueInput}
                onChange={e => setIssueInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addIssue(); } }}
                placeholder="e.g. Lower back pain, feeling anxious at night…"
                className="flex-1 min-w-0 rounded-lg border border-dashed border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition-colors"
              />
              {issueInput.trim() && (
                <button type="button" onClick={addIssue}
                  className="px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-sm text-gray-300 hover:border-indigo-500/50 hover:text-indigo-300 transition-colors shrink-0">
                  Add
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-600 mt-1.5">Each issue is a separate entry. Press Enter or tap Add.</p>
          </div>

        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 pt-3 pb-6 sm:pb-5 flex gap-2 border-t border-gray-800">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-700 bg-gray-900 hover:border-gray-500 text-sm text-gray-300 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSave}
            className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
            Save
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
