// app/api/ai/suggest-actions/route.ts
import { NextResponse } from "next/server";
import { callAI, safeJsonParse } from "@/app/api/aiClient";
import type { GoalEntry, Suggestion, SuggestionType, Priority } from "@/app/api/ai/types.ts";

type Body = {
  currentPhase?: string;
  recentActivity?: string[];
  goals?: GoalEntry[];
  skills?: string[];
};

// ─── Fallback ─────────────────────────────────────────────────────────────────

function buildFallback(body: Body): Suggestion[] {
  const goals  = body.goals ?? [];
  const skills = [
    ...(body.skills ?? []),
    ...goals.map((g) => g.skill).filter(Boolean),
  ] as string[];

  const make = (text: string, type: SuggestionType, priority: Priority): Suggestion => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    text, type, priority,
  });

  return [
    skills[0]    ? make(`Practice ${skills[0]} for 25 minutes with one measurable output`, "skill", "high")
                 : make("Identify the one skill that will move your goal forward most", "skill", "high"),
    goals[0]?.title ? make(`Break "${goals[0].title}" into a single 45-minute sprint today`, "execution", "high")
                    : make("Pick your single most important task and protect 45 minutes for it", "execution", "high"),
    make("Do a 10-minute walk and rehydrate before your next deep session", "health", "medium"),
    make("Send one concise progress update to a peer or mentor", "network", "medium"),
    body.currentPhase === "foundation"
      ? make("Write down your success criteria for this week as a checklist", "execution", "high")
      : body.currentPhase === "growth"
        ? make("Publish one artifact that shows your progress publicly", "network", "high")
        : make("Document your current workflow so it can run without you", "execution", "medium"),
  ].slice(0, 5);
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body          = (await req.json().catch(() => ({}))) as Body;
  const goals         = Array.isArray(body.goals)         ? body.goals         : [];
  const recentActivity = Array.isArray(body.recentActivity) ? body.recentActivity : [];
  const explicitSkills = Array.isArray(body.skills)
    ? body.skills.filter((s): s is string => Boolean(s?.trim()))
    : [];

  const allSkills = [...new Set([
    ...explicitSkills,
    ...goals.map((g) => g.skill?.trim()).filter(Boolean) as string[],
  ])];

  const goalSummaries = goals
    .filter((g) => g.title)
    .map((g, i) => `Goal ${i + 1}: "${g.title}"${g.skill ? ` (skill: ${g.skill})` : ""}`)
    .join("\n");

  const systemPrompt = `You are a sharp, direct productivity coach. You give specific, non-generic action suggestions.
Always respond with ONLY valid JSON — no explanation, no markdown, no preamble.`;

  const prompt = `Suggest 5 specific next actions for this person right now.

Current phase: ${body.currentPhase ?? "foundation"}
Their goals:
${goalSummaries || "Not specified"}
Skills they're building: ${allSkills.length ? allSkills.join(", ") : "not specified"}
What they've done recently: ${recentActivity.length ? recentActivity.join(", ") : "nothing logged yet"}

Return this exact JSON structure:
{
  "suggestions": [
    {
      "id": "unique-short-id",
      "text": "The action suggestion",
      "type": "skill|health|network|execution",
      "priority": "high|medium|low"
    }
  ]
}

Rules:
- Exactly 5 suggestions
- Do NOT suggest things they've done recently: ${recentActivity.length ? recentActivity.join(", ") : "n/a"}
- Be specific — reference actual goal titles and skill names, not placeholders
- Mix types: include at least one of each: skill, health, network, execution
- Foundation phase = clarity and consistency. Growth = shipping and visibility. Mastery = systems and delegation
- Priority "high" = do today. "medium" = this week. "low" = when you can
- Each suggestion text: one sentence, max 15 words, starts with an action verb`;

  try {
    const raw    = await callAI({ prompt, systemPrompt });
    const parsed = safeJsonParse<{ suggestions: Suggestion[] }>(raw);

    const suggestions = parsed?.suggestions;
    const validTypes  = new Set<string>(["skill", "health", "network", "execution"]);
    const validPrios  = new Set<string>(["low", "medium", "high"]);

    const isValid =
      Array.isArray(suggestions) &&
      suggestions.length > 0 &&
      suggestions.every(
        (s) =>
          typeof s.text === "string" &&
          validTypes.has(s.type) &&
          validPrios.has(s.priority)
      );

    if (!isValid) throw new Error("AI returned invalid suggestions");

    // Ensure every suggestion has a stable id (model sometimes omits or duplicates)
    const withIds: Suggestion[] = suggestions.slice(0, 6).map((s) => ({
      ...s,
      id: s.id && typeof s.id === "string" ? s.id : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    }));

    return NextResponse.json({ suggestions: withIds });
  } catch (err) {
    console.error("[suggest-actions] AI failed, using fallback:", err);
    return NextResponse.json({ suggestions: buildFallback(body), _fallback: true });
  }
}