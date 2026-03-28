// app/api/ai/generate-timeline/route.ts
import { NextResponse } from "next/server";
import { callAI, safeJsonParse } from "@/app/api/aiClient";
import type { GoalEntry, HealthProfile, Phase } from "@/app/api/ai/types.ts";

type Body = {
  drives?: string[];
  goals?: GoalEntry[];
  health?: HealthProfile;
};

// ─── Fallback (used if AI fails or returns bad JSON) ──────────────────────────

function buildFallback(drives: string[], goals: GoalEntry[], health: HealthProfile): Phase[] {
  const goalTitles = goals.map((g) => g.title?.trim()).filter(Boolean) as string[];
  const skills     = goals.map((g) => g.skill?.trim()).filter(Boolean) as string[];

  return [
    {
      id: "foundation",
      name: "Foundation",
      duration: "2–4 weeks",
      actions: [
        drives.length ? `Define baseline habits for your ${drives.join(" + ")} focus` : "Define your primary focus area",
        skills[0] ? `Practice ${skills[0]} for 30 focused minutes daily` : "Identify one core skill to start",
        health.note?.trim() ? `Build this health habit: ${health.note.trim()}` : "Establish one health-supporting routine",
      ],
    },
    {
      id: "growth",
      name: "Growth",
      duration: "4–8 weeks",
      actions: [
        goalTitles[0] ? `Ship first milestone for: ${goalTitles[0]}` : "Ship a visible mini-milestone",
        skills[1] ? `Deepen ${skills[1]} through one guided project` : "Strengthen execution through a weekly project",
        "Share a progress update with one accountability partner",
      ],
    },
    {
      id: "mastery",
      name: "Mastery",
      duration: "8+ weeks",
      actions: [
        goalTitles[1] ? `Scale the second milestone: ${goalTitles[1]}` : "Scale your strongest output channel",
        "Systemize your weekly review and iteration loop",
        "Mentor or collaborate to compound your outcomes",
      ],
    },
  ];
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body    = (await req.json().catch(() => ({}))) as Body;
  const drives  = Array.isArray(body.drives) ? body.drives.filter(Boolean).slice(0, 2) : [];
  const goals   = Array.isArray(body.goals)  ? body.goals  : [];
  const health  = body.health ?? {};

  const goalSummaries = goals
    .filter((g) => g.title)
    .map((g, i) =>
      `Goal ${i + 1}: "${g.title}"${g.skill ? ` (skill: ${g.skill})` : ""}${g.drive ? ` (drive: ${g.drive})` : ""}`
    )
    .join("\n");

  const systemPrompt = `You are a personal growth strategist. You generate structured, realistic action plans in JSON.
Always respond with ONLY valid JSON — no explanation, no markdown, no preamble.`;

  const prompt = `Create a 3-phase personal growth roadmap for this person.

Their drives: ${drives.length ? drives.join(", ") : "not specified"}
Their goals:
${goalSummaries || "Not specified"}
Health context: ${health.note || "not specified"}

Return this exact JSON structure:
{
  "phases": [
    {
      "id": "foundation",
      "name": "Foundation",
      "duration": "2–4 weeks",
      "actions": ["action 1", "action 2", "action 3"]
    },
    {
      "id": "growth",
      "name": "Growth",
      "duration": "4–8 weeks",
      "actions": ["action 1", "action 2", "action 3"]
    },
    {
      "id": "mastery",
      "name": "Mastery",
      "duration": "8+ weeks",
      "actions": ["action 1", "action 2", "action 3"]
    }
  ]
}

Rules:
- Each action must be specific to THIS person's goals and drives, not generic
- Actions must be concrete and doable (not vague like "work harder")
- Foundation = habits and clarity. Growth = shipping and feedback. Mastery = systems and leverage
- 3 actions per phase, each one sentence, max 15 words
- Reference the actual goal titles and skills where possible`;

  try {
    const raw    = await callAI({ prompt, systemPrompt });
    const parsed = safeJsonParse<{ phases: Phase[] }>(raw);

    // Validate structure — if AI skimped, fall back
    const phases = parsed?.phases;
    const isValid =
      Array.isArray(phases) &&
      phases.length === 3 &&
      phases.every(
        (p) =>
          typeof p.id === "string" &&
          Array.isArray(p.actions) &&
          p.actions.length > 0
      );

    if (!isValid) throw new Error("AI returned incomplete phases");

    return NextResponse.json({ phases });
  } catch (err) {
    console.error("[generate-timeline] AI failed, using fallback:", err);
    return NextResponse.json({ phases: buildFallback(drives, goals, health), _fallback: true });
  }
}