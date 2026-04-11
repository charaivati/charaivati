import { NextRequest, NextResponse } from "next/server";
import { getUserFromReq } from "@/lib/auth";
import { callAI, safeJsonParse } from "@/app/api/aiClient";

export async function POST(req: NextRequest) {
  const user = await getUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ _fallback: true }, { status: 200 });

  const systemPrompt = `You are a financial planning assistant for individual goal-setters.
Given a person's goals and financial resources, produce a concise funding plan.
Rules: Be specific and actionable. No fluff. Keep under 200 words total.
Respond ONLY in JSON: { "savingsPlan": "...", "pitchGuidance": "...", "budgetAllocation": [{ "goalId": "...", "goalName": "...", "amount": 0, "rationale": "..." }] }`;

  const prompt = `Goals: ${JSON.stringify(body.goals ?? [])}
Fund sources: ${JSON.stringify(body.sources ?? [])}
Monthly burn: ₹${body.monthlyBurn ?? 0}`;

  try {
    const raw = await callAI({ prompt, systemPrompt, maxTokens: 400 });
    const parsed = safeJsonParse<{ savingsPlan: string; pitchGuidance: string; budgetAllocation: unknown[] }>(raw);
    if (!parsed?.savingsPlan) return NextResponse.json({ _fallback: true });
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ _fallback: true });
  }
}
