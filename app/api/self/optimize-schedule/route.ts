import { NextRequest, NextResponse } from "next/server";
import { getUserFromReq } from "@/lib/auth";
import { callAI, safeJsonParse } from "@/app/api/aiClient";

export async function POST(req: NextRequest) {
  const user = await getUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ _fallback: true }, { status: 200 });

  const systemPrompt = `You are a schedule optimization assistant.
Given a person's goals and current weekly time slots, suggest 2-4 specific improvements.
Rules: Be concrete and brief. No generic advice.
Respond ONLY in JSON: { "suggestions": ["...", "..."] }`;

  const prompt = `Goals: ${JSON.stringify(body.goals ?? [])}
Current slots: ${JSON.stringify(body.slots ?? [])}`;

  try {
    const raw = await callAI({ prompt, systemPrompt, maxTokens: 300 });
    const parsed = safeJsonParse<{ suggestions: string[] }>(raw);
    if (!Array.isArray(parsed?.suggestions)) return NextResponse.json({ _fallback: true });
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ _fallback: true });
  }
}
