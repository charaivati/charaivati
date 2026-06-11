// lib/listener/insights.ts — Listener (Saathi) insights JSON: shape, merge, stage gating.
//
// The insights blob lives on ConsultSession.insights. It deliberately has NO goal
// field — goal candidates flow exclusively through the ProfileProposal mechanism
// (lib/companion/profileSync.tryProposeGoal), never stored here.
//
// HARD RULE (CONSULT-0c §4): Listener code must NEVER write UserCompanionProfile
// fields (primaryDrive, driveConfirmedByUser, dailyAvailableHours, healthFlags) —
// those gate the companion arc state machine. Reading UCP is fine.

export type DriveValue = "learning" | "helping" | "building" | "doing";

export interface ConsultInsights {
  themes: string[];
  driveCandidate: { value: DriveValue | null; confidence: "sensed" | "confirmed" };
  skills: { items: string[] };
  health: { notes: string[]; senseLevel: number | null };
  environment: { notes: string[] };
  time: { notes: string[]; dailyHours: number | null };
  funds: { notes: string[]; pressure: "low" | "medium" | "high" | null };
  network: { notes: string[] };
  energy: { senseLevel: number | null };
}

const MAX_LIST = 12;
const DRIVE_VALUES = new Set<string>(["learning", "helping", "building", "doing"]);
const PRESSURES = new Set<string>(["low", "medium", "high"]);

export function emptyInsights(): ConsultInsights {
  return {
    themes: [],
    driveCandidate: { value: null, confidence: "sensed" },
    skills: { items: [] },
    health: { notes: [], senseLevel: null },
    environment: { notes: [] },
    time: { notes: [], dailyHours: null },
    funds: { notes: [], pressure: null },
    network: { notes: [] },
    energy: { senseLevel: null },
  };
}

/** Coerces an unknown DB JSON value into a well-formed ConsultInsights. */
export function normalizeInsights(raw: unknown): ConsultInsights {
  const base = emptyInsights();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, any>;

  base.themes = strList(r.themes);
  if (r.driveCandidate && typeof r.driveCandidate === "object") {
    const v = r.driveCandidate.value;
    base.driveCandidate.value = DRIVE_VALUES.has(v) ? (v as DriveValue) : null;
    base.driveCandidate.confidence = r.driveCandidate.confidence === "confirmed" ? "confirmed" : "sensed";
  }
  base.skills.items = strList(r.skills?.items);
  base.health = { notes: strList(r.health?.notes), senseLevel: num(r.health?.senseLevel) };
  base.environment = { notes: strList(r.environment?.notes) };
  base.time = { notes: strList(r.time?.notes), dailyHours: num(r.time?.dailyHours) };
  base.funds = {
    notes: strList(r.funds?.notes),
    pressure: PRESSURES.has(r.funds?.pressure) ? r.funds.pressure : null,
  };
  base.network = { notes: strList(r.network?.notes) };
  base.energy = { senseLevel: num(r.energy?.senseLevel) };
  return base;
}

/**
 * Merges an extraction-pass result into the current insights.
 * Rules: lists are union-deduped (capped); scalars only fill in or update with
 * non-null incoming values; a CONFIRMED driveCandidate is never overwritten or
 * downgraded — only null→value and sensed→confirmed transitions are allowed.
 */
export function mergeInsights(current: ConsultInsights, incoming: ConsultInsights): ConsultInsights {
  const merged = emptyInsights();

  merged.themes = unionList(current.themes, incoming.themes);
  merged.skills.items = unionList(current.skills.items, incoming.skills.items);
  merged.health.notes = unionList(current.health.notes, incoming.health.notes);
  merged.environment.notes = unionList(current.environment.notes, incoming.environment.notes);
  merged.time.notes = unionList(current.time.notes, incoming.time.notes);
  merged.funds.notes = unionList(current.funds.notes, incoming.funds.notes);
  merged.network.notes = unionList(current.network.notes, incoming.network.notes);

  merged.health.senseLevel = incoming.health.senseLevel ?? current.health.senseLevel;
  merged.time.dailyHours = incoming.time.dailyHours ?? current.time.dailyHours;
  merged.funds.pressure = incoming.funds.pressure ?? current.funds.pressure;
  merged.energy.senseLevel = incoming.energy.senseLevel ?? current.energy.senseLevel;

  if (current.driveCandidate.confidence === "confirmed" && current.driveCandidate.value) {
    merged.driveCandidate = { ...current.driveCandidate };
  } else if (incoming.driveCandidate.value) {
    merged.driveCandidate = { ...incoming.driveCandidate };
  } else {
    merged.driveCandidate = { ...current.driveCandidate };
  }

  return merged;
}

/** Compact one-block text summary for the system prompt. Omits empty fields. */
export function summarizeInsights(ins: ConsultInsights): string {
  const lines: string[] = [];
  if (ins.themes.length) lines.push(`Themes so far: ${ins.themes.join("; ")}`);
  if (ins.driveCandidate.value)
    lines.push(`Values lean (${ins.driveCandidate.confidence}, internal only — never name it): ${ins.driveCandidate.value}`);
  if (ins.skills.items.length) lines.push(`Skills mentioned: ${ins.skills.items.join("; ")}`);
  if (ins.health.notes.length) lines.push(`Health: ${ins.health.notes.join("; ")}`);
  if (ins.environment.notes.length) lines.push(`Environment: ${ins.environment.notes.join("; ")}`);
  if (ins.time.notes.length || ins.time.dailyHours != null)
    lines.push(`Time: ${[...ins.time.notes, ins.time.dailyHours != null ? `~${ins.time.dailyHours}h/day free` : ""].filter(Boolean).join("; ")}`);
  if (ins.funds.notes.length || ins.funds.pressure)
    lines.push(`Money: ${[...ins.funds.notes, ins.funds.pressure ? `pressure: ${ins.funds.pressure}` : ""].filter(Boolean).join("; ")}`);
  if (ins.network.notes.length) lines.push(`People around them: ${ins.network.notes.join("; ")}`);
  if (ins.energy.senseLevel != null) lines.push(`Energy sense: ${ins.energy.senseLevel}/10`);
  return lines.join("\n");
}

const touched = (notes: string[], scalar: unknown) => notes.length > 0 || scalar != null;

/**
 * Data-gated stage advancement — at most one stage per evaluation.
 * 4→5 is deliberately NOT here: it happens only when the user accepts a proposal
 * (wired by the Listener UI prompt, not the extraction pass).
 */
export function evaluateStageAdvance(stage: number, ins: ConsultInsights, goalEmerging: boolean): number {
  if (stage === 0 && ins.themes.length >= 1) return 1;
  if (
    stage === 1 &&
    ins.themes.length >= 2 &&
    (ins.skills.items.length > 0 ||
      [ins.health.notes, ins.environment.notes, ins.time.notes, ins.funds.notes, ins.network.notes].some((n) => n.length > 0))
  )
    return 2;
  if (stage === 2 && ins.driveCandidate.value) return 3;
  if (
    stage === 3 &&
    goalEmerging &&
    touched(ins.time.notes, ins.time.dailyHours) &&
    touched(ins.funds.notes, ins.funds.pressure) &&
    ins.energy.senseLevel != null
  )
    return 4;
  return stage;
}

function strList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().slice(0, 200)).slice(0, MAX_LIST);
}

function unionList(a: string[], b: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [...a, ...b]) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out.slice(0, MAX_LIST);
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
