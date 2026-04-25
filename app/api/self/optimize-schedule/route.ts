import { NextRequest, NextResponse } from "next/server";
import { getUserFromReq } from "@/lib/auth";
import { chatComplete, safeJsonParse } from "@/app/api/aiClient";

const SCHEDULE_MODEL = process.env.SCHEDULE_AI_MODEL ?? "openai/gpt-4o-mini";

export async function POST(req: NextRequest) {
  const user = await getUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ _fallback: true }, { status: 200 });

  try {
    const raw    = await chatComplete({
      model:    SCHEDULE_MODEL,
      messages: [
        { role: "system", content: `You are a schedule optimization assistant. Given a person's goals and current weekly time slots, suggest 2-4 specific improvements. Rules: Be concrete and brief. No generic advice. Respond ONLY in JSON: { "suggestions": ["...", "..."] }` },
        { role: "user",   content: `Goals: ${JSON.stringify(body.goals ?? [])}\nCurrent slots: ${JSON.stringify(body.slots ?? [])}` },
      ],
      maxTokens: 300,
    });
    const parsed = safeJsonParse<{ suggestions: string[] }>(raw);
    if (!Array.isArray(parsed?.suggestions)) return NextResponse.json({ _fallback: true });
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ _fallback: true });
  }
}
