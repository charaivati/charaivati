"use client";
// blocks/HealthBlock.tsx — HealthSection and all health-specific helpers

import React, { useState } from "react";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { CollapsibleSection, PillButton, FieldLabel, TextInput, FallbackBanner, uid } from "@/components/self/shared";
import { safeFetchJson } from "@/hooks/useAIBlock";
import type { HealthProfile, AIHealthPlan, MealCard, JoyProfile, JoySection, FrequencyType } from "@/types/self";

export type { HealthProfile, AIHealthPlan };

// ─── Constants ────────────────────────────────────────────────────────────────

const FOOD_OPTIONS     = ["Vegetarian", "Eggetarian", "Non-Vegetarian", "Vegan"];
const EXERCISE_OPTIONS = ["Yoga", "Cardio", "Strength", "Mixed"];

export const KOLKATA_FOODS = [
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
  { value: "daily",        label: "Daily"    },
  { value: "few_per_week", label: "Few×/wk"  },
  { value: "weekly",       label: "Weekly"   },
  { value: "rarely",       label: "Rarely"   },
];

const EMPTY_JOY_SECTION: JoySection = { types: [], frequency: "weekly" };

const MEAL_COLORS: Record<string, string> = {
  Breakfast: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
  Lunch:     "bg-sky-500/20 text-sky-300 border border-sky-500/40",
  Snack:     "bg-purple-500/20 text-purple-300 border border-purple-500/40",
  Dinner:    "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function makeFallbackPlan(): AIHealthPlan {
  return {
    meals: [
      { id: uid(), meal: "Breakfast", name: "Placeholder Breakfast", ingredients: [], calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, prep_minutes: 0 },
      { id: uid(), meal: "Lunch",     name: "Placeholder Lunch",     ingredients: [], calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, prep_minutes: 0 },
      { id: uid(), meal: "Snack",     name: "Placeholder Snack",     ingredients: [], calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, prep_minutes: 0 },
      { id: uid(), meal: "Dinner",    name: "Placeholder Dinner",    ingredients: [], calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, prep_minutes: 0 },
    ],
    health_targets: { target_bmi: 22, target_body_fat_pct: null, daily_calories_kcal: 2000, notes: "AI unavailable — placeholder plan" },
    fallback: true,
  };
}

// ─── JoySubSection ────────────────────────────────────────────────────────────

function JoySubSection({
  label,
  options,
  value,
  onChange,
  customAllowed = false,
}: {
  label: string;
  options: string[];
  value: JoySection;
  onChange: (v: JoySection) => void;
  customAllowed?: boolean;
}) {
  const [customInput, setCustomInput] = useState("");

  function toggleType(t: string) {
    const next = value.types.includes(t)
      ? value.types.filter(x => x !== t)
      : [...value.types, t];
    onChange({ ...value, types: next });
  }

  function addCustom() {
    const t = customInput.trim();
    if (!t) return;
    if (!value.types.includes(t)) onChange({ ...value, types: [...value.types, t] });
    setCustomInput("");
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <PillButton key={opt} active={value.types.includes(opt)} onClick={() => toggleType(opt)}>
            {opt}
          </PillButton>
        ))}
        {customAllowed && (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
              placeholder="+ Custom"
              className="w-24 rounded-lg border border-dashed border-gray-700 bg-gray-950/40
                px-2 py-1 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition-colors"
            />
            {customInput.trim() && (
              <button type="button" onClick={addCustom}
                className="px-2 py-1 rounded-lg border border-gray-700 bg-gray-800 text-xs text-gray-400
                  hover:border-indigo-500/50 hover:text-indigo-300 transition-colors">
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

// ─── Health Section ───────────────────────────────────────────────────────────

export function HealthSection({ health, setHealth }: {
  health: HealthProfile;
  setHealth: (h: HealthProfile) => void;
}) {
  const [bodyMetricsOpen, setBodyMetricsOpen] = useState(false);
  const [foodExpanded,    setFoodExpanded]    = useState(false);
  const [joyOpen,         setJoyOpen]         = useState(false);
  const [planLoading,     setPlanLoading]     = useState(false);
  const [altLoading,      setAltLoading]      = useState<Record<string, boolean>>({});
  const [customFoodInput, setCustomFoodInput] = useState("");

  const set = (k: keyof HealthProfile, v: string | number | string[] | AIHealthPlan | null) =>
    setHealth({ ...health, [k]: v });

  const joy = health.joy ?? {
    hobbies: { ...EMPTY_JOY_SECTION },
    sports:  { ...EMPTY_JOY_SECTION },
    social:  { ...EMPTY_JOY_SECTION },
    rest:    { ...EMPTY_JOY_SECTION },
  };
  const setJoy = (section: keyof JoyProfile, val: JoySection) =>
    setHealth({ ...health, joy: { ...joy, [section]: val } });

  const availableFoods  = health.availableFoods ?? [];
  const customFoods     = availableFoods.filter(f => !KOLKATA_FOODS.includes(f));
  const allDisplayFoods = [...KOLKATA_FOODS, ...customFoods];

  function toggleFood(food: string) {
    const next = availableFoods.includes(food)
      ? availableFoods.filter(f => f !== food)
      : [...availableFoods, food];
    set("availableFoods", next);
  }

  function addCustomFood() {
    const t = customFoodInput.trim();
    if (!t) return;
    if (!availableFoods.includes(t)) set("availableFoods", [...availableFoods, t]);
    setCustomFoodInput("");
  }

  async function generateHealthPlan() {
    setPlanLoading(true);
    try {
      const resp = await safeFetchJson("/api/ai/generate-health-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          height_cm:          health.heightCm,
          weight_kg:          health.weightKg,
          age:                health.age,
          body_fat_pct:       health.bodyFatPct      ?? "",
          waist_cm:           health.waistCm         ?? "",
          food_preference:    health.food,
          available_foods:    availableFoods,
          medical_conditions: health.medicalConditions ?? "",
          exercise_type:      health.exercise,
          sessions_per_week:  health.sessionsPerWeek,
        }),
      });
      if (!resp.ok || resp.json?._fallback) {
        setHealth({ ...health, healthPlan: makeFallbackPlan(), healthPlanGeneratedAt: new Date().toISOString() });
        return;
      }
      const plan: AIHealthPlan = { meals: resp.json.meals, health_targets: resp.json.health_targets, fallback: false };
      setHealth({ ...health, healthPlan: plan, healthPlanGeneratedAt: new Date().toISOString() });
    } catch {
      setHealth({ ...health, healthPlan: makeFallbackPlan(), healthPlanGeneratedAt: new Date().toISOString() });
    } finally {
      setPlanLoading(false);
    }
  }

  async function suggestAlternatives(mealId: string) {
    if (!health.healthPlan) return;
    const meal = health.healthPlan.meals.find(m => m.id === mealId);
    if (!meal) return;
    setAltLoading(prev => ({ ...prev, [mealId]: true }));
    const reqBody = JSON.stringify({
      meal:               meal.meal,
      current_name:       meal.name,
      available_foods:    availableFoods,
      food_preference:    health.food,
      medical_conditions: health.medicalConditions ?? "",
      calories_target:    meal.calories || 400,
    });
    try {
      type FetchResult = { ok: boolean; status: number; json: any };
      const results = await Promise.allSettled([
        safeFetchJson("/api/ai/regenerate-meal", { method: "POST", headers: { "Content-Type": "application/json" }, body: reqBody }),
        safeFetchJson("/api/ai/regenerate-meal", { method: "POST", headers: { "Content-Type": "application/json" }, body: reqBody }),
        safeFetchJson("/api/ai/regenerate-meal", { method: "POST", headers: { "Content-Type": "application/json" }, body: reqBody }),
      ]);
      const newAlts: MealCard[] = results
        .filter((r): r is PromiseFulfilledResult<FetchResult> => r.status === "fulfilled" && r.value.ok && !r.value.json?._fallback)
        .map(r => ({ ...r.value.json, id: uid() }))
        .filter((m): m is MealCard => Boolean(m.name));
      if (newAlts.length > 0) {
        const updatedPlan: AIHealthPlan = {
          ...health.healthPlan,
          mealAlternatives: { ...(health.healthPlan.mealAlternatives ?? {}), [mealId]: newAlts },
        };
        setHealth({ ...health, healthPlan: updatedPlan });
      }
    } catch {
      // silently fail
    } finally {
      setAltLoading(prev => { const n = { ...prev }; delete n[mealId]; return n; });
    }
  }

  function swapMealWithAlternative(mealId: string, altIdx: number) {
    if (!health.healthPlan) return;
    const current = health.healthPlan.meals.find(m => m.id === mealId);
    if (!current) return;
    const alts   = health.healthPlan.mealAlternatives?.[mealId] ?? [];
    const chosen = alts[altIdx];
    if (!chosen) return;
    const remainingAlts = alts.filter((_, i) => i !== altIdx);
    const updatedPlan: AIHealthPlan = {
      ...health.healthPlan,
      meals: health.healthPlan.meals.map(m => m.id === mealId ? { ...chosen, id: mealId } : m),
      mealAlternatives: {
        ...(health.healthPlan.mealAlternatives ?? {}),
        [mealId]: [{ ...current, id: uid() }, ...remainingAlts],
      },
    };
    setHealth({ ...health, healthPlan: updatedPlan });
  }

  function deleteMeal(mealId: string) {
    if (!health.healthPlan) return;
    const remaining = health.healthPlan.meals.filter(m => m.id !== mealId);
    if (remaining.length === 0) {
      setHealth({ ...health, healthPlan: null, healthPlanGeneratedAt: null });
      return;
    }
    const { [mealId]: _removed, ...restAlts } = health.healthPlan.mealAlternatives ?? {};
    setHealth({ ...health, healthPlan: { ...health.healthPlan, meals: remaining, mealAlternatives: restAlts } });
  }

  return (
    <CollapsibleSection title="Health">
      <div className="space-y-5 pt-2">

        {/* ── General Status ── */}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">General Status</p>

        {/* A. Core inputs */}
        <div className="grid grid-cols-3 gap-3">
          {(["heightCm", "weightKg", "age"] as const).map(k => (
            <div key={k}>
              <FieldLabel>{k === "heightCm" ? "Height (cm)" : k === "weightKg" ? "Weight (kg)" : "Age"}</FieldLabel>
              <input type="number" value={health[k]} onChange={e => set(k, e.target.value)}
                placeholder={k === "heightCm" ? "170" : k === "weightKg" ? "65" : "28"}
                className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm
                  text-white placeholder-gray-600 outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          ))}
        </div>

        {/* B. Daily vitals — Sleep, Mood, Stress */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Sleep quality */}
          <div>
            <FieldLabel>Sleep quality</FieldLabel>
            <select
              value={health.sleepQuality ?? ""}
              onChange={e => set("sleepQuality", e.target.value as "bad" | "moderate" | "good")}
              className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm
                text-white outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer">
              <option value="" disabled>Select…</option>
              <option value="bad">Bad · &lt;6 hrs</option>
              <option value="moderate">Moderate · disturbed 6+</option>
              <option value="good">Good · 6–8 hrs</option>
            </select>
          </div>

          {/* Mood */}
          <div>
            <FieldLabel>Mood</FieldLabel>
            <select
              value={health.mood ?? ""}
              onChange={e => set("mood", e.target.value as "😞" | "😐" | "🙂" | "😄")}
              className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm
                text-white outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer">
              <option value="" disabled>Select…</option>
              <option value="😞">😞 Low</option>
              <option value="😐">😐 Neutral</option>
              <option value="🙂">🙂 Good</option>
              <option value="😄">😄 Great</option>
            </select>
          </div>

          {/* Stress level */}
          <div>
            <FieldLabel>Stress level</FieldLabel>
            <div className="flex gap-2 pt-0.5">
              {(["Low", "Mid", "High"] as const).map(v => (
                <PillButton key={v} active={health.stressLevel === v} onClick={() => set("stressLevel", v)}>
                  {v}
                </PillButton>
              ))}
            </div>
          </div>
        </div>

        {/* C. More information (expandable) */}
        <div>
          <button type="button" onClick={() => setBodyMetricsOpen(v => !v)}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            {bodyMetricsOpen ? "− Less information" : "＋ More information"}
          </button>
          {bodyMetricsOpen && (
            <div className="mt-4 space-y-4">
              {/* Body measurements */}
              <div className="grid grid-cols-2 gap-3">
                {([
                  ["bodyFatPct", "Body fat %"],
                  ["waistCm",   "Waist (cm)"],
                  ["hipCm",     "Hip (cm)"],
                  ["bicepCm",   "Bicep (cm)"],
                  ["chestCm",   "Chest (cm)"],
                ] as [keyof HealthProfile, string][]).map(([k, label]) => (
                  <div key={k}>
                    <FieldLabel>{label}</FieldLabel>
                    <input type="number" value={(health[k] as string) ?? ""}
                      onChange={e => set(k, e.target.value)}
                      className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm
                        text-white placeholder-gray-600 outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                ))}
              </div>

              {/* Medical conditions */}
              <div>
                <FieldLabel>Medical conditions (optional)</FieldLabel>
                <textarea
                  value={health.medicalConditions ?? ""}
                  onChange={e => set("medicalConditions", e.target.value)}
                  placeholder="e.g. Type 2 diabetes, lactose intolerance, hypertension…"
                  rows={2}
                  className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm
                    text-white placeholder-gray-600 outline-none focus:border-indigo-500 resize-none transition-colors"
                />
              </div>

              {/* Extra daily stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([
                  ["focusClarity",     "Focus / Mental Clarity"],
                  ["socialInteraction","Social Interaction"],
                  ["energyLevel",      "Energy Level"],
                ] as [keyof HealthProfile, string][]).map(([k, label]) => (
                  <div key={k}>
                    <FieldLabel>{label}</FieldLabel>
                    <div className="flex gap-2 pt-0.5">
                      {(["Low", "Mid", "High"] as const).map(v => (
                        <PillButton key={v} active={health[k] === v} onClick={() => set(k, v)}>
                          {v}
                        </PillButton>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="h-[2px] rounded-full bg-gradient-to-r from-transparent via-gray-700 to-transparent" />
        {/* ── Movement ── */}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Movement</p>

        {/* D. Movement — before food */}
        <div>
          <div className="flex flex-wrap gap-2 mb-2">
            {EXERCISE_OPTIONS.map(e => (
              <PillButton key={e} active={health.exercise === e} onClick={() => set("exercise", e)}>{e}</PillButton>
            ))}
          </div>
          <div className="flex gap-2">
            {[2, 3, 4, 5].map(n => (
              <PillButton key={n} active={health.sessionsPerWeek === n} onClick={() => set("sessionsPerWeek", n)}>
                {n}×/wk
              </PillButton>
            ))}
          </div>
        </div>

        <div className="h-[2px] rounded-full bg-gradient-to-r from-transparent via-gray-700 to-transparent" />

        {/* ── Joy & Life ── */}
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Joy &amp; Life</p>
            <button type="button" onClick={() => setJoyOpen(v => !v)}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              {joyOpen ? "− Collapse" : "＋ Expand"}
            </button>
          </div>
          {joyOpen && (
            <div className="mt-4 space-y-5">
              <JoySubSection
                label="Hobbies"
                options={HOBBY_OPTIONS}
                value={joy.hobbies}
                onChange={val => setJoy("hobbies", val)}
                customAllowed
              />
              <JoySubSection
                label="Sports"
                options={SPORT_OPTIONS}
                value={joy.sports}
                onChange={val => setJoy("sports", val)}
                customAllowed
              />
              <JoySubSection
                label="Social"
                options={SOCIAL_OPTIONS}
                value={joy.social}
                onChange={val => setJoy("social", val)}
              />
              <JoySubSection
                label="Rest"
                options={REST_OPTIONS}
                value={joy.rest}
                onChange={val => setJoy("rest", val)}
                customAllowed
              />
            </div>
          )}
        </div>

        <div className="h-[2px] rounded-full bg-gradient-to-r from-transparent via-gray-700 to-transparent" />
        {/* ── Food Preference ── */}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Food Preference</p>

        {/* E. Food preference pills */}
        <div>
          <div className="flex flex-wrap gap-2">
            {FOOD_OPTIONS.map(f => (
              <PillButton key={f} active={health.food === f} onClick={() => set("food", f)}>{f}</PillButton>
            ))}
          </div>
        </div>

        {/* F. Available foods grid */}
        <div>
          <FieldLabel>What's available at home?</FieldLabel>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            {(foodExpanded ? allDisplayFoods : allDisplayFoods.slice(0, 2)).map(food => {
              const selected = availableFoods.includes(food);
              return (
                <button key={food} type="button" onClick={() => toggleFood(food)}
                  className={`px-3 py-1.5 rounded-lg border text-xs text-left transition-colors ${
                    selected
                      ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                      : "border-gray-700 bg-gray-950/40 text-gray-400 hover:border-gray-500"
                  }`}>
                  {food}
                </button>
              );
            })}
            {/* Custom food input as last grid cell */}
            <div className="flex gap-1.5">
              <input
                type="text"
                value={customFoodInput}
                onChange={e => setCustomFoodInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomFood(); } }}
                placeholder="+ Add custom food"
                className="flex-1 min-w-0 rounded-lg border border-dashed border-gray-700 bg-gray-950/40
                  px-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none
                  focus:border-indigo-500 transition-colors"
              />
              {customFoodInput.trim() && (
                <button type="button" onClick={addCustomFood}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-700 bg-gray-800 text-xs text-gray-400
                    hover:border-indigo-500/50 hover:text-indigo-300 transition-colors flex-shrink-0">
                  Add
                </button>
              )}
            </div>
          </div>
          <button type="button" onClick={() => setFoodExpanded(v => !v)}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors mt-1">
            {foodExpanded ? "− Collapse" : `＋ Expand all (${allDisplayFoods.length} items)`}
          </button>
        </div>

        <div className="h-[2px] rounded-full bg-gradient-to-r from-transparent via-gray-700 to-transparent" />
        {/* ── Analysis ── */}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Analysis of Lifestyle and Suggestions</p>

        {/* G. Analysis of lifestyle — shown after first generation */}
        {health.healthPlan && (
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 overflow-hidden">
            <div className="px-4 pt-4 pb-3">
              {(health.healthPlan.health_targets.insight || health.healthPlan.health_targets.notes) && (
                <p className="text-sm text-gray-200 leading-relaxed mb-3">
                  {health.healthPlan.health_targets.insight || health.healthPlan.health_targets.notes}
                </p>
              )}
              <div className="flex flex-wrap gap-5">
                <div>
                  <span className="text-xs text-gray-500 block mb-0.5">Target BMI</span>
                  <span className="text-white font-semibold text-sm">{health.healthPlan.health_targets.target_bmi}</span>
                </div>
                {health.healthPlan.health_targets.target_body_fat_pct !== null && (
                  <div>
                    <span className="text-xs text-gray-500 block mb-0.5">Target Body Fat</span>
                    <span className="text-white font-semibold text-sm">{health.healthPlan.health_targets.target_body_fat_pct}%</span>
                  </div>
                )}
                <div>
                  <span className="text-xs text-gray-500 block mb-0.5">Daily Calories</span>
                  <span className="text-white font-semibold text-sm">{health.healthPlan.health_targets.daily_calories_kcal} kcal</span>
                </div>
                {health.healthPlan.health_targets.insight && health.healthPlan.health_targets.notes && (
                  <div className="w-full">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border border-indigo-500/30 bg-indigo-500/10 text-indigo-300">
                      {health.healthPlan.health_targets.notes}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* H. Suggested meal plan heading + generate button */}
        <div>
          <FieldLabel>Suggested Meal Plan</FieldLabel>
          <div className="flex items-center gap-3 flex-wrap mb-4">
            <button type="button" onClick={generateHealthPlan} disabled={planLoading}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed ${
                health.healthPlan
                  ? "border border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-300"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white"
              }`}>
              {planLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</>
                : health.healthPlan
                  ? <>↺ Regenerate full plan</>
                  : <>Generate meal plan →</>}
            </button>
            {health.healthPlanGeneratedAt && (
              <p className="text-xs text-gray-500">
                Last generated: {relativeTime(health.healthPlanGeneratedAt)}
              </p>
            )}
          </div>

          {/* Meal plan carousel */}
          {health.healthPlan && (
            <div>
              {health.healthPlan.fallback && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-300 mb-3">
                  AI unavailable — this is a placeholder plan. Try regenerating later.
                </div>
              )}
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
                {health.healthPlan.meals.map(meal => (
                  <div key={meal.id}
                    className="flex-shrink-0 w-64 rounded-xl border border-gray-800 bg-gray-950/60 p-4 space-y-2.5 snap-start">

                    <div className="flex items-center justify-between">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${MEAL_COLORS[meal.meal] ?? ""}`}>
                        {meal.meal}
                      </span>
                      <button type="button" onClick={() => deleteMeal(meal.id)}
                        className="p-1 rounded-md text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        title="Remove this meal">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-sm font-semibold text-white leading-snug">{meal.name}</p>
                    {meal.ingredients.length > 0 && (
                      <p className="text-xs text-gray-400 leading-relaxed">{meal.ingredients.join(", ")}</p>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
                      <span className="text-white font-medium">{meal.calories} kcal</span>
                      <span>P {meal.protein_g}g</span>
                      <span>C {meal.carbs_g}g</span>
                      <span>F {meal.fat_g}g</span>
                    </div>
                    <p className="text-xs text-gray-500">{meal.prep_minutes} min prep</p>

                    {(health.healthPlan!.mealAlternatives?.[meal.id]?.length ?? 0) > 0 && (
                      <div className="border-t border-gray-700/60 pt-2 space-y-1.5">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Switch to</p>
                        {health.healthPlan!.mealAlternatives![meal.id].map((alt, i) => (
                          <div key={alt.id} className="flex items-start justify-between gap-2 rounded-lg bg-gray-900/80 border border-gray-800 px-2.5 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-white leading-snug truncate">{alt.name}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{alt.calories} kcal · P {alt.protein_g}g · C {alt.carbs_g}g</p>
                            </div>
                            <button type="button" onClick={() => swapMealWithAlternative(meal.id, i)}
                              className="flex-shrink-0 px-2 py-0.5 rounded text-xs bg-indigo-600 hover:bg-indigo-500 text-white transition-colors mt-0.5">
                              Use
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="border-t border-gray-800 pt-2">
                      <button type="button" onClick={() => suggestAlternatives(meal.id)}
                        disabled={!!altLoading[meal.id]}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-400
                          transition-colors disabled:opacity-40">
                        {altLoading[meal.id]
                          ? <><Loader2 className="w-3 h-3 animate-spin" />Fetching options…</>
                          : <><Sparkles className="w-3 h-3" />Try other options</>}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </CollapsibleSection>
  );
}
