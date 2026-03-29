// app/api/ai/regenerate-meal/route.ts
import { NextResponse } from "next/server";
import { callAI, safeJsonParse } from "@/app/api/aiClient";

type Body = {
  meal?: string;
  current_name?: string;
  available_foods?: string[];
  food_preference?: string;
  medical_conditions?: string;
  calories_target?: number;
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

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;

  const meal       = String(body.meal            ?? "Meal").trim();
  const foods      = Array.isArray(body.available_foods) && body.available_foods.length
    ? body.available_foods.slice(0, 30).join(", ")
    : "general Indian foods";
  const foodPref   = String(body.food_preference   ?? "Vegetarian").trim();
  const conditions = String(body.medical_conditions ?? "").trim() || "none";
  const calories   = Number(body.calories_target ?? 400);

  const systemPrompt = `You are a nutritionist. Respond ONLY with valid JSON for a single meal. Schema: { "id": string, "meal": string, "name": string, "ingredients": string[], "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "prep_minutes": number }`;

  const prompt = `Suggest a new ${meal} using these ingredients: ${foods}. Food preference: ${foodPref}. Medical conditions: ${conditions}. Target calories: ${calories}. Return one meal JSON only.`;

  try {
    const raw    = await callAI({ prompt, systemPrompt });
    const parsed = safeJsonParse<MealCard>(raw);

    const isValid =
      typeof parsed?.name === "string" &&
      typeof parsed?.calories === "number" &&
      Array.isArray(parsed?.ingredients);

    if (!isValid) throw new Error("AI returned invalid meal");

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[regenerate-meal] AI failed:", err);
    return NextResponse.json({ _fallback: true }, { status: 200 });
  }
}
