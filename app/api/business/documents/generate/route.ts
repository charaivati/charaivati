// app/api/business/documents/generate/route.ts
// POST { ideaId, type }  → AI-generated starting content for the document type
// Auth: same session-OR-guest ownership guard as the documents route
// AI: chatComplete() via app/api/aiClient.ts
// Context: BUSINESS_AI_PHILOSOPHY.txt loaded through lib/ai/contextLoader.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";
import { chatComplete } from "@/app/api/aiClient";
import { loadRawFile } from "@/lib/ai/contextLoader";

const GUEST_COOKIE = "biz-guest";
const MODEL = process.env.CHAT_AI_MODEL ?? "llama3:8b";

async function resolveOwnership(req: NextRequest, ideaId: string) {
  const token = getTokenFromRequest(req);
  const payload = token ? await verifySessionToken(token) : null;
  const sessionUserId = payload?.userId ?? null;
  const guestSessionId = req.cookies.get(GUEST_COOKIE)?.value ?? null;

  const idea = await (db as any).businessIdea.findUnique({
    where: { id: ideaId },
    select: {
      id: true,
      userId: true,
      guestSessionId: true,
      title: true,
      description: true,
      responses: true,
    },
  });

  if (!idea) return { allowed: false, idea: null };

  const owned = idea.userId
    ? idea.userId === sessionUserId
    : !!guestSessionId && idea.guestSessionId === guestSessionId;

  return { allowed: owned, idea };
}

function buildSystemPrompt(): string {
  const philosophy = loadRawFile("BUSINESS_AI_PHILOSOPHY.txt");
  return [
    "You are a business planning assistant embedded in the Charaivati platform.",
    "Your outputs are starting drafts for the user to edit — never final verdicts.",
    "",
    philosophy ? "## Platform Philosophy" : "",
    philosophy,
  ]
    .filter((l) => l !== undefined)
    .join("\n")
    .trim();
}

function buildUserPrompt(
  type: string,
  idea: { title: string; description: string; responses: any }
): string {
  const ctx = `Business idea: "${idea.title}"\nDescription: "${idea.description}"`;

  if (type === "SWOT") {
    return `${ctx}

Generate a starting SWOT analysis as JSON with this exact shape:
{"strengths":"...","weaknesses":"...","opportunities":"...","threats":"..."}

Keep each field to 2-3 bullet-point lines. Be honest, concise, and grounded in the actual idea. Strengths/Weaknesses are internal; Opportunities/Threats are external.
Respond with valid JSON only — no markdown fences.`;
  }

  if (type === "BMC") {
    return `${ctx}

Generate a starting Business Model Canvas as JSON with this exact shape:
{"keyPartners":"...","keyActivities":"...","keyResources":"...","valuePropositions":"...","customerRelationships":"...","channels":"...","customerSegments":"...","costStructure":"...","revenueStreams":"..."}

Keep each field to 2-3 short lines. Be grounded and specific to the idea.
Respond with valid JSON only — no markdown fences.`;
  }

  if (type === "FINANCIALS") {
    return `${ctx}

Generate a starting 3-year financial plan as JSON with this exact shape:
{"year1":{"revenue":"","cogs":"","operatingCosts":"","marketingCosts":"","otherCosts":""},"year2":{"revenue":"","cogs":"","operatingCosts":"","marketingCosts":"","otherCosts":""},"year3":{"revenue":"","cogs":"","operatingCosts":"","marketingCosts":"","otherCosts":""}}

Fill each field with a realistic INR number as a string (e.g. "500000"). Use modest, defensible estimates suited to a small Indian business starting from scratch. Year 2 and 3 should show plausible growth.
Respond with valid JSON only — no markdown fences.`;
  }

  return `${ctx}\n\nGenerate a brief draft for a ${type} document. Respond with plain text.`;
}

function parseAIResponse(type: string, raw: string): Record<string, any> {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  try {
    return JSON.parse(stripped);
  } catch {
    // Fallback: return as a single-field object so the page can handle it
    return { raw: stripped };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ideaId, type } = body;

    if (!ideaId || !type) {
      return NextResponse.json(
        { error: "ideaId and type are required" },
        { status: 400 }
      );
    }

    const { allowed, idea } = await resolveOwnership(req, ideaId);
    if (!allowed || !idea) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(type, idea);

    const raw = await chatComplete({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      maxTokens: 800,
      temperature: 0.5,
    });

    const content = parseAIResponse(type, raw);

    return NextResponse.json({ content, type });
  } catch (error) {
    console.error("POST /api/business/documents/generate", error);
    return NextResponse.json(
      { error: "Failed to generate document" },
      { status: 500 }
    );
  }
}
