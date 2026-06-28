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
import type { DriveType, GoalEntry, SkillEntry } from "@/types/self";
import type { DriveSignal } from "@/lib/companion/signalParser";

// Health fields the chat may write (allowlist — also enforced in the API route).
export const HEALTH_FIELDS = ["sleepQuality", "stressLevel", "sessionsPerWeek", "exercise", "food"] as const;

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
  | { id: string; type: "health"; summary: string; payload: { fields: Record<string, string | number>; label: string } }
  | { id: string; type: "goal-skill"; summary: string; payload: { goalId: string; op: "add" | "remove"; name: string; status?: "have" | "learn" } };

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
        payload: { fields: { sleepQuality: "bad" }, label: "Sleep quality → Bad" },
      };
    }
  }
  if (flags.includes("stress") && health.stressLevel !== "High") {
    const id = "health:stressLevel";
    if (!dismissedSet.has(id)) {
      return {
        id, type: "health",
        summary: `It sounds like things have been stressful — set your stress level to "High" in Health?`,
        payload: { fields: { stressLevel: "High" }, label: "Stress level → High" },
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

// ─── Focus extractors (conversational in-chat guide) ────────────────────────────
// Each runs one chatComplete jsonMode call and returns a ProfileProposal (confirm
// card) or null. The chat route runs exactly ONE per turn, picked by the user's
// current focus (lib/companion/gapDetector nextFocus). Ungated — works for all
// floating-chat users, new or returning.

const VALID_DRIVES: DriveType[] = ["learning", "helping", "building", "doing"];

export async function extractDrive(conversationText: string, existing: DriveType[]): Promise<ProfileProposal | null> {
  try {
    const raw = await chatComplete({
      model: SKILLS_MODEL,
      messages: [
        { role: "system", content: "Respond ONLY with valid JSON, no markdown." },
        { role: "user", content: `Conversation:\n${conversationText}\n\nThe four drives are learning, helping, building, doing. Has the user clearly expressed or agreed which ONE is their core driving force? Return ONLY:\n{"found": boolean, "drive": "learning|helping|building|doing"}` },
      ],
      maxTokens: 60, jsonMode: true,
    });
    const parsed = safeJsonParse<{ found: boolean; drive: string }>(raw);
    const drive = parsed?.drive as DriveType;
    if (!parsed?.found || !VALID_DRIVES.includes(drive) || existing.includes(drive)) return null;
    return { id: `drive:${drive}`, type: "drive", summary: `Set "${DRIVE_LABELS[drive]}" as your drive?`, payload: { driveType: drive } };
  } catch (err) { console.error("[profileSync] extractDrive failed:", err); return null; }
}

export async function extractGoal(
  conversationText: string, driveType: DriveType, goals: GoalEntry[], allowAdditional = false,
): Promise<ProfileProposal | null> {
  if (!driveType) return null;
  if (!allowAdditional && goals.some((g) => g.driveId === driveType && g.statement?.trim())) return null;
  try {
    const raw = await chatComplete({
      model: SKILLS_MODEL,
      messages: [
        { role: "system", content: "Respond ONLY with valid JSON, no markdown." },
        { role: "user", content: `Conversation:\n${conversationText}\n\nHas the user described a clear, specific short-term goal they want to pursue (related to "${DRIVE_LABELS[driveType]}")? Only say yes if it is concrete and they clearly want it. Return ONLY:\n{"hasGoal": boolean, "statement": "short goal statement, max 12 words", "description": "one sentence of detail"}` },
      ],
      maxTokens: 150, jsonMode: true,
    });
    const parsed = safeJsonParse<{ hasGoal: boolean; statement: string; description: string }>(raw);
    if (!parsed?.hasGoal || !parsed.statement?.trim()) return null;
    const stmt = parsed.statement.trim();
    if (goals.some((g) => g.statement?.trim().toLowerCase() === stmt.toLowerCase())) return null;
    return {
      id: `goal:${driveType}:${Date.now()}`, type: "goal",
      summary: `Add "${stmt}" as a goal under your ${DRIVE_LABELS[driveType]} drive?`,
      payload: { driveType, statement: stmt.slice(0, 200), description: (parsed.description ?? "").trim().slice(0, 500) },
    };
  } catch (err) { console.error("[profileSync] extractGoal failed:", err); return null; }
}

export async function extractHealth(conversationText: string): Promise<ProfileProposal | null> {
  try {
    const raw = await chatComplete({
      model: SKILLS_MODEL,
      messages: [
        { role: "system", content: "Respond ONLY with valid JSON, no markdown." },
        { role: "user", content: `Conversation:\n${conversationText}\n\nDid the user just state any of these about themselves? sleepQuality (bad|moderate|good), stressLevel (Low|Mid|High), sessionsPerWeek (a number 0-14 for exercise), food (short diet description). Return ONLY the ones they actually stated:\n{"found": boolean, "fields": {"sleepQuality":"...","stressLevel":"...","sessionsPerWeek":0,"food":"..."}}` },
      ],
      maxTokens: 120, jsonMode: true,
    });
    const parsed = safeJsonParse<{ found: boolean; fields: Record<string, string | number> }>(raw);
    if (!parsed?.found || !parsed.fields || typeof parsed.fields !== "object") return null;
    const fields: Record<string, string | number> = {};
    for (const k of HEALTH_FIELDS) {
      const v = parsed.fields[k];
      if (v !== undefined && v !== null && v !== "") fields[k] = k === "sessionsPerWeek" ? Number(v) : String(v);
    }
    if (Object.keys(fields).length === 0) return null;
    const label = Object.entries(fields).map(([k, v]) => `${k} → ${v}`).join(", ");
    return { id: `health:${Date.now()}`, type: "health", summary: `Save: ${label}?`, payload: { fields, label } };
  } catch (err) { console.error("[profileSync] extractHealth failed:", err); return null; }
}

export async function extractGoalSkill(
  conversationText: string, goal: { id: string; statement: string; skills: SkillEntry[] },
): Promise<ProfileProposal | null> {
  const existing = (goal.skills ?? []).map((s) => s.name).filter(Boolean).join(", ") || "none";
  try {
    const raw = await chatComplete({
      model: SKILLS_MODEL,
      messages: [
        { role: "system", content: "Respond ONLY with valid JSON, no markdown." },
        { role: "user", content: `Goal: "${goal.statement}". Current skills: ${existing}.\nConversation:\n${conversationText}\n\nDid the user just agree to ADD or REMOVE one specific skill for this goal? For an add, do they already HAVE it or want to LEARN it? Return ONLY:\n{"action":"add|remove|none","name":"skill name","status":"have|learn"}` },
      ],
      maxTokens: 60, jsonMode: true,
    });
    const parsed = safeJsonParse<{ action: string; name: string; status?: string }>(raw);
    const name = parsed?.name?.trim();
    if (!name || (parsed.action !== "add" && parsed.action !== "remove")) return null;
    const op = parsed.action as "add" | "remove";
    const status = parsed.status === "have" ? "have" : parsed.status === "learn" ? "learn" : undefined;
    return {
      id: `goal-skill:${goal.id}:${op}:${name.toLowerCase()}`,
      type: "goal-skill",
      summary: op === "add"
        ? `Add skill "${name}"${status ? ` (${status})` : ""} to "${goal.statement}"?`
        : `Remove "${name}" from "${goal.statement}"?`,
      payload: { goalId: goal.id, op, name, ...(op === "add" && status ? { status } : {}) },
    };
  } catch (err) { console.error("[profileSync] extractGoalSkill failed:", err); return null; }
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
    data.health = { ...health, ...proposal.payload.fields };
  } else if (proposal.type === "goal-skill") {
    const { goalId, op, name, status } = proposal.payload;
    const target = name.trim().toLowerCase();
    data.goals = goals.map((g) => {
      if (g.id !== goalId) return g;
      const skills: SkillEntry[] = Array.isArray(g.skills) ? g.skills : [];
      if (op === "remove") {
        return { ...g, skills: skills.filter((s) => s.name.trim().toLowerCase() !== target) };
      }
      const existing = skills.find((s) => s.name.trim().toLowerCase() === target);
      if (existing) {
        return { ...g, skills: skills.map((s) => (s === existing ? { ...s, ...(status ? { status } : {}) } : s)) };
      }
      const newSkill: SkillEntry = {
        id: `s${randomUUID().replace(/-/g, "").slice(0, 8)}`,
        name: name.trim(), level: "Beginner", monetize: false, ...(status ? { status } : {}),
      };
      // drop the empty placeholder seeded at goal creation
      return { ...g, skills: [...skills.filter((s) => s.name.trim()), newSkill] };
    });
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
