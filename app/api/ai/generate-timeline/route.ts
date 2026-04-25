// app/api/ai/generate-timeline/route.ts
import { NextResponse } from "next/server";
import { chatComplete, safeJsonParse } from "@/app/api/aiClient";
import type { GoalEntry, Phase } from "@/app/api/ai/types.ts";

const TIMELINE_MODEL = process.env.TIMELINE_AI_MODEL ?? "openai/gpt-4o-mini";

type ExistingPhase = {
  id: string;
  name: string;
  actions: string[];
};

type EnergyContext = {
  overall: number;
  physical: number;
  mental: number;
  environment: number;
  time: number;
  funds: number;
};

type Body = {
  drives?: string[];
  goals?: GoalEntry[];
  existingPlan?: { phases: ExistingPhase[] };
  energy?: EnergyContext;
};

// ─── Input validation ─────────────────────────────────────────────────────────

function isNonsensical(text: string): boolean {
  const s = text.trim().toLowerCase();
  if (s.length < 2) return true;
  const alpha = (s.match(/[a-z]/g) ?? []).length;
  if (alpha / s.length < 0.4) return true;
  const words = s.split(/\s+/).filter(w => w.length > 2);
  if (words.length > 0 && !words.some(w => /[aeiou]/.test(w))) return true;
  return false;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body         = (await req.json().catch(() => ({}))) as Body;
  const drives       = Array.isArray(body.drives) ? body.drives.filter(Boolean).slice(0, 2) : [];
  const goals        = Array.isArray(body.goals)  ? body.goals  : [];
  const existingPlan = body.existingPlan ?? null;
  const energy       = body.energy ?? null;

  const goal  = goals[0];
  const title = goal?.title?.trim() ?? "";
  const desc  = goal?.description?.trim() ?? "";
  const skill = goal?.skill?.trim() ?? "";
  const drive = goal?.drive?.trim() ?? drives[0] ?? "";

  if (!title) return NextResponse.json({ phases: [], _fallback: true });

  if (isNonsensical(title)) {
    return NextResponse.json({
      phases: [], _invalid: true,
      message: "We couldn't understand your goal. Try rephrasing it as a clear sentence.",
    });
  }

  const existingContext = existingPlan?.phases?.length
    ? `\nExisting plan to improve upon:\n${existingPlan.phases.map(p =>
        `${p.name}: ${p.actions.slice(0, 2).join("; ")}`
      ).join("\n")}\nRefine and improve these — keep what works, fix what's weak.`
    : "";

  const energyContext = energy ? `
Energy context: ${energy.overall}/10 overall
Physical: ${energy.physical}/10, Mental: ${energy.mental}/10
Environment: ${energy.environment}/10, Time: ${energy.time}/10, Funds: ${energy.funds}/10
${energy.overall <= 4
  ? "IMPORTANT: LOW energy — Foundation phase must be lighter, max 2 actions, recovery-friendly."
  : energy.overall >= 8
  ? "HIGH energy — suggest more ambitious actions and tighter timelines."
  : ""}` : "";

  const userPrompt = `Create a 3-phase action plan for: "${title}"${desc ? `\nContext: ${desc}` : ""}${skill ? `\nSkills: ${skill}` : ""}${drive ? `\nMotivation: ${drive}` : ""}${energyContext}${existingContext}

Rules:
- 2-3 actions per phase, each max 12 words
- Name real tools, communities, techniques specific to this domain
- No generic advice ("research fundamentals", "set up environment", "stay consistent")
- No health/diet/exercise content

Return ONLY this JSON:
{"phases":[{"id":"foundation","name":"Foundation","duration":"2-4 weeks","actions":["action","action"]},{"id":"growth","name":"Growth","duration":"4-8 weeks","actions":["action","action"]},{"id":"mastery","name":"Mastery","duration":"8+ weeks","actions":["action","action"]}]}`;

  try {
    const raw    = await chatComplete({
      model:    TIMELINE_MODEL,
      messages: [
        { role: "system", content: "You are a domain expert. Give SPECIFIC, REAL-WORLD advice — not generic productivity tips. Respond with ONLY valid JSON, no markdown, no preamble." },
        { role: "user",   content: userPrompt },
      ],
      maxTokens: 800,
    });
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
