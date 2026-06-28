// lib/self/energy.ts — framework-agnostic energy computation.
//
// Single source of truth for the user's energy, shared by the Self-page Energy
// block (blocks/EnergyBlock.tsx) AND the AI context (lib/ai/userContext.ts,
// app/api/council/route.ts). Lifted out of EnergyBlock.tsx (a "use client"
// component) so server code can import it without dragging React into the bundle.
//
// Folds health (sleep/exercise/stress/nutrition/joy), environment, time/schedule,
// and funds/runway into one 1-10 overall. Network is still a neutral stub (5) —
// TODO: wire CirclesPanel data when available.

import type { HealthProfile, FrequencyType, JoyProfile, EnvironmentProfile, WeekSchedule, FundsProfile } from "@/types/self";

export type EnergyScore = {
  overall: number;
  physical: number;
  mental: number;
  joy: number;
  environment: number;
  time: number;
  funds: number;
  network: number;
  trend: "up" | "down" | "stable";
  factors: {
    sleep: number;
    exercise: number;
    stress: number;
    nutrition: number;
  };
};

const FREQ_SCORE: Record<FrequencyType, number> = {
  daily:        9,
  few_per_week: 7,
  weekly:       5,
  rarely:       3,
};

function calculateJoyScore(joy: JoyProfile | undefined): number {
  if (!joy) return 5;
  const keys: (keyof JoyProfile)[] = ["hobbies", "sports", "social", "rest"];
  const scores = keys.map(k => {
    const sec = joy[k];
    if (!sec || sec.types.length === 0) return 5; // not configured yet → neutral
    return FREQ_SCORE[sec.frequency] ?? 5;
  });
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function computeEnergy(
  health: HealthProfile,
  env?: EnvironmentProfile,
  schedule?: WeekSchedule,
  funds?: FundsProfile,
): EnergyScore {
  // Sleep
  const sleep =
    health.sleepQuality === "bad"      ? 2 :
    health.sleepQuality === "moderate" ? 6 :
    health.sleepQuality === "good"     ? 9 : 5;

  // Exercise
  const sessions = health.sessionsPerWeek ?? 0;
  const exercise =
    sessions === 0           ? 2 :
    sessions <= 2            ? 5 :
    sessions <= 4            ? 8 : 9;

  // Stress
  const stress =
    health.stressLevel === "High" ? 2 :
    health.stressLevel === "Mid"  ? 6 :
    health.stressLevel === "Low"  ? 9 : 5;

  // Nutrition
  const availableFoods = health.availableFoods ?? [];
  let nutrition =
    health.food === "Vegan"          ? 8 :
    health.food === "Vegetarian"     ? 7 :
    health.food === "Eggetarian"     ? 6 :
    health.food === "Non-Vegetarian" ? 5 : 5;
  if (availableFoods.length > 3) nutrition = Math.min(10, nutrition + 1);

  const physical = Math.round((sleep + exercise) / 2);
  const mental   = Math.round((stress + nutrition) / 2);
  const joy      = calculateJoyScore(health.joy);

  // ── Environment score ────────────────────────────────────────────────────────
  let environment = 5;
  if (env) {
    const ws = env.workspace;
    environment =
      (ws === "home" && env.livingWith === "alone") ? 8 :
      (ws === "office" || ws === "coworking")        ? 7 :
      (ws === "hybrid" || ws === "remote")           ? 7 :
      ws === ""                                      ? 5 : 5;
    environment -= (env.constraints?.length ?? 0) * 0.5;
    environment += (env.assets?.length ?? 0) * 0.3;
    environment = Math.round(environment);
    environment = Math.max(2, Math.min(9, environment));
  }
  environment = Math.max(1, Math.min(10, environment));

  // ── Time score ───────────────────────────────────────────────────────────────
  let time = 5;
  if (schedule) {
    const tasks     = schedule.tasks ?? [];
    const taskCount = tasks.length;
    time =
      taskCount === 0    ? 4 :
      taskCount <= 3     ? 7 :
      taskCount <= 6     ? 8 :
      taskCount <= 9     ? 6 : 4;
    const doneTasks = tasks.filter(t => t.done).length;
    if (taskCount > 0 && doneTasks / taskCount > 0.6) time = Math.min(10, time + 1);
  }
  time = Math.max(1, Math.min(10, time));

  // ── Funds score ──────────────────────────────────────────────────────────────
  let fundsScore = 5;
  if (funds) {
    const sources = funds.sources ?? [];
    if (sources.length === 0) {
      fundsScore = 5; // neutral — no data
    } else {
      const totalIncome = sources.reduce((sum, s) => sum + (s.amount ?? 0), 0);
      const burn        = funds.monthlyBurn ?? 0;
      const runway      = burn > 0 ? totalIncome / burn : Infinity;
      fundsScore =
        runway === Infinity ? 6 :
        runway >= 12        ? 9 :
        runway >= 6         ? 7 :
        runway >= 3         ? 5 :
        runway >= 1         ? 3 : 2;
    }
  }
  fundsScore = Math.max(1, Math.min(10, fundsScore));

  // ── Network score ────────────────────────────────────────────────────────────
  // TODO: wire CirclesPanel data when available
  const network = 5;

  // Weighted: Physical 25% · Mental 25% · Joy 20% · Environment 10% · Time 10% · Funds 5% · Network 5%
  const overall = Math.max(1, Math.min(10, Math.round(
    physical    * 0.25 +
    mental      * 0.25 +
    joy         * 0.20 +
    environment * 0.10 +
    time        * 0.10 +
    fundsScore  * 0.05 +
    network     * 0.05
  )));

  return {
    overall,
    physical,
    mental,
    joy,
    environment,
    time,
    funds: fundsScore,
    network,
    trend: "stable",
    factors: { sleep, exercise, stress, nutrition },
  };
}
