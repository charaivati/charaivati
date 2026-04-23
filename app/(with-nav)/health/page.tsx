// app/(with-nav)/health/page.tsx
"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Sparkles, Trash2 } from "lucide-react";
import { useProfile } from "@/lib/ProfileContext";
import { PillButton, FieldLabel, uid } from "@/components/self/shared";
import { safeFetchJson } from "@/hooks/useAIBlock";
import ConsentModal from "@/components/health/ConsentModal";
import type { HealthProfile, AIHealthPlan, MealCard, JoyProfile, JoySection, FrequencyType } from "@/types/self";

// ─── Constants ────────────────────────────────────────────────────────────────

const FOOD_OPTIONS     = ["Vegetarian", "Eggetarian", "Non-Vegetarian", "Vegan"];
const EXERCISE_OPTIONS = ["Yoga", "Cardio", "Strength", "Mixed"];
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

const MEAL_COLORS: Record<string, string> = {
  Breakfast: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
  Lunch:     "bg-sky-500/20 text-sky-300 border border-sky-500/40",
  Snack:     "bg-purple-500/20 text-purple-300 border border-purple-500/40",
  Dinner:    "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type SubscribedExpert = {
  subscriptionId: string;
  healthBusinessId: string;
  pageId: string;
  title: string;
  avatarUrl: string | null;
  specialty: string;
  tier: string;
  storeId: string | null;
  latestAdvice: { id: string; advice: string; adviceType: string; createdAt: string } | null;
};

type SuggestedExpert = {
  pageId: string;
  storeId: string | null;
  title: string;
  avatarUrl: string | null;
  specialty: string;
  followerCount: number;
  lowestTierPrice: number | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
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

function deriveTags(health: HealthProfile): string[] {
  const tags = new Set<string>();
  if (health.sleepQuality === "bad") tags.add("sleep");
  if (health.stressLevel === "High") { tags.add("stress"); tags.add("mental"); }
  if (health.mood === "😞") tags.add("mental");
  const h = parseFloat(String(health.heightCm ?? ""));
  const w = parseFloat(String(health.weightKg ?? ""));
  if (h > 0 && w > 0 && w / Math.pow(h / 100, 2) > 25) { tags.add("nutrition"); tags.add("fitness"); }
  return Array.from(tags);
}

function defaultHealth(): HealthProfile {
  return {
    food: "Vegetarian", exercise: "Mixed", sessionsPerWeek: 3,
    heightCm: "", weightKg: "", age: "",
    sleepQuality: undefined, mood: undefined, stressLevel: undefined,
    healthPlan: null, healthPlanGeneratedAt: null,
  };
}

// ─── JoySubSection ────────────────────────────────────────────────────────────

function JoySubSection({
  label, options, value, onChange, customAllowed = false,
}: {
  label: string; options: string[]; value: JoySection;
  onChange: (v: JoySection) => void; customAllowed?: boolean;
}) {
  const [customInput, setCustomInput] = useState("");
  function toggleType(t: string) {
    const next = value.types.includes(t) ? value.types.filter(x => x !== t) : [...value.types, t];
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
          <PillButton key={opt} active={value.types.includes(opt)} onClick={() => toggleType(opt)}>{opt}</PillButton>
        ))}
        {customAllowed && (
          <div className="flex items-center gap-1.5">
            <input type="text" value={customInput} onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
              placeholder="+ Custom"
              className="w-24 rounded-lg border border-dashed border-gray-700 bg-gray-950/40 px-2 py-1 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition-colors"
            />
            {customInput.trim() && (
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

// ─── Avatar helper ────────────────────────────────────────────────────────────

function ExpertAvatar({ avatarUrl, title, size = "sm" }: { avatarUrl: string | null; title: string; size?: "sm" | "md" }) {
  const dim = size === "md" ? "w-12 h-12 text-base" : "w-9 h-9 text-sm";
  if (avatarUrl) return <img src={avatarUrl} alt={title} className={`${dim} rounded-full object-cover shrink-0`} />;
  return (
    <div className={`${dim} rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white font-bold shrink-0`}>
      {title.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Main page content ────────────────────────────────────────────────────────

function HealthPageContent() {
  const router      = useRouter();
  const { profile } = useProfile();

  // ── Health state ──────────────────────────────────────────────────────────
  const [health, setHealth] = useState<HealthProfile>(() => ({
    ...defaultHealth(),
    ...(profile?.health ?? {}),
  }));
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  // Re-sync when profile loads (server-side data arrives)
  useEffect(() => {
    if (profile?.health) setHealth(h => ({ ...defaultHealth(), ...profile.health, ...h }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = useCallback((k: keyof HealthProfile, v: unknown) =>
    setHealth(h => ({ ...h, [k]: v })), []);

  // ── Expert state ──────────────────────────────────────────────────────────
  const [selectedId,        setSelectedId]        = useState("charaivati");
  const [subscribedExperts, setSubscribedExperts] = useState<SubscribedExpert[]>([]);
  const [suggestedExperts,  setSuggestedExperts]  = useState<SuggestedExpert[]>([]);
  const [loadingExperts,    setLoadingExperts]    = useState(true);
  const [subscribing,       setSubscribing]       = useState<SuggestedExpert | null>(null);
  const [subStatus,         setSubStatus]         = useState<"idle" | "loading" | "done" | "error">("idle");

  // ── Plan state ────────────────────────────────────────────────────────────
  const [planLoading,     setPlanLoading]     = useState(false);
  const [altLoading,      setAltLoading]      = useState<Record<string, boolean>>({});

  // ── Form state ────────────────────────────────────────────────────────────
  const [dataOpen,        setDataOpen]        = useState(false);
  const [bodyMetricsOpen, setBodyMetricsOpen] = useState(false);
  const [foodExpanded,    setFoodExpanded]    = useState(false);
  const [joyOpen,         setJoyOpen]         = useState(false);
  const [customFoodInput, setCustomFoodInput] = useState("");
  const dataRef = useRef<HTMLDivElement>(null);

  // ── Fetch subscribed + suggested experts ──────────────────────────────────
  useEffect(() => {
    let alive = true;
    async function load() {
      setLoadingExperts(true);
      try {
        const [subRes] = await Promise.all([
          fetch("/api/health/my-experts", { credentials: "include" }).then(r => r.json()),
        ]);
        if (!alive) return;
        const subs: SubscribedExpert[] = subRes.experts ?? [];
        setSubscribedExperts(subs);

        // Fetch suggestions filtered by health tags
        const tags = deriveTags(health);
        if (tags.length > 0) {
          const subPageIds = new Set(subs.map(s => s.pageId));
          const sugRes = await fetch(
            `/api/health-business/suggestions?tags=${encodeURIComponent(tags.join(","))}`,
            { credentials: "include" }
          ).then(r => r.json());
          if (!alive) return;
          setSuggestedExperts(
            (sugRes.experts ?? []).filter((e: SuggestedExpert) => !subPageIds.has(e.pageId))
          );
        }
      } catch { /* silently fail */ } finally {
        if (alive) setLoadingExperts(false);
      }
    }
    load();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Save health ───────────────────────────────────────────────────────────
  async function saveHealth() {
    setSaving(true);
    try {
      await fetch("/api/user/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ health }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  }

  // ── Meal plan actions ─────────────────────────────────────────────────────
  const availableFoods  = health.availableFoods ?? [];
  const customFoods     = availableFoods.filter(f => !KOLKATA_FOODS.includes(f));
  const allDisplayFoods = [...KOLKATA_FOODS, ...customFoods];

  function toggleFood(food: string) {
    set("availableFoods", availableFoods.includes(food)
      ? availableFoods.filter(f => f !== food)
      : [...availableFoods, food]);
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
          height_cm: health.heightCm, weight_kg: health.weightKg, age: health.age,
          body_fat_pct: health.bodyFatPct ?? "", waist_cm: health.waistCm ?? "",
          food_preference: health.food, available_foods: availableFoods,
          medical_conditions: health.medicalConditions ?? "",
          exercise_type: health.exercise, sessions_per_week: health.sessionsPerWeek,
        }),
      });
      const plan: AIHealthPlan = (!resp.ok || resp.json?._fallback)
        ? makeFallbackPlan()
        : { meals: resp.json.meals, health_targets: resp.json.health_targets, fallback: false };
      setHealth(h => ({ ...h, healthPlan: plan, healthPlanGeneratedAt: new Date().toISOString() }));
    } catch {
      setHealth(h => ({ ...h, healthPlan: makeFallbackPlan(), healthPlanGeneratedAt: new Date().toISOString() }));
    } finally { setPlanLoading(false); }
  }

  async function suggestAlternatives(mealId: string) {
    if (!health.healthPlan) return;
    const meal = health.healthPlan.meals.find(m => m.id === mealId);
    if (!meal) return;
    setAltLoading(p => ({ ...p, [mealId]: true }));
    const reqBody = JSON.stringify({
      meal: meal.meal, current_name: meal.name, available_foods: availableFoods,
      food_preference: health.food, medical_conditions: health.medicalConditions ?? "",
      calories_target: meal.calories || 400,
    });
    try {
      type FR = { ok: boolean; json: any };
      const results = await Promise.allSettled([
        safeFetchJson("/api/ai/regenerate-meal", { method: "POST", headers: { "Content-Type": "application/json" }, body: reqBody }),
        safeFetchJson("/api/ai/regenerate-meal", { method: "POST", headers: { "Content-Type": "application/json" }, body: reqBody }),
        safeFetchJson("/api/ai/regenerate-meal", { method: "POST", headers: { "Content-Type": "application/json" }, body: reqBody }),
      ]);
      const newAlts: MealCard[] = results
        .filter((r): r is PromiseFulfilledResult<FR> => r.status === "fulfilled" && r.value.ok && !r.value.json?._fallback)
        .map(r => ({ ...r.value.json, id: uid() }))
        .filter((m): m is MealCard => Boolean(m.name));
      if (newAlts.length > 0) {
        setHealth(h => h.healthPlan ? {
          ...h,
          healthPlan: { ...h.healthPlan!, mealAlternatives: { ...(h.healthPlan!.mealAlternatives ?? {}), [mealId]: newAlts } },
        } : h);
      }
    } catch { /* silently fail */ }
    finally { setAltLoading(p => { const n = { ...p }; delete n[mealId]; return n; }); }
  }

  function swapMeal(mealId: string, altIdx: number) {
    if (!health.healthPlan) return;
    const current = health.healthPlan.meals.find(m => m.id === mealId);
    if (!current) return;
    const alts = health.healthPlan.mealAlternatives?.[mealId] ?? [];
    const chosen = alts[altIdx];
    if (!chosen) return;
    setHealth(h => ({
      ...h,
      healthPlan: {
        ...h.healthPlan!,
        meals: h.healthPlan!.meals.map(m => m.id === mealId ? { ...chosen, id: mealId } : m),
        mealAlternatives: {
          ...(h.healthPlan!.mealAlternatives ?? {}),
          [mealId]: [{ ...current, id: uid() }, ...alts.filter((_, i) => i !== altIdx)],
        },
      },
    }));
  }

  function deleteMeal(mealId: string) {
    if (!health.healthPlan) return;
    const remaining = health.healthPlan.meals.filter(m => m.id !== mealId);
    if (remaining.length === 0) {
      setHealth(h => ({ ...h, healthPlan: null, healthPlanGeneratedAt: null }));
      return;
    }
    const { [mealId]: _r, ...restAlts } = health.healthPlan.mealAlternatives ?? {};
    setHealth(h => ({ ...h, healthPlan: { ...h.healthPlan!, meals: remaining, mealAlternatives: restAlts } }));
  }

  // ── Subscribe ─────────────────────────────────────────────────────────────
  async function handleSubscribeConfirm(expert: SuggestedExpert, consentFields: string[]) {
    setSubStatus("loading");
    try {
      await fetch(`/api/pages/${expert.pageId}/subscribe`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: "basic",
          consentGranted: true,
          consentTimestamp: new Date().toISOString(),
          consentFields,
        }),
      });
      setSubscribing(null);
      setSubStatus("done");
      // Refetch subscribed list
      const res = await fetch("/api/health/my-experts", { credentials: "include" }).then(r => r.json());
      setSubscribedExperts(res.experts ?? []);
      setSuggestedExperts(prev => prev.filter(e => e.pageId !== expert.pageId));
      setSelectedId(expert.pageId);
      setTimeout(() => setSubStatus("idle"), 3000);
    } catch {
      setSubStatus("error");
      setTimeout(() => setSubStatus("idle"), 3000);
    }
  }

  // ── Derived header values ─────────────────────────────────────────────────
  const hcm = parseFloat(String(health.heightCm ?? ""));
  const wkg  = parseFloat(String(health.weightKg ?? ""));
  const bmi  = hcm > 0 && wkg > 0 ? (wkg / Math.pow(hcm / 100, 2)).toFixed(1) : null;
  const dailyCalories = health.healthPlan?.health_targets.daily_calories_kcal ?? null;

  const joy = health.joy ?? { hobbies: { ...EMPTY_JOY }, sports: { ...EMPTY_JOY }, social: { ...EMPTY_JOY }, rest: { ...EMPTY_JOY } };
  const setJoy = (section: keyof JoyProfile, val: JoySection) =>
    setHealth(h => ({ ...h, joy: { ...joy, [section]: val } }));

  // ── Selected expert objects ───────────────────────────────────────────────
  const selectedSubscribed = subscribedExperts.find(e => e.pageId === selectedId);
  const selectedSuggested  = suggestedExperts.find(e => e.pageId === selectedId);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 pb-20">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-5 pb-4">
          <button type="button" onClick={() => router.back()}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-white">Health</h1>
            {(bmi || dailyCalories) && (
              <p className="text-xs text-gray-500 mt-0.5">
                {bmi && <span>BMI {bmi}</span>}
                {bmi && dailyCalories && <span className="mx-1.5">·</span>}
                {dailyCalories && <span>{dailyCalories} kcal/day</span>}
              </p>
            )}
          </div>
        </div>

        {/* ── Expert Selector Row ─────────────────────────────────────────── */}
        <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory -mx-4 px-4">

          {/* Charaivati Health — always first */}
          <button type="button" onClick={() => setSelectedId("charaivati")}
            className={`flex-shrink-0 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border snap-start transition-colors ${
              selectedId === "charaivati"
                ? "border-indigo-500/60 bg-indigo-950/60"
                : "border-gray-800 bg-gray-900/60 hover:border-gray-700"
            }`}>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-xs font-medium text-white leading-tight">Charaivati Health</p>
              <span className="inline-flex items-center gap-0.5 text-[10px] text-violet-400">
                <Sparkles className="w-2.5 h-2.5" /> AI · Free
              </span>
            </div>
          </button>

          {/* Subscribed experts */}
          {subscribedExperts.map(exp => (
            <button key={exp.pageId} type="button" onClick={() => setSelectedId(exp.pageId)}
              className={`flex-shrink-0 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border snap-start transition-colors ${
                selectedId === exp.pageId
                  ? "border-emerald-500/60 bg-emerald-950/40"
                  : "border-gray-800 bg-gray-900/60 hover:border-gray-700"
              }`}>
              <ExpertAvatar avatarUrl={exp.avatarUrl} title={exp.title} />
              <div className="text-left min-w-0">
                <p className="text-xs font-medium text-white leading-tight line-clamp-1">{exp.title}</p>
                <span className="text-[10px] text-emerald-400 capitalize">{exp.specialty}</span>
              </div>
            </button>
          ))}

          {/* Suggested experts */}
          {suggestedExperts.map(exp => (
            <button key={exp.pageId} type="button" onClick={() => setSelectedId(exp.pageId)}
              className={`flex-shrink-0 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border snap-start transition-colors ${
                selectedId === exp.pageId
                  ? "border-gray-500 bg-gray-800/60"
                  : "border-gray-800 bg-gray-900/40 hover:border-gray-700"
              }`}>
              <ExpertAvatar avatarUrl={exp.avatarUrl} title={exp.title} />
              <div className="text-left min-w-0">
                <p className="text-xs font-medium text-white leading-tight line-clamp-1">{exp.title}</p>
                <span className="text-[10px] text-gray-500">Suggested</span>
              </div>
            </button>
          ))}

          {loadingExperts && (
            <div className="flex-shrink-0 flex items-center gap-2 px-3.5 py-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
              <span className="text-xs text-gray-600">Loading…</span>
            </div>
          )}
        </div>

        {/* ── Content Panel ───────────────────────────────────────────────── */}
        <div className="mt-2 space-y-4">

          {/* ── Charaivati Health panel ──────────────────────────────────── */}
          {selectedId === "charaivati" && (
            <div className="space-y-4">

              {/* Analysis card */}
              {health.healthPlan && (
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3">
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
                    {health.healthPlan.health_targets.target_body_fat_pct != null && (
                      <div>
                        <span className="text-xs text-gray-500 block mb-0.5">Target Body Fat</span>
                        <span className="text-white font-semibold text-sm">{health.healthPlan.health_targets.target_body_fat_pct}%</span>
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-gray-500 block mb-0.5">Daily Calories</span>
                      <span className="text-white font-semibold text-sm">{health.healthPlan.health_targets.daily_calories_kcal} kcal</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Meal plan */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Meal Plan</p>
                <div className="flex items-center gap-3 flex-wrap mb-4">
                  <button type="button" onClick={generateHealthPlan} disabled={planLoading}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
                      health.healthPlan
                        ? "border border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-300"
                        : "bg-indigo-600 hover:bg-indigo-500 text-white"
                    }`}>
                    {planLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</>
                      : health.healthPlan ? <>↺ Regenerate</> : <>Generate meal plan →</>}
                  </button>
                  {health.healthPlanGeneratedAt && (
                    <p className="text-xs text-gray-500">Last: {relativeTime(health.healthPlanGeneratedAt)}</p>
                  )}
                </div>

                {health.healthPlan && (
                  <div>
                    {health.healthPlan.fallback && (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-300 mb-3">
                        AI unavailable — placeholder plan. Try regenerating later.
                      </div>
                    )}
                    <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory -mx-4 px-4">
                      {health.healthPlan.meals.map(meal => (
                        <div key={meal.id}
                          className="flex-shrink-0 w-64 rounded-xl border border-gray-800 bg-gray-950/60 p-4 space-y-2.5 snap-start">
                          <div className="flex items-center justify-between">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${MEAL_COLORS[meal.meal] ?? ""}`}>
                              {meal.meal}
                            </span>
                            <button type="button" onClick={() => deleteMeal(meal.id)}
                              className="p-1 rounded-md text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-colors">
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
                                    <p className="text-xs text-gray-500 mt-0.5">{alt.calories} kcal · P {alt.protein_g}g</p>
                                  </div>
                                  <button type="button" onClick={() => swapMeal(meal.id, i)}
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
                              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-400 transition-colors disabled:opacity-40">
                              {altLoading[meal.id]
                                ? <><Loader2 className="w-3 h-3 animate-spin" />Fetching…</>
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
          )}

          {/* ── Subscribed expert panel ──────────────────────────────────── */}
          {selectedSubscribed && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <ExpertAvatar avatarUrl={selectedSubscribed.avatarUrl} title={selectedSubscribed.title} size="md" />
                <div>
                  <p className="text-sm font-semibold text-white">{selectedSubscribed.title}</p>
                  <p className="text-xs text-emerald-400 capitalize">{selectedSubscribed.specialty} · {selectedSubscribed.tier} plan</p>
                </div>
              </div>

              {selectedSubscribed.latestAdvice ? (
                <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 capitalize">
                      {selectedSubscribed.latestAdvice.adviceType}
                    </span>
                    <span className="text-[10px] text-gray-600">
                      · {relativeTime(selectedSubscribed.latestAdvice.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {selectedSubscribed.latestAdvice.advice}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-700 p-5 text-center">
                  <p className="text-sm text-gray-400">
                    Waiting for {selectedSubscribed.title.split(" ")[0]}&apos;s first suggestion
                  </p>
                  <p className="text-xs text-gray-600 mt-1">They&apos;ll see your consented health data and respond personally</p>
                </div>
              )}

              {selectedSubscribed.storeId && (
                <a href={`/store/${selectedSubscribed.storeId}`}
                  className="flex items-center justify-center w-full py-2.5 rounded-xl border border-gray-700 bg-gray-900 text-sm text-gray-300 hover:bg-gray-800 transition-colors">
                  Visit their store →
                </a>
              )}
            </div>
          )}

          {/* ── Suggested expert panel ───────────────────────────────────── */}
          {selectedSuggested && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <ExpertAvatar avatarUrl={selectedSuggested.avatarUrl} title={selectedSuggested.title} size="md" />
                <div>
                  <p className="text-sm font-semibold text-white">{selectedSuggested.title}</p>
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-emerald-900/40 text-emerald-400 border border-emerald-800/40 capitalize">
                    {selectedSuggested.specialty}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-3">
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{selectedSuggested.followerCount} follower{selectedSuggested.followerCount !== 1 ? "s" : ""}</span>
                  {selectedSuggested.lowestTierPrice != null && (
                    <span>from ₹{selectedSuggested.lowestTierPrice}/mo</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Subscribe to share your health data and receive personalized advice from {selectedSuggested.title}.
                </p>
              </div>

              {subStatus === "done" && (
                <div className="rounded-lg bg-emerald-900/20 border border-emerald-700/30 px-4 py-2.5 text-sm text-emerald-400">
                  Subscribed successfully
                </div>
              )}
              {subStatus === "error" && (
                <div className="rounded-lg bg-red-900/20 border border-red-700/30 px-4 py-2.5 text-sm text-red-400">
                  Subscription failed — please try again
                </div>
              )}

              <button type="button"
                disabled={subStatus === "loading"}
                onClick={() => setSubscribing(selectedSuggested)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium hover:from-emerald-600 hover:to-teal-700 transition-all disabled:opacity-50">
                {subStatus === "loading" ? "Subscribing…" : "Subscribe"}
              </button>

              {selectedSuggested.storeId && (
                <a href={`/store/${selectedSuggested.storeId}`}
                  className="flex items-center justify-center w-full py-2.5 rounded-xl border border-gray-700 bg-gray-900 text-sm text-gray-300 hover:bg-gray-800 transition-colors">
                  View store →
                </a>
              )}
            </div>
          )}

        </div>

        {/* ── Health Data Section (collapsible) ──────────────────────────── */}
        <div ref={dataRef} className="mt-8">
          <button type="button"
            onClick={() => setDataOpen(v => !v)}
            className="flex items-center justify-between w-full py-3 border-t border-gray-800">
            <span className="text-sm font-semibold text-gray-300">Your Health Data</span>
            <span className="text-xs text-indigo-400">{dataOpen ? "− Collapse" : "+ Expand"}</span>
          </button>

          {dataOpen && (
            <div className="space-y-5 pt-2 pb-6">

              {/* General Status */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">General Status</p>

              <div className="grid grid-cols-3 gap-3">
                {(["heightCm", "weightKg", "age"] as const).map(k => (
                  <div key={k}>
                    <FieldLabel>{k === "heightCm" ? "Height (cm)" : k === "weightKg" ? "Weight (kg)" : "Age"}</FieldLabel>
                    <input type="number" value={health[k] ?? ""} onChange={e => set(k, e.target.value)}
                      placeholder={k === "heightCm" ? "170" : k === "weightKg" ? "65" : "28"}
                      className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <FieldLabel>Sleep quality</FieldLabel>
                  <select value={health.sleepQuality ?? ""}
                    onChange={e => set("sleepQuality", e.target.value as "bad" | "moderate" | "good")}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer">
                    <option value="" disabled>Select…</option>
                    <option value="bad">Bad · &lt;6 hrs</option>
                    <option value="moderate">Moderate · disturbed 6+</option>
                    <option value="good">Good · 6–8 hrs</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>Mood</FieldLabel>
                  <select value={health.mood ?? ""}
                    onChange={e => set("mood", e.target.value as "😞" | "😐" | "🙂" | "😄")}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer">
                    <option value="" disabled>Select…</option>
                    <option value="😞">😞 Low</option>
                    <option value="😐">😐 Neutral</option>
                    <option value="🙂">🙂 Good</option>
                    <option value="😄">😄 Great</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>Stress level</FieldLabel>
                  <div className="flex gap-2 pt-0.5">
                    {(["Low", "Mid", "High"] as const).map(v => (
                      <PillButton key={v} active={health.stressLevel === v} onClick={() => set("stressLevel", v)}>{v}</PillButton>
                    ))}
                  </div>
                </div>
              </div>

              {/* More info expandable */}
              <div>
                <button type="button" onClick={() => setBodyMetricsOpen(v => !v)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                  {bodyMetricsOpen ? "− Less information" : "＋ More information"}
                </button>
                {bodyMetricsOpen && (
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {([["bodyFatPct","Body fat %"],["waistCm","Waist (cm)"],["hipCm","Hip (cm)"],["bicepCm","Bicep (cm)"],["chestCm","Chest (cm)"]] as [keyof HealthProfile, string][]).map(([k, label]) => (
                        <div key={k}>
                          <FieldLabel>{label}</FieldLabel>
                          <input type="number" value={(health[k] as string) ?? ""} onChange={e => set(k, e.target.value)}
                            className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
                          />
                        </div>
                      ))}
                    </div>
                    <div>
                      <FieldLabel>Medical conditions (optional)</FieldLabel>
                      <textarea value={health.medicalConditions ?? ""} onChange={e => set("medicalConditions", e.target.value)}
                        placeholder="e.g. Type 2 diabetes, lactose intolerance…" rows={2}
                        className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-indigo-500 resize-none transition-colors"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {([["focusClarity","Focus / Clarity"],["socialInteraction","Social"],["energyLevel","Energy"]] as [keyof HealthProfile, string][]).map(([k, label]) => (
                        <div key={k}>
                          <FieldLabel>{label}</FieldLabel>
                          <div className="flex gap-2 pt-0.5">
                            {(["Low", "Mid", "High"] as const).map(v => (
                              <PillButton key={v} active={health[k] === v} onClick={() => set(k, v)}>{v}</PillButton>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="h-px bg-gray-800" />

              {/* Movement */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Movement</p>
              <div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {EXERCISE_OPTIONS.map(e => (
                    <PillButton key={e} active={health.exercise === e} onClick={() => set("exercise", e)}>{e}</PillButton>
                  ))}
                </div>
                <div className="flex gap-2">
                  {[2,3,4,5].map(n => (
                    <PillButton key={n} active={health.sessionsPerWeek === n} onClick={() => set("sessionsPerWeek", n)}>{n}×/wk</PillButton>
                  ))}
                </div>
              </div>

              <div className="h-px bg-gray-800" />

              {/* Joy & Life */}
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
                    <JoySubSection label="Hobbies" options={HOBBY_OPTIONS} value={joy.hobbies} onChange={v => setJoy("hobbies", v)} customAllowed />
                    <JoySubSection label="Sports"  options={SPORT_OPTIONS}  value={joy.sports}  onChange={v => setJoy("sports", v)}  customAllowed />
                    <JoySubSection label="Social"  options={SOCIAL_OPTIONS} value={joy.social}  onChange={v => setJoy("social", v)} />
                    <JoySubSection label="Rest"    options={REST_OPTIONS}   value={joy.rest}    onChange={v => setJoy("rest", v)}    customAllowed />
                  </div>
                )}
              </div>

              <div className="h-px bg-gray-800" />

              {/* Food preference */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Food Preference</p>
              <div className="flex flex-wrap gap-2">
                {FOOD_OPTIONS.map(f => (
                  <PillButton key={f} active={health.food === f} onClick={() => set("food", f)}>{f}</PillButton>
                ))}
              </div>

              <div>
                <FieldLabel>What&apos;s available at home?</FieldLabel>
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  {(foodExpanded ? allDisplayFoods : allDisplayFoods.slice(0, 4)).map(food => {
                    const selected = availableFoods.includes(food);
                    return (
                      <button key={food} type="button" onClick={() => toggleFood(food)}
                        className={`px-3 py-1.5 rounded-lg border text-xs text-left transition-colors ${
                          selected ? "border-indigo-500 bg-indigo-500/20 text-indigo-300" : "border-gray-700 bg-gray-950/40 text-gray-400 hover:border-gray-500"
                        }`}>
                        {food}
                      </button>
                    );
                  })}
                  <div className="flex gap-1.5 col-span-2">
                    <input type="text" value={customFoodInput} onChange={e => setCustomFoodInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomFood(); } }}
                      placeholder="+ Add custom food"
                      className="flex-1 min-w-0 rounded-lg border border-dashed border-gray-700 bg-gray-950/40 px-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition-colors"
                    />
                    {customFoodInput.trim() && (
                      <button type="button" onClick={addCustomFood}
                        className="px-2.5 py-1.5 rounded-lg border border-gray-700 bg-gray-800 text-xs text-gray-400 hover:border-indigo-500/50 hover:text-indigo-300 transition-colors flex-shrink-0">
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

              {/* Save button */}
              <button type="button" onClick={saveHealth} disabled={saving}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors disabled:opacity-50">
                {saving ? "Saving…" : saved ? "Saved ✓" : "Save Health Data"}
              </button>

            </div>
          )}
        </div>

      </div>

      {/* ── Consent modal ──────────────────────────────────────────────────── */}
      {subscribing && (
        <ConsentModal
          expertName={subscribing.title}
          onConfirm={(fields) => handleSubscribeConfirm(subscribing, fields)}
          onCancel={() => setSubscribing(null)}
        />
      )}
    </div>
  );
}

export default function HealthPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500 text-sm">Loading…</div>}>
      <HealthPageContent />
    </Suspense>
  );
}
