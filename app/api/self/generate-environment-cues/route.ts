import { NextRequest, NextResponse } from "next/server";
import { getUserFromReq } from "@/lib/auth";
import { callAI, safeJsonParse } from "@/app/api/aiClient";

type RawCue = { type: "space" | "people" | "ritual"; text: string; linkedContext: string };
type EnvironmentCue = RawCue & { id: string };

function genId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 9);
}

function fallbackCues(): EnvironmentCue[] {
  return [
    { id: genId(), type: "space",   text: "Keep your current project materials visible on your desk.", linkedContext: "Focus" },
    { id: genId(), type: "space",   text: "Try a dedicated workspace with minimal distractions.", linkedContext: "Productivity" },
    { id: genId(), type: "people",  text: "Consider connecting with someone who shares your goals weekly.", linkedContext: "Accountability" },
    { id: genId(), type: "people",  text: "It helps to have someone you can share progress with regularly.", linkedContext: "Support" },
    { id: genId(), type: "ritual",  text: "Try a brief daily review of your top priorities each morning.", linkedContext: "Planning" },
    { id: genId(), type: "ritual",  text: "Consider a wind-down ritual to separate work and rest time.", linkedContext: "Balance" },
  ];
}

const SYSTEM_PROMPT = `You are an environment design advisor helping people optimize their physical spaces, relationships, and daily rituals to support their goals.
Produce actionable environment suggestions as JSON only — no markdown, no preamble.
Respond with exactly this shape: { "cues": [ { "type": "space"|"people"|"ritual", "text": "...", "linkedContext": "..." } ] }
Rules:
- Return 6–9 cues total, 2–3 per type (space, people, ritual)
- Space cues: physical arrangement, objects, visibility of materials
- People cues: who to connect with, accountability structures, relationship quality
- Ritual cues: anchors, habits tied to specific places or times
- Tone: advisory, not prescriptive — "Consider...", "Try keeping...", "It helps to..."
- Each cue must be concrete and immediately actionable
- Link each cue to a specific goal or life context via linkedContext`;

export async function POST(req: NextRequest) {
  const user = await getUserFromReq(req);
  if (!user) return NextResponse.json({ cues: fallbackCues() });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ cues: fallbackCues() });

  const goalTexts = (body.goals ?? [])
    .map((g: { statement?: string; description?: string }) => g.statement || g.description || "")
    .filter(Boolean)
    .join("; ");

  const prompt = `Goals: ${goalTexts || "none specified"}
Health flags: ${(body.healthFlags ?? []).join(", ") || "none"}
Workspace: ${body.workspace || "not specified"}
Living with: ${body.livingWith || "not specified"}`;

  try {
    const raw    = await callAI({ prompt, systemPrompt: SYSTEM_PROMPT, maxTokens: 700 });
    const parsed = safeJsonParse<{ cues: RawCue[] }>(raw);
    if (!parsed?.cues?.length) return NextResponse.json({ cues: fallbackCues() });

    const cues = parsed.cues.slice(0, 9).map(c => ({
      id:            genId(),
      type:          c.type,
      text:          c.text,
      linkedContext: c.linkedContext,
    }));
    return NextResponse.json({ cues });
  } catch {
    return NextResponse.json({ cues: fallbackCues() });
  }
}
