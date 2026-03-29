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
  const skill = goal?.skill?.trim() ?? "";
  const drive = goal?.drive?.trim() ?? drives[0] ?? "";

  if (!title) {
    return NextResponse.json({ phases: buildFallback(goals) });
  }

  const systemPrompt = `You are an expert coach and strategic planner. You deeply understand what a specific goal actually requires to achieve — the real steps, domain knowledge, and milestones involved.
Always respond with ONLY valid JSON — no explanation, no markdown, no preamble.`;

  const prompt = `You are creating a focused 3-phase action plan for this specific goal:

Goal: "${title}"${skill ? `\nSkills involved: ${skill}` : ""}${drive ? `\nDrive / motivation: ${drive}` : ""}

IMPORTANT RULES:
- Every action must be DIRECTLY about achieving this goal — about the subject matter, the domain, the craft
- Do NOT mention health, diet, exercise, sleep, or wellness — those are handled separately
- Think about what someone actually needs to DO to make progress on THIS specific goal
- Be concrete: name specific activities, tools, techniques relevant to this domain
- Avoid generic advice like "work harder", "stay motivated", "review progress"

Think step by step:
1. What does someone need to learn or set up first for "${title}"?
2. What does early traction look like for this goal?
3. What does mastery or significant achievement look like?

Return ONLY this JSON:
{
  "phases": [
    {
      "id": "foundation",
      "name": "Foundation",
      "duration": "2–4 weeks",
      "actions": ["specific action 1", "specific action 2", "specific action 3"]
    },
    {
      "id": "growth",
      "name": "Growth",
      "duration": "4–8 weeks",
      "actions": ["specific action 1", "specific action 2", "specific action 3"]
    },
    {
      "id": "mastery",
      "name": "Mastery",
      "duration": "8+ weeks",
      "actions": ["specific action 1", "specific action 2", "specific action 3"]
    }
  ]
}

Each action: one sentence, max 15 words, plain text only — no quotes, no special characters inside action text.`;

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
