// lib/ai/userContext.ts — Unified user-context composer (UCTX-1b).
//
// Produces the "about this user" block for AI prompts at two privacy tiers:
//
//   tier "local"  → rich block for the trusted local Ollama provider. Subsumes
//                   BOTH user blocks /api/chat used to build inline (drives, goals,
//                   derived energy, active initiatives, currentSection) PLUS the
//                   previously dead-fetched Profile.health and generalSkills, PLUS
//                   the UserCompanionProfile companion fields when arcStage > 0
//                   (replacing buildCompanionContext usage in the chat route).
//                   READ-only on UCP — this module never writes companion fields.
//
//   tier "cloud"  → single minimal block for the token/privacy-sensitive cloud
//                   fallbacks (OpenRouter / Groq / Vercel). ONLY language, arc/
//                   consult stage, drive (name only), and currentSection / active
//                   topic. NO health, NO skills, NO insight notes, NO personality.
//
// Output is DYNAMIC content — callers place it in the dynamic zone of the system
// prompt (after the static + semi-static blocks).

import { db } from "@/lib/db";
import { computeEnergy } from "@/lib/self/energy";
import { SECTIONS } from "@/lib/site/capabilityRegistry";
import type { ExecutionPlan } from "@/lib/site/executionPlanTypes";
import type { HealthProfile, EnvironmentProfile, WeekSchedule, FundsProfile } from "@/types/self";
import { normalizePersonality, summarizePersonalityForComposer, type PersonalityData } from "@/lib/listener/personality";

const PERSONALITY_COMPOSER_THRESHOLD = 0.3;

export interface UserContextOptions {
  tier: "local" | "cloud";
  /** Current layer / focus the user is on (e.g. "Self"). Both tiers. */
  currentSection?: string;
  /** cloud only: arc (companion) or consult (listener) stage number. */
  stage?: number | null;
  /** cloud only: the user's drive, already resolved to a name/word. */
  driveName?: string | null;
  /** cloud only: language code (listener). */
  language?: string | null;
}

export async function buildUserContext(userId: string, opts: UserContextOptions): Promise<string> {
  if (opts.tier === "cloud") return buildCloudBlock(opts);
  return buildLocalBlock(userId, opts);
}

// ─── Cloud tier ──────────────────────────────────────────────────────────────
// cloud block contents reviewed periodically — keep minimal. Cloud providers see
// ONLY the fields below. Do NOT add health, skills, insight notes, or personality.
function buildCloudBlock(opts: UserContextOptions): string {
  const lines: string[] = [];
  if (opts.language) lines.push(`Language: ${opts.language}`);
  if (opts.stage != null) lines.push(`Stage: ${opts.stage}`);
  if (opts.driveName) lines.push(`Drive: ${opts.driveName}`);
  if (opts.currentSection) lines.push(`Current focus: ${opts.currentSection}`);
  if (lines.length === 0) return "";
  return `--- USER CONTEXT (minimal) ---\n${lines.join("\n")}\n--- END ---`;
}

// ─── Local tier ──────────────────────────────────────────────────────────────
async function buildLocalBlock(userId: string, opts: UserContextOptions): Promise<string> {
  const [profile, pages, ucp, personalityRow, planGoals] = await Promise.all([
    db.profile.findUnique({
      where: { userId },
      select: {
        drives: true, goals: true, health: true, generalSkills: true,
        environmentProfile: true, fundsProfile: true, weekSchedule: true,
      },
    }),
    db.page.findMany({
      where: { ownerId: userId, status: "active" },
      select: { title: true, pageType: true },
      take: 5,
    }),
    (db as any).userCompanionProfile.findUnique({
      where: { userId },
      select: {
        arcStage: true, energyState: true, primaryDrive: true, driveConfirmedByUser: true,
        dailyAvailableHours: true, peakWindow: true, hobbies: true, healthFlags: true,
      },
    }).catch(() => null),
    (db as any).personalityProfile.findUnique({ where: { userId } }).catch(() => null),
    // EXECPLAN-6: latest active goals — first one with an execution plan feeds the ACTIVE PLAN block
    db.aiGoal.findMany({
      where: { userId, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: { title: true, currentPhaseIndex: true, executionPlan: true },
    }).catch(() => [] as { title: string; currentPhaseIndex: number; executionPlan: unknown }[]),
  ]);

  // Cold-start mode: when user has no meaningful data, give explicit instruction (UCTX-2)
  const drives = Array.isArray(profile?.drives) ? (profile.drives as string[]) : [];
  const goalsArr = Array.isArray(profile?.goals) ? (profile.goals as any[]) : [];
  const hasNoData = drives.length === 0 && goalsArr.length === 0 && pages.length === 0 && (!ucp || ucp.arcStage === 0);

  if (hasNoData) {
    return `--- ABOUT THIS USER (COLD START) ---
You know nothing about this person yet.
Listen openly. Make no assumptions about their personality, goals, circumstances, or background.
Let them define themselves through the conversation.
Avoid suggesting changes to their profile or goals — ask first.
--- END ---`;
  }

  // Energy — the SAME computation the Self-page Energy block uses (lib/self/energy),
  // folding health + environment + time/schedule + funds. Was previously a separate
  // crude steps+sleep formula here that ignored the health block entirely.
  const energy = computeEnergy(
    (profile?.health ?? {}) as HealthProfile,
    (profile?.environmentProfile ?? undefined) as EnvironmentProfile | undefined,
    (profile?.weekSchedule ?? undefined) as WeekSchedule | undefined,
    (profile?.fundsProfile ?? undefined) as FundsProfile | undefined,
  );

  const drivesStr = drives.length > 0 ? drives.join(", ") : "not set";

  const goalsStr =
    goalsArr.length > 0
      ? goalsArr.slice(0, 3).map((g: any) => g.statement || g.title || "").filter(Boolean).join("; ")
      : "none set";

  const initiativesStr =
    pages.length > 0 ? pages.map((p) => `${p.title} (${p.pageType})`).join(", ") : "none";

  const currentSection = opts.currentSection ?? "Self";

  const lines: string[] = [
    `Drives: ${drivesStr}`,
    `Active goals: ${goalsStr}`,
    `Energy: ${energy.overall}/10 (physical ${energy.physical}, mental ${energy.mental}, joy ${energy.joy}, funds ${energy.funds})`,
    `Active initiatives: ${initiativesStr}`,
    `Current section: ${currentSection}`,
  ];

  // EXECPLAN-6: the execution plan is the center — tell the guide the user's
  // exact next action and which page it lives on, so it can point, not roam.
  // LOCAL TIER ONLY — never add plan detail to buildCloudBlock.
  const planLine = summarizePlan(planGoals as { title: string; currentPhaseIndex: number; executionPlan: unknown }[]);
  if (planLine) lines.push(planLine);

  const healthLine = summarizeHealth(profile?.health);
  if (healthLine) lines.push(`Health: ${healthLine}`);
  const skillsLine = summarizeSkills(profile?.generalSkills);
  if (skillsLine) lines.push(`Skills: ${skillsLine}`);

  // UCTX-3: local-tier-only personality tone-steering line. Below the
  // confidence threshold, omit entirely — never sent to cloud (buildCloudBlock).
  if (personalityRow) {
    const personality: PersonalityData = normalizePersonality(personalityRow);
    const personalityLine = summarizePersonalityForComposer(personality, PERSONALITY_COMPOSER_THRESHOLD);
    if (personalityLine) lines.push(personalityLine);
  }

  // UCP companion fields — only when the companion arc has begun (arcStage > 0).
  if (ucp && ucp.arcStage > 0) {
    lines.push(
      `Energy state: ${ucp.energyState ?? "unknown"}`,
      `Drive type: ${ucp.primaryDrive ?? "not yet discovered"}${ucp.driveConfirmedByUser ? " (confirmed)" : " (inferred)"}`,
      `Available time: ${ucp.dailyAvailableHours ? ucp.dailyAvailableHours + " hours/day" : "unknown"}, peak: ${ucp.peakWindow ?? "unknown"}`,
      `Active hobbies: ${getActiveHobbies(ucp.hobbies)}`,
      `Arc stage: ${ucp.arcStage}`,
      `Health flags: ${ucp.healthFlags?.length ? ucp.healthFlags.join(", ") : "none noted"}`,
    );
  }

  return `--- ABOUT THIS USER ---\n${lines.join("\n")}\n--- END ---`;
}

// ─── Compact summaries ───────────────────────────────────────────────────────

// EXECPLAN-6: one line about the most recent execution plan — phase, next
// action + its resolved route, done/total tasks, and a requirements digest.
function summarizePlan(goals: { title: string; currentPhaseIndex: number; executionPlan: unknown }[]): string {
  const goal = goals.find((g) => g.executionPlan && typeof g.executionPlan === "object");
  if (!goal) return "";
  const plan = goal.executionPlan as ExecutionPlan;
  if (!Array.isArray(plan.phases) || plan.phases.length === 0 || !plan.nextAction?.text) return "";
  const idx = Math.max(0, Math.min(goal.currentPhaseIndex ?? 0, plan.phases.length - 1));
  const phase = plan.phases[idx];
  const allTasks = plan.phases.flatMap((ph) => ph.tasks ?? []);
  const done = allTasks.filter((t) => t.done).length;
  const route = plan.nextAction.sectionKey ? SECTIONS[plan.nextAction.sectionKey]?.route : null;
  const parts = [
    `Active plan: "${goal.title}" — phase ${idx + 1}/${plan.phases.length} (${phase.title})`,
    `next action: ${plan.nextAction.text}${route ? ` (page: ${route})` : ""}`,
  ];
  if (allTasks.length > 0) parts.push(`${done}/${allTasks.length} tasks done`);
  const req = plan.requirements;
  if (req) {
    const needs: string[] = [];
    const learn = req.skills.filter((s) => s.status === "learn").map((s) => s.name);
    if (learn.length) needs.push(`skills to learn: ${learn.join(", ")}`);
    if (req.funds) needs.push(`funds: ${req.funds.note}${req.funds.businessNeeded ? " (needs a business case — /business)" : ""}`);
    if (req.environment.length) needs.push(`environment: ${req.environment.join("; ")}`);
    if (req.social.length) needs.push(`people: ${req.social.join("; ")}`);
    if (req.support === "consider_listen") needs.push("emotional blockers — gently suggest /listen");
    if (needs.length) parts.push(`needs — ${needs.join(" · ")}`);
  }
  return parts.join("; ");
}
function summarizeHealth(health: unknown): string {
  if (!health || typeof health !== "object") return "";
  const h = health as Record<string, unknown>;
  const parts: string[] = [];
  if (h.sleepQuality) parts.push(`sleep ${String(h.sleepQuality)}`);
  if (h.stressLevel) parts.push(`stress ${String(h.stressLevel)}`);
  if (h.exercise) parts.push(`exercise ${String(h.exercise)}`);
  if (h.sessionsPerWeek) parts.push(`${String(h.sessionsPerWeek)} sessions/wk`);
  if (h.food) parts.push(`diet ${String(h.food)}`);
  return parts.join(", ");
}

function summarizeSkills(skills: unknown): string {
  if (!Array.isArray(skills)) return "";
  return skills
    .map((s: any) => (s?.name ? `${s.name}${s.level ? ` (${s.level})` : ""}` : ""))
    .filter(Boolean)
    .slice(0, 8)
    .join(", ");
}

function getActiveHobbies(hobbies: unknown): string {
  if (!hobbies) return "none recorded";
  try {
    const arr = Array.isArray(hobbies) ? hobbies : JSON.parse(hobbies as string);
    const active = arr.filter((h: any) => h?.frequency === "active").map((h: any) => h?.name).filter(Boolean);
    return active.length ? active.join(", ") : "none recorded";
  } catch {
    return "none recorded";
  }
}
