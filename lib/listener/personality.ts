// lib/listener/personality.ts — Listener (Saathi) slow-built personality layer (UCTX-3).
//
// PersonalityProfile (one row per user) is a HYPOTHESIS-GRADE tone-steering
// signal, built ±0.1/pass every 8th user message. It is:
//   - local-tier composer use ONLY (never sent to cloud providers)
//   - never user-facing (no "you are a D-type" anywhere)
//   - a SEPARATE signal from ConsultSession.insights.driveCandidate — the two
//     are not reconciled or cross-written
//
// HARD RULE (CONSULT-0c §4, standing ban): nothing in this file or anything
// that calls it may read OR write UserCompanionProfile fields. Reading is
// fine elsewhere; this module doesn't even import db.

import type { DriveValue } from "./insights";

export type DiscDim = "D" | "I" | "S" | "C";
export const DISC_DIMS: DiscDim[] = ["D", "I", "S", "C"];
export const DRIVE_DIMS: DriveValue[] = ["learning", "helping", "building", "doing"];

const MAX_NOTES = 20;
const MAX_DELTA = 0.1;

export interface TraitSignal {
  score: number; // 0-1
  evidence: number; // count of passes that adjusted this dim
}

export type DiscScores = Record<DiscDim, TraitSignal>;
export type DriveTraitScores = Record<DriveValue, TraitSignal>;

export interface PersonalityData {
  disc: DiscScores;
  driveScores: DriveTraitScores;
  sampleCount: number;
  confidence: number;
  notes: string[];
}

/** Raw shape returned by the extraction-pass LLM call — deltas only. */
export interface PersonalityDeltas {
  disc: Partial<Record<DiscDim, number>>;
  drives: Partial<Record<DriveValue, number>>;
  evidence: string[];
}

function emptySignal(): TraitSignal {
  return { score: 0.5, evidence: 0 };
}

export function emptyPersonality(): PersonalityData {
  const disc = {} as DiscScores;
  for (const d of DISC_DIMS) disc[d] = emptySignal();
  const driveScores = {} as DriveTraitScores;
  for (const d of DRIVE_DIMS) driveScores[d] = emptySignal();
  return { disc, driveScores, sampleCount: 0, confidence: 0, notes: [] };
}

function normalizeSignal(v: unknown): TraitSignal {
  if (!v || typeof v !== "object") return emptySignal();
  const r = v as Record<string, unknown>;
  const score = typeof r.score === "number" && Number.isFinite(r.score) ? clamp01(r.score) : 0.5;
  const evidence = typeof r.evidence === "number" && Number.isFinite(r.evidence) ? Math.max(0, Math.floor(r.evidence)) : 0;
  return { score, evidence };
}

/** Coerces an unknown DB JSON value into a well-formed PersonalityData. */
export function normalizePersonality(raw: {
  disc?: unknown;
  driveScores?: unknown;
  sampleCount?: unknown;
  confidence?: unknown;
  notes?: unknown;
}): PersonalityData {
  const base = emptyPersonality();
  const rd = (raw.disc && typeof raw.disc === "object") ? (raw.disc as Record<string, unknown>) : {};
  for (const d of DISC_DIMS) base.disc[d] = normalizeSignal(rd[d]);

  const rs = (raw.driveScores && typeof raw.driveScores === "object") ? (raw.driveScores as Record<string, unknown>) : {};
  for (const d of DRIVE_DIMS) base.driveScores[d] = normalizeSignal(rs[d]);

  base.sampleCount = typeof raw.sampleCount === "number" && Number.isFinite(raw.sampleCount) ? Math.max(0, Math.floor(raw.sampleCount)) : 0;
  base.confidence = typeof raw.confidence === "number" && Number.isFinite(raw.confidence) ? clamp01(raw.confidence) : 0;
  base.notes = Array.isArray(raw.notes)
    ? raw.notes.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().slice(0, 200))
    : [];
  return base;
}

/** Parses+validates the extraction LLM's raw JSON output into safe deltas. */
export function normalizeDeltas(raw: unknown): PersonalityDeltas {
  const out: PersonalityDeltas = { disc: {}, drives: {}, evidence: [] };
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, any>;

  if (r.disc && typeof r.disc === "object") {
    for (const d of DISC_DIMS) {
      const v = r.disc[d];
      if (typeof v === "number" && Number.isFinite(v)) out.disc[d] = clampDelta(v);
    }
  }
  if (r.drives && typeof r.drives === "object") {
    for (const d of DRIVE_DIMS) {
      const v = r.drives[d];
      if (typeof v === "number" && Number.isFinite(v)) out.drives[d] = clampDelta(v);
    }
  }
  if (Array.isArray(r.evidence)) {
    out.evidence = r.evidence
      .filter((x: unknown): x is string => typeof x === "string" && x.trim().length > 0)
      .map((x: string) => x.trim().slice(0, 200))
      .slice(0, 5);
  }
  return out;
}

/**
 * Applies one extraction pass's deltas onto the current profile:
 *  - each score moves by its (clamped ±0.1) delta, clamped back to [0,1]
 *  - dims with a non-zero delta get their evidence counter incremented
 *  - sampleCount increments once per pass
 *  - confidence is recomputed: min(1, sampleCount/12), damped when this
 *    pass's deltas disagree with the profile's existing lean (i.e. push a
 *    dim back toward 0.5 / the opposite direction it was already leaning)
 *  - evidence strings are appended to notes, FIFO-capped at 20
 */
export function applyPersonalityDeltas(current: PersonalityData, deltas: PersonalityDeltas): PersonalityData {
  const next: PersonalityData = {
    disc: { ...current.disc },
    driveScores: { ...current.driveScores },
    sampleCount: current.sampleCount + 1,
    confidence: current.confidence,
    notes: [...current.notes],
  };

  let agree = 0;
  let total = 0;

  for (const d of DISC_DIMS) {
    const delta = deltas.disc[d];
    if (!delta) continue;
    const before = current.disc[d];
    next.disc[d] = { score: clamp01(before.score + delta), evidence: before.evidence + 1 };
    total++;
    if (signsAgree(before.score, delta)) agree++;
  }

  for (const d of DRIVE_DIMS) {
    const delta = deltas.drives[d];
    if (!delta) continue;
    const before = current.driveScores[d];
    next.driveScores[d] = { score: clamp01(before.score + delta), evidence: before.evidence + 1 };
    total++;
    if (signsAgree(before.score, delta)) agree++;
  }

  // Disagreement penalty: when this pass's deltas push existing leans back
  // toward (or past) neutral more often than they reinforce them, confidence
  // grows more slowly.
  const disagreementPenalty = total > 0 ? ((total - agree) / total) * 0.3 : 0;
  next.confidence = clamp01(Math.min(1, next.sampleCount / 12) * (1 - disagreementPenalty));

  if (deltas.evidence.length) {
    next.notes = [...next.notes, ...deltas.evidence].slice(-MAX_NOTES);
  }

  return next;
}

/** True if a delta pushes a score further from neutral (0.5) in the direction it already leans. */
function signsAgree(scoreBefore: number, delta: number): boolean {
  const lean = scoreBefore - 0.5;
  if (lean === 0) return true; // no existing lean — any signal counts as agreement
  return Math.sign(lean) === Math.sign(delta);
}

function clampDelta(v: number): number {
  return Math.max(-MAX_DELTA, Math.min(MAX_DELTA, v));
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Compact tone-steering line for the local-tier composer. Returns null when
 * confidence is below the threshold (caller decides the threshold — UCTX-3
 * uses 0.3). Describes signals only, never names the framework.
 */
export function summarizePersonalityForComposer(p: PersonalityData, threshold = 0.3): string | null {
  if (p.confidence < threshold) return null;

  const traits: string[] = [];
  const disc = p.disc;
  if (disc.D.score >= 0.6) traits.push("prefers directness and getting to the point");
  if (disc.D.score <= 0.4) traits.push("responds well to a gentler, less direct approach");
  if (disc.I.score >= 0.6) traits.push("values relational warmth — acknowledge feelings before moving on");
  if (disc.S.score >= 0.6) traits.push("appreciates patient pacing — avoid pushing");
  if (disc.C.score >= 0.6) traits.push("engages best with concrete specifics, not vague language");

  const topDrive = topDriveName(p);
  if (topDrive) traits.push(`seems energized by ${driveEnergyPhrase(topDrive)}`);

  if (traits.length === 0) return null;
  return `Tone steering (hypothesis, confidence ${p.confidence.toFixed(2)}): ${traits.join("; ")}.`;
}

function driveEnergyPhrase(d: DriveValue): string {
  switch (d) {
    case "learning": return "learning new things";
    case "helping": return "helping people";
    case "building": return "building or creating things";
    case "doing": return "doing steady, practical work";
  }
}

/** Returns the drive with the highest score, or null if none stands out (all near 0.5). */
export function topDriveName(p: PersonalityData): DriveValue | null {
  let best: DriveValue | null = null;
  let bestScore = 0.55; // require at least a mild lean to surface
  for (const d of DRIVE_DIMS) {
    const score = p.driveScores[d].score;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}
