// CHAKRA-1: chakra "openness" scoring. Pure read — no new stored state.
// Each chakra 0–100. Blend = 0.6*platform + 0.4*selfReport; when no self-report
// exists for a chakra, score = platform alone and platformOnly=true (the UI
// surfaces the platform/felt gap as insight, never as deficiency).
//
// Platform signals reuse ONLY confirmed-present data. Every sub-signal is
// normalized 0–100 (normalization documented inline) and floored at DORMANT so
// an empty signal reads as "ready to awaken", never 0/"broken". Crown is PARKED
// — a fixed dormant placeholder, no computation (see TECH_DEBT.md).

import { db } from "@/lib/db";
import { computeEnergy } from "@/lib/self/energy";
import { CHAKRA_KEYS, type ChakraKey } from "@/lib/chakra/keys";
import type { HealthProfile, EnvironmentProfile, WeekSchedule, FundsProfile } from "@/types/self";

const DORMANT = 8; // small non-zero baseline — empty ≠ broken
const clamp = (n: number) => Math.max(DORMANT, Math.min(100, Math.round(n)));
// cap a raw count at `full` then scale to 0–100 (so a new user is never stuck at 0)
const cap = (count: number, full: number) => clamp((Math.min(count, full) / full) * 100);

export type ChakraDetail = {
  score: number;        // blended 0–100
  platform: number;     // platform-only signal 0–100
  self: number | null;  // self-report normalized 0–100, or null if not set
  platformOnly: boolean;
};
export type ChakraReport = Record<ChakraKey, ChakraDetail>;

export async function computeChakraScores(userId: string): Promise<ChakraReport> {
  const [
    profile,
    selfRows,
    friendCount,
    postCount,
    chatCount,
    publicPostCount,
    sharedInitiativeCount,
    courseProgress,
    todoTotal,
    todoDone,
    heartCount,
    consultSession,
  ] = await Promise.all([
    db.profile.findUnique({
      where: { userId },
      select: { health: true, fundsProfile: true, environmentProfile: true, weekSchedule: true },
    }),
    // chakraSelfReport column may be unknown to a stale client — read via raw SQL.
    db.$queryRaw<{ chakraSelfReport: Record<string, number> | null }[]>`
      SELECT "chakraSelfReport" FROM "Profile" WHERE "userId" = ${userId}`,
    db.friendship.count({ where: { OR: [{ userAId: userId }, { userBId: userId }] } }),
    db.post.count({ where: { userId, status: "active" } }),
    db.chatMessage.count({ where: { senderId: userId } }),
    db.post.count({ where: { userId, status: "active", visibility: "public" } }),
    db.post.count({ where: { userId, status: "active", visibility: "public", pageId: { not: null } } }),
    db.courseProgress.findMany({ where: { userId }, select: { mastery: true } }),
    db.todo.count({ where: { userId } }),
    db.todo.count({ where: { userId, completed: true } }),
    db.page.count({ where: { ownerId: userId, deletedAt: null, pageType: { in: ["helping", "community_group"] } } }),
    (db as any).consultSession.findUnique({ where: { userId }, select: { id: true } }),
  ]);

  const consultCount = consultSession
    ? await (db as any).consultMessage.count({ where: { sessionId: consultSession.id } })
    : 0;

  // ── ROOT: energy physical + funds (each 1–10 → avg → ×10 → 0–100) ──────────
  const energy = computeEnergy(
    (profile?.health ?? {}) as HealthProfile,
    (profile?.environmentProfile ?? undefined) as EnvironmentProfile | undefined,
    (profile?.weekSchedule ?? undefined) as WeekSchedule | undefined,
    (profile?.fundsProfile ?? undefined) as FundsProfile | undefined,
  );
  const root = clamp(((energy.physical + energy.funds) / 2) * 10);

  // ── SACRAL: friends (full=10) + posts (full=20) + chat (full=50), averaged ──
  const sacral = clamp((cap(friendCount, 10) + cap(postCount, 20) + cap(chatCount, 50)) / 3);

  // ── SOLAR: todo completion rate + course mastery avg, averaged ─────────────
  const completion = todoTotal > 0 ? (todoDone / todoTotal) * 100 : DORMANT;
  const mastery = courseProgress.length
    ? courseProgress.reduce((s, p) => s + (p.mastery ?? 0), 0) / courseProgress.length
    : DORMANT;
  const solar = clamp((completion + mastery) / 2);

  // ── HEART: existence of other-serving initiatives (depth scored later) ─────
  // 0 → dormant; 1+ ramps 60→100 by count. Existence is what matters in v1.
  const heart = heartCount > 0 ? clamp(60 + heartCount * 15) : DORMANT;

  // ── THROAT: public posts (full=15) + initiatives shared publicly (full=5) ──
  const throat = clamp((cap(publicPostCount, 15) + cap(sharedInitiativeCount, 5)) / 2);

  // ── THIRD_EYE: /listen consult message activity (full=30) ───────────────────
  const third_eye = cap(consultCount, 30);

  // ── CROWN: PARKED — dormant placeholder, no computation ────────────────────
  const crown = DORMANT;

  const platform: Record<ChakraKey, number> = { root, sacral, solar, heart, throat, third_eye, crown };
  const selfReport = selfRows[0]?.chakraSelfReport ?? null;

  const report = {} as ChakraReport;
  for (const key of CHAKRA_KEYS) {
    const raw = selfReport?.[key];
    // slider 1–7 → 0–100 via v/7 so the lowest felt value (1) ≈ 14, never 0.
    const self = typeof raw === "number" && raw > 0 ? Math.round((Math.min(raw, 7) / 7) * 100) : null;
    const p = platform[key];
    report[key] = {
      platform: p,
      self,
      platformOnly: self === null,
      score: self === null ? p : Math.round(0.6 * p + 0.4 * self),
    };
  }
  return report;
}
