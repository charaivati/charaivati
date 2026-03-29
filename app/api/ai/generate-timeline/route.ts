// app/api/ai/generate-timeline/route.ts
import { NextResponse } from "next/server";
import { callAI, safeJsonParse } from "@/app/api/aiClient";
import type { GoalEntry, Phase } from "@/app/api/ai/types.ts";

type Body = {
  drives?: string[];
  goals?: GoalEntry[];
};

// ─── Fallback (used if AI fails or returns bad JSON) ──────────────────────────

function buildFallback(goals: GoalEntry[]): Phase[] {
  const g     = goals[0];
  const title = g?.title?.trim() ?? "your goal";
  const skill = g?.skill?.trim();

  return [
    {
      id: "foundation",
      name: "Foundation",
      duration: "2–4 weeks",
      actions: [
        `Research the fundamentals and key requirements of: ${title}`,
        skill ? `Build daily practice around ${skill}` : "Identify the core skill you need first",
        `Set up your tools, resources, and environment for ${title}`,
      ],
    },
    {
      id: "growth",
      name: "Growth",
      duration: "4–8 weeks",
      actions: [
        `Complete your first concrete deliverable toward: ${title}`,
        skill ? `Apply ${skill} in a real project or scenario` : "Take on a hands-on project to test your progress",
        "Seek feedback and iterate — fix the biggest gap you find",
      ],
    },
    {
      id: "mastery",
      name: "Mastery",
      duration: "8+ weeks",
      actions: [
        `Reach measurable progress on: ${title}`,
        "Systematize your process so results become repeatable",
        "Teach, share, or apply the outcome to a bigger challenge",
      ],
    },
  ];
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body   = (await req.json().catch(() => ({}))) as Body;
  const drives = Array.isArray(body.drives) ? body.drives.filter(Boolean).slice(0, 2) : [];
  const goals  = Array.isArray(body.goals)  ? body.goals  : [];

  const goal  = goals[0];
  const title = goal?.title?.trim() ?? "";
  const desc  = goal?.description?.trim() ?? "";
  const skill = goal?.skill?.trim() ?? "";
  const drive = goal?.drive?.trim() ?? drives[0] ?? "";

  if (!title) {
    return NextResponse.json({ phases: buildFallback(goals) });
  }

  const systemPrompt = `You are a domain expert and hands-on practitioner. You give SPECIFIC, REAL-WORLD advice based on exactly what the goal is about — not generic productivity tips.
Always respond with ONLY valid JSON — no explanation, no markdown, no preamble.`;

  const prompt = `Create a 3-phase action plan for someone who wants to: "${title}"
${desc ? `\nMore context from the person: ${desc}` : ""}${skill ? `\nRelevant skills: ${skill}` : ""}${drive ? `\nMotivation: ${drive}` : ""}

CRITICAL — actions must be SPECIFIC to this exact goal:
- Name real activities, places, tools, communities, or techniques in this domain
- Example for "Feed birds": study local bird species → set up feeders → join birding groups — NOT "research fundamentals"
- Example for "Learn guitar": buy a beginner guitar → learn 3 chords → play a full song — NOT "set up your environment"
- Think: what would a practitioner in this field actually DO in week 1? month 2? month 6?
- Do NOT use generic advice: no "research fundamentals", no "set up your environment", no "stay consistent"
- Do NOT mention health, diet, exercise, sleep

Return ONLY this JSON (no other text):
{
  "phases": [
    {
      "id": "foundation",
      "name": "Foundation",
      "duration": "2–4 weeks",
      "actions": ["specific real-world action", "specific real-world action", "specific real-world action"]
    },
    {
      "id": "growth",
      "name": "Growth",
      "duration": "4–8 weeks",
      "actions": ["specific real-world action", "specific real-world action", "specific real-world action"]
    },
    {
      "id": "mastery",
      "name": "Mastery",
      "duration": "8+ weeks",
      "actions": ["specific real-world action", "specific real-world action", "specific real-world action"]
    }
  ]
}

Each action: 1 sentence, max 15 words, plain text only.`;

  try {
    const raw    = await callAI({ prompt, systemPrompt });
    const parsed = safeJsonParse<{ phases: Phase[] }>(raw);

    const phases  = parsed?.phases;
    const isValid =
      Array.isArray(phases) &&
      phases.length === 3 &&
      phases.every(p => typeof p.id === "string" && Array.isArray(p.actions) && p.actions.length > 0);

    if (!isValid) throw new Error("AI returned incomplete phases");

    return NextResponse.json({ phases });
  } catch (err) {
    console.error("[generate-timeline] AI failed, using fallback:", err);
    return NextResponse.json({ phases: buildFallback(goals), _fallback: true });
  }
}
