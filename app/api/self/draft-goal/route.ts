// app/api/self/draft-goal/route.ts — turns a user's plain-words intent into a clean
// short-term-mission draft (statement + description) for the floating chat's goal card.
// Preview only — the actual write goes through POST /api/self/profile-proposal.
import { NextRequest, NextResponse } from "next/server";
import getServerUser from "@/lib/serverAuth";
import { chatComplete, safeJsonParse } from "@/app/api/aiClient";
import { DRIVE_LABELS } from "@/lib/companion/profileSync";
import type { DriveType } from "@/types/self";

const DRAFT_MODEL = process.env.SKILLS_AI_MODEL ?? "openai/gpt-4o-mini";
const VALID_DRIVE_TYPES: DriveType[] = ["learning", "helping", "building", "doing"];

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const text = String(body?.text ?? "").trim();
  const driveType = body?.driveType as DriveType;
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
  if (!VALID_DRIVE_TYPES.includes(driveType)) {
    return NextResponse.json({ error: "invalid driveType" }, { status: 400 });
  }

  try {
    const raw = await chatComplete({
      model: DRAFT_MODEL,
      messages: [
        { role: "system", content: "Respond ONLY with valid JSON, no markdown, no explanation." },
        {
          role: "user",
          content: `The user (drive: "${DRIVE_LABELS[driveType]}") wants to pursue: "${text}".\nShape it into a clear, specific short-term mission. Return ONLY:\n{"statement":"short goal statement, max 12 words","description":"one sentence of detail"}`,
        },
      ],
      maxTokens: 150,
      jsonMode: true,
    });
    const parsed = safeJsonParse<{ statement: string; description: string }>(raw);
    if (!parsed?.statement?.trim()) {
      return NextResponse.json({ error: "Could not draft a goal — try rephrasing." }, { status: 502 });
    }
    return NextResponse.json({
      statement: parsed.statement.trim().slice(0, 200),
      description: (parsed.description ?? "").trim().slice(0, 500),
    });
  } catch (err) {
    console.error("[draft-goal] failed:", (err as Error).message);
    return NextResponse.json({ error: "Draft failed — try again." }, { status: 502 });
  }
}
