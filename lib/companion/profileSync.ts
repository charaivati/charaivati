// lib/companion/profileSync.ts — turns companion-chat signals into Self-tab Profile updates
//
// Flow: /api/chat computes at most one ProfileProposal per turn (drive / health / goal).
// The client shows a Yes/No card; "Yes" calls POST /api/self/profile-proposal which
// performs the actual write via applyProfileProposal(). "No" is remembered client-side
// (localStorage) and sent back as `context.dismissedProposals` so we never re-propose
// the same thing in the same session.

import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { chatComplete, safeJsonParse } from "@/app/api/aiClient";
import type { DriveType, GoalEntry } from "@/types/self";
import type { DriveSignal } from "@/lib/companion/signalParser";

export const DRIVE_SIGNAL_TO_TYPE: Record<DriveSignal, DriveType> = {
  Seeker: "learning",
  Guardian: "helping",
  Builder: "building",
  Keeper: "doing",
};

export const DRIVE_LABELS: Record<DriveType, string> = {
  learning: "Learning",
  helping: "Helping",
  building: "Building",
  doing: "Doing",
};

const SKILLS_MODEL = process.env.SKILLS_AI_MODEL ?? "openai/gpt-4o-mini";

export type ProfileProposal =
  | { id: string; type: "drive"; summary: string; payload: { driveType: DriveType } }
  | { id: string; type: "goal"; summary: string; payload: { driveType: DriveType; statement: string; description: string } }
  | { id: string; type: "health"; summary: string; payload: { field: "sleepQuality" | "stressLevel"; value: string; label: string } };

interface BuildProposalInput {
  profile: { drives?: unknown; goals?: unknown; health?: unknown } | null;
  companionProfile: {
    primaryDrive?: string | null;
    driveConfirmedByUser?: boolean;
    healthFlags?: string[];
  } | null;
  dismissed: string[];
  isCompanionSession: boolean;
}

/** Cheap, deterministic checks — drive confirmation and health flags already live on UserCompanionProfile. */
export function buildProfileProposal({
  profile, companionProfile, dismissed, isCompanionSession,
}: BuildProposalInput): ProfileProposal | null {
  if (!isCompanionSession || !companionProfile) return null;

  const dismissedSet = new Set(dismissed ?? []);
  const drives: DriveType[] = Array.isArray(profile?.drives) ? (profile!.drives as DriveType[]) : [];
  const health = (profile?.health ?? {}) as { sleepQuality?: string; stressLevel?: string };

  // 1. Drive — companion has inferred + the user confirmed it
  if (companionProfile.driveConfirmedByUser && companionProfile.primaryDrive) {
    const mapped = DRIVE_SIGNAL_TO_TYPE[companionProfile.primaryDrive as DriveSignal];
    const id = `drive:${mapped}`;
    if (mapped && !drives.includes(mapped) && !dismissedSet.has(id)) {
      return {
        id, type: "drive",
        summary: `Add "${DRIVE_LABELS[mapped]}" as one of your drives in Self?`,
        payload: { driveType: mapped },
      };
    }
  }

  // 2. Health — sleep / stress flags surfaced during a check-in
  const flags = companionProfile.healthFlags ?? [];
  if ((flags.includes("poor_sleep") || flags.includes("fatigue")) && health.sleepQuality !== "bad") {
    const id = "health:sleepQuality";
    if (!dismissedSet.has(id)) {
      return {
        id, type: "health",
        summary: `You've mentioned poor sleep — set your sleep quality to "Bad" in Health so your energy score reflects it?`,
        payload: { field: "sleepQuality", value: "bad", label: "Sleep quality → Bad" },
      };
    }
  }
  if (flags.includes("stress") && health.stressLevel !== "High") {
    const id = "health:stressLevel";
    if (!dismissedSet.has(id)) {
      return {
        id, type: "health",
        summary: `It sounds like things have been stressful — set your stress level to "High" in Health?`,
        payload: { field: "stressLevel", value: "High", label: "Stress level → High" },
      };
    }
  }

  return null;
}

interface TryProposeGoalInput {
  profile: { goals?: unknown } | null;
  companionProfile: { primaryDrive?: string | null; driveConfirmedByUser?: boolean } | null;
  dismissed: string[];
  conversationText: string;
}

/**
 * One small extra AI call — only attempted when nothing else was proposed,
 * the drive is confirmed, and the user has no goal yet under that drive.
 */
export async function tryProposeGoal({
  profile, companionProfile, dismissed, conversationText,
}: TryProposeGoalInput): Promise<ProfileProposal | null> {
  if (!companionProfile?.driveConfirmedByUser || !companionProfile.primaryDrive) return null;
  const mapped = DRIVE_SIGNAL_TO_TYPE[companionProfile.primaryDrive as DriveSignal];
  if (!mapped) return null;

  const id = `goal:${mapped}`;
  if (dismissed.includes(id)) return null;

  const goals: GoalEntry[] = Array.isArray(profile?.goals) ? (profile!.goals as unknown as GoalEntry[]) : [];
  if (goals.some(g => g.driveId === mapped && g.statement?.trim())) return null;

  try {
    const raw = await chatComplete({
      model: SKILLS_MODEL,
      messages: [
        { role: "system", content: "Respond ONLY with valid JSON, no markdown, no explanation." },
        {
          role: "user",
          content: `Conversation so far:\n${conversationText}\n\nDoes the user describe a clear, specific goal they want to pursue (related to "${DRIVE_LABELS[mapped]}")? Return ONLY:\n{"hasGoal": boolean, "statement": "short goal statement, max 12 words", "description": "one sentence of detail"}`,
        },
      ],
      maxTokens: 150,
      jsonMode: true,
    });
    const parsed = safeJsonParse<{ hasGoal: boolean; statement: string; description: string }>(raw);
    if (!parsed?.hasGoal || !parsed.statement?.trim()) return null;

    return {
      id, type: "goal",
      summary: `Add "${parsed.statement.trim()}" as a goal under your ${DRIVE_LABELS[mapped]} drive?`,
      payload: {
        driveType: mapped,
        statement: parsed.statement.trim().slice(0, 200),
        description: (parsed.description ?? "").trim().slice(0, 500),
      },
    };
  } catch (err) {
    console.error("[profileSync] tryProposeGoal failed:", err);
    return null;
  }
}

/** Performs the actual Profile write for an accepted proposal. */
export async function applyProfileProposal(userId: string, proposal: ProfileProposal) {
  const profile = await db.profile.findUnique({ where: { userId } });
  const drives: DriveType[] = Array.isArray(profile?.drives) ? (profile!.drives as DriveType[]) : [];
  const goals: GoalEntry[] = Array.isArray(profile?.goals) ? (profile!.goals as unknown as GoalEntry[]) : [];
  const health = (profile?.health ?? {}) as Record<string, unknown>;

  const data: Record<string, unknown> = {};

  if (proposal.type === "drive") {
    const next = drives.includes(proposal.payload.driveType) ? drives : [...drives, proposal.payload.driveType];
    data.drives = next;
    data.drive = next[0] ?? null;
  } else if (proposal.type === "health") {
    data.health = { ...health, [proposal.payload.field]: proposal.payload.value };
  } else if (proposal.type === "goal") {
    // SKILL-TRIAGE-1: do NOT auto-suggest skills here. The chat asks the user
    // first (gap:goal-skills card → Skills block), where they add what they know
    // or tap Suggest, then mark each Have/Learn. Seed one empty placeholder so the
    // goal's skill box renders with Add/Suggest controls.
    const newGoal: GoalEntry = {
      id: `g${randomUUID().replace(/-/g, "").slice(0, 20)}`,
      driveId: proposal.payload.driveType,
      statement: proposal.payload.statement,
      description: proposal.payload.description,
      skills: [{ id: `s${randomUUID().replace(/-/g, "").slice(0, 8)}`, name: "", level: "Beginner", monetize: false }],
      linkedBusinessIds: [],
      saved: true,
    };
    const nextDrives = drives.includes(proposal.payload.driveType) ? drives : [...drives, proposal.payload.driveType];
    data.drives = nextDrives;
    data.drive = nextDrives[0] ?? null;
    data.goals = [...goals, newGoal];
  }

  const updated = await db.profile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  return {
    drives: updated.drives,
    goals: updated.goals,
    health: updated.health,
    generalSkills: updated.generalSkills,
  };
}
