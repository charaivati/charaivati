// app/api/self/profile-proposal/route.ts — apply an accepted ProfileProposal from the companion chat
import { NextRequest, NextResponse } from "next/server";
import getServerUser from "@/lib/serverAuth";
import { applyProfileProposal, ProfileProposal, HEALTH_FIELDS } from "@/lib/companion/profileSync";
import type { DriveType } from "@/types/self";

const VALID_DRIVE_TYPES: DriveType[] = ["learning", "helping", "building", "doing"];

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const proposal = body?.proposal as ProfileProposal | undefined;

  if (!proposal || typeof proposal !== "object" || !proposal.type || !proposal.payload) {
    return NextResponse.json({ error: "Invalid proposal" }, { status: 400 });
  }
  if (!["drive", "goal", "health", "goal-skill"].includes(proposal.type)) {
    return NextResponse.json({ error: "Invalid proposal type" }, { status: 400 });
  }

  if (proposal.type === "health") {
    const fields = (proposal.payload as any).fields;
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
      return NextResponse.json({ error: "Invalid health fields" }, { status: 400 });
    }
    const allowed = new Set<string>(HEALTH_FIELDS as readonly string[]);
    if (!Object.keys(fields).every((k) => allowed.has(k)) || Object.keys(fields).length === 0) {
      return NextResponse.json({ error: "Invalid health field" }, { status: 400 });
    }
  }

  if (proposal.type === "drive" || proposal.type === "goal") {
    if (!VALID_DRIVE_TYPES.includes(proposal.payload.driveType)) {
      return NextResponse.json({ error: "Invalid drive type" }, { status: 400 });
    }
  }

  if (proposal.type === "goal") {
    if (typeof proposal.payload.statement !== "string" || !proposal.payload.statement.trim()) {
      return NextResponse.json({ error: "Invalid goal statement" }, { status: 400 });
    }
  }

  if (proposal.type === "goal-skill") {
    const p = proposal.payload as any;
    if (typeof p.goalId !== "string" || !p.goalId || (p.op !== "add" && p.op !== "remove") ||
        typeof p.name !== "string" || !p.name.trim()) {
      return NextResponse.json({ error: "Invalid goal-skill payload" }, { status: 400 });
    }
  }

  try {
    const profile = await applyProfileProposal(user.id, proposal);
    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    console.error("[profile-proposal] apply failed:", err);
    return NextResponse.json({ error: "Failed to apply proposal" }, { status: 500 });
  }
}
