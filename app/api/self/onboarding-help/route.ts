// app/api/self/onboarding-help/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUserFromReq } from "@/lib/auth";
import { callAI, safeJsonParse } from "@/app/api/aiClient";

type RequestBody = {
  category: "learn" | "build" | "execute" | "connect";
  mode: "focused" | "zoomed";
  answers: Record<string, string>;
};

type AIResponse = {
  suggestions: string[];
};

function sanitize(s: string): string {
  return s.replace(/<[^>]*>/g, "").slice(0, 500).trim();
}

export async function POST(req: NextRequest) {
  const user = await getUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as RequestBody | null;
  if (!body?.category || !body?.mode) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { category, mode, answers } = body;

  // Sanitize all answer values
  const cleanAnswers: Record<string, string> = {};
  for (const [k, v] of Object.entries(answers ?? {})) {
    if (typeof v === "string") cleanAnswers[k] = sanitize(v);
  }

  const answersText = Object.entries(cleanAnswers)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const systemPrompt =
    `You are a direct, no-nonsense goal clarity assistant.\n` +
    `The user is answering onboarding questions on a self-development platform.\n` +
    `Based on their answers so far, give 2-3 concrete, specific suggestions\n` +
    `to help them think more clearly about their current question.\n` +
    `Rules: Be specific, not motivational. No fluff. No 'Great!' openers.\n` +
    `Match the mode: focused = short-term practical, zoomed = structural long-term.\n` +
    `If answers are too vague to help, ask ONE sharp clarifying question instead.\n` +
    `Keep total response under 100 words.\n` +
    `Respond ONLY in JSON: { "suggestions": ["...", "..."] }`;

  const prompt = `Category: ${category}\nMode: ${mode}\nAnswers so far:\n${answersText || "(none yet)"}`;

  try {
    const raw    = await callAI({ prompt, systemPrompt, maxTokens: 300 });
    const parsed = safeJsonParse<AIResponse>(raw);

    if (!Array.isArray(parsed?.suggestions) || parsed.suggestions.length === 0) {
      return NextResponse.json({ error: "parse" }, { status: 200 });
    }

    return NextResponse.json({ suggestions: parsed.suggestions.slice(0, 3) });
  } catch {
    return NextResponse.json({ error: "ai_failed" }, { status: 200 });
  }
}
