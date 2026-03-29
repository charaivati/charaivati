// app/api/ai/generate-timeline/route.ts
import { NextResponse } from "next/server";
import { callAI, safeJsonParse } from "@/app/api/aiClient";
import type { GoalEntry, Phase } from "@/app/api/ai/types.ts";

type ExistingPhase = {
  id: string;
  name: string;
  actions: string[];
};

type Body = {
  drives?: string[];
  goals?: GoalEntry[];
  existingPlan?: { phases: ExistingPhase[] };
};

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body        = (await req.json().catch(() => ({}))) as Body;
  const drives      = Array.isArray(body.drives) ? body.drives.filter(Boolean).slice(0, 2) : [];
  const goals       = Array.isArray(body.goals)  ? body.goals  : [];
  const existingPlan = body.existingPlan ?? null;

  const goal  = goals[0];
  const title = goal?.title?.trim() ?? "";
  const desc  = goal?.description?.trim() ?? "";
  const skill = goal?.skill?.trim() ?? "";
  const drive = goal?.drive?.trim() ?? drives[0] ?? "";

  if (!title) {
    return NextResponse.json({ phases: [], _fallback: true });
  }

  const systemPrompt = `You are a domain expert. Give SPECIFIC, REAL-WORLD advice — not generic productivity tips. Respond with ONLY valid JSON, no markdown, no preamble.`;

  // Build existing plan context for regeneration
  const existingContext = existingPlan?.phases?.length
    ? `\nExisting plan to improve upon:\n${existingPlan.phases.map(p =>
        `${p.name}: ${p.actions.slice(0, 2).join("; ")}`
      ).join("\n")}\nRefine and improve these — keep what works, fix what's weak.`
    : "";

  const prompt = `Create a 3-phase action plan for: "${title}"${desc ? `\nContext: ${desc}` : ""}${skill ? `\nSkills: ${skill}` : ""}${drive ? `\nMotivation: ${drive}` : ""}${existingContext}

Rules:
- 2-3 actions per phase, each max 12 words
- Name real tools, communities, techniques specific to this domain
- No generic advice ("research fundamentals", "set up environment", "stay consistent")
- No health/diet/exercise content

Return ONLY this JSON:
{"phases":[{"id":"foundation","name":"Foundation","duration":"2-4 weeks","actions":["action","action"]},{"id":"growth","name":"Growth","duration":"4-8 weeks","actions":["action","action"]},{"id":"mastery","name":"Mastery","duration":"8+ weeks","actions":["action","action"]}]}`;

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
    console.error("[generate-timeline] AI failed:", err);
    return NextResponse.json({ phases: [], _fallback: true });
  }
}
