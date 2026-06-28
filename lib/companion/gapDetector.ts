// lib/companion/gapDetector.ts — deterministic "what should the chat guide the
// user toward next?" focus detector for the conversational in-chat guide.
// Pure (no AI, no DB). The chat route injects the focus into the system prompt
// and runs the matching extractor; nothing routes to Self blocks anymore.

import type { DriveType, GoalEntry } from "@/types/self";

export type FocusKey = "drive" | "goal" | "goal-skills" | "health" | "funds" | "time";

export interface GapProfile {
  drives?: unknown;
  goals?: unknown;
  health?: unknown;
  fundsProfile?: unknown;
  weekSchedule?: unknown;
}

// ── "is this angle filled in?" helpers — same emptiness tests the Self-page
// blocks treat as "not set yet". Loose (unknown + guards) since values come
// straight off the Profile JSON columns.
function healthSet(health: unknown): boolean {
  if (!health || typeof health !== "object") return false;
  const h = health as Record<string, unknown>;
  return !!(h.sleepQuality || h.stressLevel || h.food || h.sessionsPerWeek);
}
function fundsSet(funds: unknown): boolean {
  if (!funds || typeof funds !== "object") return false;
  const f = funds as Record<string, any>;
  return (Array.isArray(f.sources) && f.sources.length > 0) || Number(f.monthlyBurn) > 0;
}
function timeSet(schedule: unknown): boolean {
  if (!schedule || typeof schedule !== "object") return false;
  const s = schedule as Record<string, any>;
  return (Array.isArray(s.tasks) && s.tasks.length > 0) || (Array.isArray(s.slots) && s.slots.length > 0);
}

// The next thing to guide the user toward, in priority order:
// drive → goal → the primary goal's skills → health → funds → time.
// `dismissed` lets the caller skip focuses the user has waved off.
export function nextFocus(profile: GapProfile | null, dismissed: string[] = []): FocusKey | null {
  const skip = new Set(dismissed);
  const drives: DriveType[] = Array.isArray(profile?.drives) ? (profile!.drives as DriveType[]) : [];
  const goals: GoalEntry[] = Array.isArray(profile?.goals) ? (profile!.goals as unknown as GoalEntry[]) : [];

  if (drives.length === 0) return skip.has("drive") ? null : "drive";

  const primary = drives[0];
  const hasGoal = goals.some((g) => g?.driveId === primary && g?.statement?.trim());
  if (!hasGoal) return skip.has("goal") ? null : "goal";

  const primaryGoal = goals.find((g) => g?.driveId === primary && g?.statement?.trim());
  const goalSkillsNamed = Array.isArray(primaryGoal?.skills)
    ? (primaryGoal!.skills as { name?: string }[]).filter((s) => s?.name?.trim())
    : [];
  if (goalSkillsNamed.length === 0 && !skip.has("goal-skills")) return "goal-skills";

  if (!healthSet(profile?.health) && !skip.has("health")) return "health";
  if (!fundsSet(profile?.fundsProfile) && !skip.has("funds")) return "funds";
  if (!timeSet(profile?.weekSchedule) && !skip.has("time")) return "time";

  return null;
}
