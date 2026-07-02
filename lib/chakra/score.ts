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
import { CHAKRA_KEYS, isChakraKey, type ChakraKey } from "@/lib/chakra/keys";
import type { HealthProfile, EnvironmentProfile, WeekSchedule, FundsProfile } from "@/types/self";

const DORMANT = 8; // small non-zero baseline — empty ≠ broken
const clamp = (n: number) => Math.max(DORMANT, Math.min(100, Math.round(n)));
// cap a raw count at `full` then scale to 0–100 (so a new user is never stuck at 0)
const cap = (count: number, full: number) => clamp((Math.min(count, full) / full) * 100);

// One named sub-signal of a chakra's platform score. `key` is a stable machine
// key — the UI translates it via the `chakra-signal-<key>` i18n slug.
export type ChakraSignal = { key: string; value: number };

export type ChakraDetail = {
  score: number;        // blended 0–100
  platform: number;     // platform-only signal 0–100
  self: number | null;  // self-report normalized 0–100, or null if not set
  platformOnly: boolean;
  signals: ChakraSignal[]; // the sub-signals averaged into `platform`
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
    earnPageCount,
    goalCount,
    taggedTodoRows,
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
    db.page.count({ where: { ownerId: userId, deletedAt: null, pageType: { in: ["store", "service", "fleet"] } } }),
    db.aiGoal.count({ where: { userId } }),
    // Todo.chakra is a raw-SQL-only column (stale-client pattern) — group here.
    db.$queryRaw<{ chakra: string; total: number; done: number }[]>`
      SELECT "chakra", COUNT(*)::int AS total, (COUNT(*) FILTER (WHERE "completed"))::int AS done
      FROM "Todo" WHERE "userId" = ${userId} AND "chakra" IS NOT NULL GROUP BY "chakra"`,
  ]);

  const consultCount = consultSession
    ? await (db as any).consultMessage.count({ where: { sessionId: consultSession.id } })
    : 0;

  // ── ROOT: health + funds (energy 1–10 → ×10) + survival action taken ───────
  const energy = computeEnergy(
    (profile?.health ?? {}) as HealthProfile,
    (profile?.environmentProfile ?? undefined) as EnvironmentProfile | undefined,
    (profile?.weekSchedule ?? undefined) as WeekSchedule | undefined,
    (profile?.fundsProfile ?? undefined) as FundsProfile | undefined,
  );
  // "action" = is the user acting on survival: earning initiatives (full=2) + goals set (full=3)
  const action = clamp((cap(earnPageCount, 2) + cap(goalCount, 3)) / 2);

  // ── SOLAR: todo completion rate + course mastery avg ────────────────────────
  const completion = todoTotal > 0 ? (todoDone / todoTotal) * 100 : DORMANT;
  const mastery = courseProgress.length
    ? courseProgress.reduce((s, p) => s + (p.mastery ?? 0), 0) / courseProgress.length
    : DORMANT;

  // ── HEART: existence of other-serving initiatives (depth scored later) ─────
  // 0 → dormant; 1+ ramps 60→100 by count. Existence is what matters in v1.
  const heartBase = heartCount > 0 ? clamp(60 + heartCount * 15) : DORMANT;

  // Named sub-signals per chakra; platform score = their average. Crown stays
  // PARKED (no signals → DORMANT).
  const signals: Record<ChakraKey, ChakraSignal[]> = {
    root: [
      { key: "health", value: clamp(energy.physical * 10) },
      { key: "funds", value: clamp(energy.funds * 10) },
      { key: "action", value: action },
    ],
    sacral: [
      { key: "friends", value: cap(friendCount, 10) },
      { key: "posts", value: cap(postCount, 20) },
      { key: "chat", value: cap(chatCount, 50) },
    ],
    solar: [
      { key: "completion", value: clamp(completion) },
      { key: "mastery", value: clamp(mastery) },
    ],
    heart: [{ key: "initiatives", value: heartBase }],
    throat: [
      { key: "voice", value: cap(publicPostCount, 15) },
      { key: "shared", value: cap(sharedInitiativeCount, 5) },
    ],
    third_eye: [{ key: "reflection", value: cap(consultCount, 30) }],
    crown: [],
  };

  // Chakra-tagged todo completion joins that chakra's signal average — the
  // unified Todo channel directly moves the light it is tagged to.
  for (const row of taggedTodoRows) {
    if (isChakraKey(row.chakra) && row.chakra !== "crown" && row.total > 0) {
      signals[row.chakra].push({ key: "todos", value: clamp((row.done / row.total) * 100) });
    }
  }

  const platform = {} as Record<ChakraKey, number>;
  for (const key of CHAKRA_KEYS) {
    const sig = signals[key];
    platform[key] = sig.length ? clamp(sig.reduce((s, v) => s + v.value, 0) / sig.length) : DORMANT;
  }

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
      signals: signals[key],
    };
  }
  return report;
}
