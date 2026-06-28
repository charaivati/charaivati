// lib/companion/gapDetector.ts — deterministic "what essential is this user missing?"
// detector for the floating chat's active-guide cards. Pure (no AI, no DB).
//
// First slice: drive + goal. Extend by adding rules that return a `nav` GuideAction
// pointing at a capabilityRegistry route (lib/site/capabilityRegistry.ts) — the
// GuideActionCard already renders nav links, so new gaps need no new UI.

import type { DriveType, GoalEntry } from "@/types/self";
import { DRIVE_LABELS } from "@/lib/companion/profileSync";

export type GuideAction =
  | {
      id: "gap:drive";
      kind: "pick-drive";
      message: string;
      options: { value: DriveType; label: string }[];
      route: { label: string; href: string };
    }
  | {
      id: "gap:goal";
      kind: "draft-goal";
      message: string;
      driveType: DriveType;
    }
  | {
      id: string;
      kind: "nav";
      message: string;
      route: { label: string; href: string };
    };

const DRIVE_OPTIONS = (Object.keys(DRIVE_LABELS) as DriveType[]).map((value) => ({
  value,
  label: DRIVE_LABELS[value],
}));

// ── "is this angle filled in?" helpers — each is the same emptiness test the
// Self-page blocks treat as "not set yet". Kept loose (unknown + guards) since the
// values come straight off the Profile JSON columns.
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

export interface GapProfile {
  drives?: unknown;
  goals?: unknown;
  health?: unknown;
  fundsProfile?: unknown;
  weekSchedule?: unknown;
}

// Returns at most one gap, highest priority first. `dismissed` are the
// GuideAction ids the user has waved off (client localStorage, reused key).
// Order = the order we want the user to fill things: drive → goal → goal-skills
// → health (so energy is real) → funds → time. Each is dismissible and only
// shows once the higher-priority ones are satisfied.
export function detectGap(profile: GapProfile | null, dismissed: string[] = []): GuideAction | null {
  const dismissedSet = new Set(dismissed);
  const drives: DriveType[] = Array.isArray(profile?.drives) ? (profile!.drives as DriveType[]) : [];
  const goals: GoalEntry[] = Array.isArray(profile?.goals) ? (profile!.goals as unknown as GoalEntry[]) : [];

  // 1. No driving force — the root everything else grows from.
  if (drives.length === 0 && !dismissedSet.has("gap:drive")) {
    return {
      id: "gap:drive",
      kind: "pick-drive",
      message:
        "You don't have a driving force set yet — it's the root everything else grows from. What pulls you most?",
      options: DRIVE_OPTIONS,
      route: { label: "Open the Drive block →", href: "/self" },
    };
  }
  if (drives.length === 0) return null; // nothing else makes sense without a drive

  // 2. Has a drive but no short-term mission under the primary one.
  const primary = drives[0];
  const hasGoal = goals.some((g) => g?.driveId === primary && g?.statement?.trim());
  if (!hasGoal && !dismissedSet.has("gap:goal")) {
    return {
      id: "gap:goal",
      kind: "draft-goal",
      message: `You've set your ${DRIVE_LABELS[primary]} drive but no short-term mission yet. Tell me what you want to do — I'll shape it into a goal.`,
      driveType: primary,
    };
  }

  // 3. The goal has no skills mapped yet — does the user know what it needs?
  //    The chat just routes; the Have/Learn/Remove triage happens in the Skills
  //    block, which already has manual-add + an AI "Suggest" button per goal.
  const primaryGoal = goals.find((g) => g?.driveId === primary && g?.statement?.trim());
  const goalSkillsNamed = Array.isArray(primaryGoal?.skills)
    ? (primaryGoal!.skills as { name?: string }[]).filter((s) => s?.name?.trim())
    : [];
  if (primaryGoal && goalSkillsNamed.length === 0 && !dismissedSet.has("gap:goal-skills")) {
    return {
      id: "gap:goal-skills",
      kind: "nav",
      message: `"${primaryGoal.statement}" has no skills mapped yet. Do you know what it needs? Open the Skills block — add what you know, or tap Suggest — then mark each as Have or Learn.`,
      route: { label: "Open the Skills block →", href: "/self" },
    };
  }

  // 4. Health not set — energy can't be accurate without it (this is the input
  //    the Self-page Energy block scores from).
  if (!healthSet(profile?.health) && !dismissedSet.has("gap:health")) {
    return {
      id: "gap:health",
      kind: "nav",
      message:
        "Your energy score can't reflect reality yet — it's built from your sleep, stress, exercise and food. Set your health so the rest of the plan adapts to it.",
      route: { label: "Open the Health block →", href: "/self?tab=personal" },
    };
  }

  // 5. Funds not set — runway shapes what's realistic.
  if (!fundsSet(profile?.fundsProfile) && !dismissedSet.has("gap:funds")) {
    return {
      id: "gap:funds",
      kind: "nav",
      message: "Your money situation isn't set — income and runway decide how bold or lean your plan should be. Add it so the advice fits.",
      route: { label: "Open the Funds block →", href: "/self?tab=personal" },
    };
  }

  // 6. No weekly time blocked out — goals need real hours.
  if (!timeSet(profile?.weekSchedule) && !dismissedSet.has("gap:time")) {
    return {
      id: "gap:time",
      kind: "nav",
      message: "You haven't blocked out any time yet — goals only move when they have hours. Set your week so tasks have somewhere to live.",
      route: { label: "Open the Time block →", href: "/self?tab=time" },
    };
  }

  return null;
}
