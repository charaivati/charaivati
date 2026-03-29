// app/api/ai/generate-health-plan/route.ts
import { NextResponse } from "next/server";
import { callAI, safeJsonParse } from "@/app/api/aiClient";

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

type HealthPlanResponse = {
  meals: MealCard[];
  health_targets: {
    target_bmi: number;
    target_body_fat_pct: number | null;
    daily_calories_kcal: number;
    notes: string;
    insight: string;
  };
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;

  const height    = String(body.height_cm    ?? "").trim();
  const weight    = String(body.weight_kg    ?? "").trim();
  const age       = String(body.age          ?? "").trim();
  const bodyFat   = String(body.body_fat_pct ?? "").trim();
  const waist     = String(body.waist_cm     ?? "").trim();
  const foodPref  = String(body.food_preference  ?? "Vegetarian").trim();
  const exercise  = String(body.exercise_type    ?? "Mixed").trim();
  const sessions  = Number(body.sessions_per_week ?? 3);
  const conditions = String(body.medical_conditions ?? "").trim() || "none";
  const foods      = Array.isArray(body.available_foods) && body.available_foods.length
    ? body.available_foods.slice(0, 30).join(", ")
    : "general Indian foods";

  // Pre-compute current BMI so the AI can reason about the gap
  const heightNum = parseFloat(height);
  const weightNum = parseFloat(weight);
  const currentBmi =
    heightNum > 0 && weightNum > 0
      ? (weightNum / ((heightNum / 100) ** 2)).toFixed(1)
      : null;

  const systemPrompt = `You are a clinical nutritionist. Respond ONLY with valid JSON. No prose, no markdown, no backticks.
Schema: {
  "meals": [ { "id": string, "meal": "Breakfast"|"Lunch"|"Snack"|"Dinner", "name": string, "ingredients": string[], "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "prep_minutes": number } ],
  "health_targets": {
    "target_bmi": number,
    "target_body_fat_pct": number|null,
    "daily_calories_kcal": number,
    "notes": string,
    "insight": string
  }
}
Rules:
- Exactly 4 meals (one of each type).
- Use only ingredients from the user's available_foods list where possible.
- Respect medical_conditions strictly — flag any dietary restriction that changes the plan.
- Adjust daily_calories_kcal to create a realistic deficit/surplus to reach a healthy BMI.
- notes: one short tagline (max 12 words) summarising the overall approach.
- insight: 2–3 sentences explaining the reasoning. Must reference: (1) current vs target BMI or body composition if known, (2) why the calorie target was chosen, (3) any adjustment made for medical conditions or food preference. Be specific — mention actual numbers.`;

  const prompt = `Height: ${height || "unknown"}cm, Weight: ${weight || "unknown"}kg, Age: ${age || "unknown"}
Current BMI: ${currentBmi ?? "unknown"}, Body fat: ${bodyFat || "unknown"}
Food preference: ${foodPref}
Available foods: ${foods}
Medical conditions: ${conditions}
Exercise: ${exercise}, ${sessions}x/week
Goal: Reach healthy BMI and sustainable energy levels.`;

  try {
    const raw    = await callAI({ prompt, systemPrompt, maxTokens: 2000 });
    console.log("[generate-health-plan] raw:", raw.slice(0, 500));
    const parsed = safeJsonParse<HealthPlanResponse>(raw);
    console.log("[generate-health-plan] meals count:", parsed?.meals?.length, "has targets:", !!parsed?.health_targets);

    const isValid =
      Array.isArray(parsed?.meals) &&
      parsed.meals.length === 4 &&
      parsed.meals.every(m => typeof m.name === "string" && typeof m.calories === "number") &&
      typeof parsed.health_targets?.target_bmi === "number";

    if (!isValid) throw new Error(`AI returned invalid health plan: meals=${parsed?.meals?.length}, bmi=${parsed?.health_targets?.target_bmi}`);

    return NextResponse.json({ meals: parsed.meals, health_targets: parsed.health_targets });
  } catch (err) {
    console.error("[generate-health-plan] AI failed:", err);
    return NextResponse.json({ _fallback: true }, { status: 200 });
  }
}
