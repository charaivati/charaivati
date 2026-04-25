// app/api/ai/generate-health-plan/route.ts
import { NextResponse } from "next/server";
import { chatComplete, safeJsonParse } from "@/app/api/aiClient";

const HEALTH_MODEL = process.env.HEALTH_AI_MODEL ?? "openai/gpt-4o-mini";

type Body = {
  height_cm?: string;
  weight_kg?: string;
  age?: string;
  body_fat_pct?: string;
  waist_cm?: string;
  food_preference?: string;
  available_foods?: string[];
  medical_conditions?: string;
  exercise_type?: string;
  sessions_per_week?: number;
};

type MealCard = {
  id: string;
  meal: string;
  name: string;
  ingredients: string[];
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  prep_minutes: number;
};

type HealthTargets = {
  target_bmi: number;
  target_body_fat_pct: number | null;
  daily_calories_kcal: number;
  notes: string;
  insight: string;
};

// ─── Meal fallbacks ───────────────────────────────────────────────────────────

const FALLBACK_MEALS: Record<string, Omit<MealCard, "id">> = {
  Breakfast: { meal: "Breakfast", name: "Oats & Chhana Bowl",       ingredients: ["Oats", "Chhana (paneer)", "Doi (yogurt)"],           calories: 320, protein_g: 18, carbs_g: 40, fat_g: 8,  prep_minutes: 10 },
  Lunch:     { meal: "Lunch",     name: "Dal Rice",                  ingredients: ["Dal (lentils)", "Rice (steamed)", "Begun bhaja (fried eggplant)"], calories: 480, protein_g: 22, carbs_g: 70, fat_g: 10, prep_minutes: 20 },
  Snack:     { meal: "Snack",     name: "Muri & Chanachur Mix",      ingredients: ["Muri (puffed rice)", "Chanachur"],                   calories: 180, protein_g: 5,  carbs_g: 28, fat_g: 6,  prep_minutes: 2  },
  Dinner:    { meal: "Dinner",    name: "Roti with Egg Curry",       ingredients: ["Roti / Chapati", "Egg curry"],                       calories: 400, protein_g: 24, carbs_g: 45, fat_g: 12, prep_minutes: 20 },
};

const MEAL_SYSTEM = `You are a nutritionist. Output ONLY a single raw JSON object. No markdown, no extra text.
Schema: {"id":string,"meal":string,"name":string,"ingredients":["string","string"],"calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"prep_minutes":number}
Keep ingredients list short (2-3 items max).`;

// ─── Compute targets mathematically ──────────────────────────────────────────

function computeTargets(
  heightCm: number,
  weightKg: number,
  age: number,
  bodyFatPct: number | null,
  sessions: number,
): { target_bmi: number; target_body_fat_pct: number | null; daily_calories_kcal: number; notes: string } {
  const h = heightCm / 100;
  const currentBmi = h > 0 && weightKg > 0 ? weightKg / (h * h) : 0;
  const targetBmi  = currentBmi > 25 ? 22.5 : currentBmi < 18.5 ? 21 : 22;

  // Mifflin-St Jeor (gender-neutral approximation)
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * (age || 30) + 5;
  const activityFactor = sessions >= 5 ? 1.55 : sessions >= 3 ? 1.375 : 1.2;
  const tdee = bmr * activityFactor;

  // Deficit/surplus based on BMI gap
  const adjustment = currentBmi > 25 ? -400 : currentBmi < 18.5 ? +300 : 0;
  const dailyCalories = Math.round(tdee + adjustment);

  const notes =
    currentBmi > 25 ? "Moderate calorie deficit to reach healthy weight" :
    currentBmi < 18.5 ? "Calorie surplus to build healthy body mass" :
    "Balanced maintenance with performance focus";

  return {
    target_bmi:           targetBmi,
    target_body_fat_pct:  bodyFatPct !== null ? Math.round(bodyFatPct * 0.85) : null,
    daily_calories_kcal:  dailyCalories,
    notes,
  };
}

// ─── AI calls ────────────────────────────────────────────────────────────────

async function fetchMeal(
  mealType: string,
  mealId: string,
  foods: string,
  foodPref: string,
  conditions: string,
  caloriesTarget: number,
): Promise<MealCard> {
  try {
    const raw    = await chatComplete({
      model:    HEALTH_MODEL,
      messages: [
        { role: "system", content: MEAL_SYSTEM },
        { role: "user",   content: `${mealType} meal. Foods available: ${foods}. Preference: ${foodPref}. Conditions: ${conditions}. Target: ${caloriesTarget} kcal. Set id="${mealId}" and meal="${mealType}". Keep ingredients to 2-3 items.` },
      ],
      maxTokens: 300,
    });
    const parsed = safeJsonParse<MealCard>(raw);
    if (typeof parsed?.name !== "string" || typeof parsed?.calories !== "number") throw new Error("invalid");
    return { ...parsed, id: mealId, meal: mealType };
  } catch {
    return { id: mealId, ...FALLBACK_MEALS[mealType] };
  }
}

async function fetchInsight(
  currentBmi: string | null,
  targetBmi: number,
  dailyCalories: number,
  conditions: string,
  foodPref: string,
): Promise<string> {
  try {
    const raw = await chatComplete({
      model:    HEALTH_MODEL,
      messages: [
        { role: "system", content: "You are a nutritionist. Output ONLY plain text, no JSON, no markdown. Two sentences max." },
        { role: "user",   content: `Write 2 short sentences (max 40 words total) explaining: current BMI ${currentBmi ?? "unknown"} vs target BMI ${targetBmi}, why ${dailyCalories} kcal was chosen${conditions !== "none" ? `, and how ${conditions} affects the plan` : ""}. Food preference: ${foodPref}.` },
      ],
      maxTokens: 120,
    });
    return raw.trim().slice(0, 300);
  } catch {
    return `Target BMI of ${targetBmi} requires ${dailyCalories} kcal/day. Plan is tailored for ${foodPref} preference${conditions !== "none" ? ` with ${conditions} taken into account` : ""}.`;
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;

  const height     = String(body.height_cm         ?? "").trim();
  const weight     = String(body.weight_kg         ?? "").trim();
  const age        = String(body.age               ?? "").trim();
  const bodyFat    = String(body.body_fat_pct      ?? "").trim();
  const foodPref   = String(body.food_preference   ?? "Vegetarian").trim();
  const conditions = String(body.medical_conditions ?? "").trim() || "none";
  const sessions   = Number(body.sessions_per_week ?? 3);
  const foods      = Array.isArray(body.available_foods) && body.available_foods.length
    ? body.available_foods.slice(0, 30).join(", ")
    : "general Indian foods";

  const heightNum  = parseFloat(height) || 0;
  const weightNum  = parseFloat(weight) || 0;
  const ageNum     = parseFloat(age)    || 30;
  const bodyFatNum = parseFloat(bodyFat) || null;
  const currentBmi = heightNum > 0 && weightNum > 0
    ? (weightNum / ((heightNum / 100) ** 2)).toFixed(1)
    : null;

  // Compute targets mathematically — always succeeds
  const computed = computeTargets(heightNum, weightNum, ageNum, bodyFatNum, sessions);
  const mealCal  = computed.daily_calories_kcal;
  const mealDist = [Math.round(mealCal * 0.25), Math.round(mealCal * 0.35), Math.round(mealCal * 0.15), Math.round(mealCal * 0.25)];

  // Run all calls in parallel — meals have individual fallbacks, insight has text fallback
  const [breakfast, lunch, snack, dinner, insight] = await Promise.all([
    fetchMeal("Breakfast", "breakfast", foods, foodPref, conditions, mealDist[0]),
    fetchMeal("Lunch",     "lunch",     foods, foodPref, conditions, mealDist[1]),
    fetchMeal("Snack",     "snack",     foods, foodPref, conditions, mealDist[2]),
    fetchMeal("Dinner",    "dinner",    foods, foodPref, conditions, mealDist[3]),
    fetchInsight(currentBmi, computed.target_bmi, mealCal, conditions, foodPref),
  ]);

  const health_targets: HealthTargets = { ...computed, insight };

  return NextResponse.json({ meals: [breakfast, lunch, snack, dinner], health_targets });
}
