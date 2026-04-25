// app/api/ai/generate-week-plan/route.ts
import { NextResponse } from "next/server";
import { chatComplete, safeJsonParse } from "@/app/api/aiClient";
import type { Phase, DayPlan } from "@/app/api/ai/types.ts";

const WEEK_PLAN_MODEL = process.env.WEEK_PLAN_AI_MODEL ?? "openai/gpt-4o-mini";

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

type Body = {
  phases?: Phase[];
  currentPhase?: string;
  availableDays?: number;
};

function buildFallback(actions: string[], availableDays: number): DayPlan[] {
  return ALL_DAYS.slice(0, availableDays).map((day, i) => ({
    day,
    tasks: [
      actions[i % actions.length],
      actions[(i + 1) % actions.length],
    ],
  }));
}

export async function POST(req: Request) {
  const body          = (await req.json().catch(() => ({}))) as Body;
  const phases        = Array.isArray(body.phases) ? body.phases : [];
  const requestedDays = Number(body.availableDays);
  const availableDays = Number.isFinite(requestedDays)
    ? Math.max(1, Math.min(7, Math.floor(requestedDays)))
    : 5;

  const chosenPhase = phases.find((p) => p.id === body.currentPhase) ?? phases[0];
  const actions     = chosenPhase?.actions?.length ? chosenPhase.actions : ["Deep work session", "Skill rehearsal", "Recovery + review"];
  const days        = ALL_DAYS.slice(0, availableDays);

  const userPrompt = `Build a realistic weekly plan for someone in the ${chosenPhase?.name ?? "Foundation"} phase of their growth.

Phase actions they need to make progress on:
${actions.map((a, i) => `${i + 1}. ${a}`).join("\n")}

Available days this week: ${days.join(", ")} (${availableDays} days)

Return ONLY this JSON, no other text:
{"week":[{"day":"Mon","tasks":["task one here","task two here"]},{"day":"Tue","tasks":["task one here","task two here"]}]}

Rules:
- Exactly ${availableDays} entries in the week array, one per day in order: ${days.join(", ")}
- Exactly 2 tasks per day entry
- Tasks must be plain text only — NO quotation marks, NO apostrophes, NO special characters inside task text
- Keep each task under 10 words
- Tasks should be specific and actionable, referencing the phase actions above`;

  try {
    const raw    = await chatComplete({
      model:    WEEK_PLAN_MODEL,
      messages: [
        { role: "system", content: "You are a productivity coach who builds practical weekly schedules. Always respond with ONLY valid JSON — no explanation, no markdown, no preamble." },
        { role: "user",   content: userPrompt },
      ],
      maxTokens: 800,
    });
    const parsed = safeJsonParse<{ week: DayPlan[] }>(raw);

    const week = parsed?.week;
    const isValid =
      Array.isArray(week) &&
      week.length === availableDays &&
      week.every((d) => typeof d.day === "string" && Array.isArray(d.tasks) && d.tasks.length > 0);

    if (!isValid) throw new Error("AI returned invalid week structure");

    return NextResponse.json({ week });
  } catch (err) {
    console.error("[generate-week-plan] AI failed, using fallback:", err);
    return NextResponse.json({ week: buildFallback(actions, availableDays), _fallback: true });
  }
}
