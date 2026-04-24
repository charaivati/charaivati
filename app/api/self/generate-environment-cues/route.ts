// app/api/self/generate-environment-cues/route.ts
import { NextRequest, NextResponse } from "next/server";
import { callAI, safeJsonParse } from "@/app/api/aiClient";

// ─── Types ────────────────────────────────────────────────────────────────────

type RawCue = { type: "space" | "people" | "ritual"; text: string; linkedContext: string };
type EnvironmentCue = RawCue & { id: string };

// ─── ID helper ────────────────────────────────────────────────────────────────

function genId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 9);
}

// ─── Hardcoded fallback pool ──────────────────────────────────────────────────

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

// ─── Prompts ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an environment design advisor. Respond ONLY with valid JSON. \
No prose, no markdown, no backticks.
Schema: { "cues": [ { "type": "space"|"people"|"ritual", "text": string, "linkedContext": string } ] }
Rules:
- Return 6 to 9 cues total, 2-3 per type.
- Cues are suggestions for improving environment and relationships, NOT daily tasks.
- Space cues: physical arrangement, visible objects, workspace setup.
- People cues: who to connect with, accountability structures, relationship quality.
- Ritual cues: habits anchored to specific places, times, or objects.
- Each cue must be concrete and immediately actionable.
- Tone: advisory. Use "Consider...", "Try keeping...", "It helps to..."
- linkedContext should name the goal or health issue that prompted the cue, under 6 words.`;

function buildUserMessage(body: {
  goals?: { statement?: string; description?: string; driveId?: string }[];
  healthFlags?: string[];
  workspace?: string;
  livingWith?: string;
}): string {
  const goalLines = (body.goals ?? [])
    .map(g => {
      const title = (g.statement || g.description || "").trim();
      return g.driveId ? `${title} (${g.driveId})` : title;
    })
    .filter(Boolean)
    .join(", ");

  return [
    `Goals: ${goalLines || "none"}`,
    `Health concerns: ${(body.healthFlags ?? []).join(", ") || "none"}`,
    `Workspace: ${body.workspace || "not specified"}`,
    `Living situation: ${body.livingWith || "not specified"}`,
    `Suggest environment and relationship improvements.`,
  ].join("\n");
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ cues: fallbackCues() });

  try {
    const raw = await callAI({
      prompt:       buildUserMessage(body),
      systemPrompt: SYSTEM_PROMPT,
      provider:     "openrouter",
      maxTokens:    700,
    });

    const parsed = safeJsonParse<{ cues: RawCue[] }>(raw);
    if (!parsed?.cues?.length) return NextResponse.json({ cues: fallbackCues() });

    const cues: EnvironmentCue[] = parsed.cues.slice(0, 9).map(c => ({
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
