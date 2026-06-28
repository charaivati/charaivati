// lib/business/runAssessor.ts
// Cloud Assessor — called adaptively when local confidence is low, and once for
// the final verdict. Uses callAI() with provider:"openrouter" which bypasses
// Ollama entirely and falls through Groq → Vercel if OpenRouter fails.

import { callAI, safeJsonParse } from "@/app/api/aiClient";
import { loadRawFile, warmContextOverrides } from "@/lib/ai/contextLoader";
import {
  buildAssessorPrompt,
  buildVerdictPrompt,
  ASSESSOR_TIMEOUT_MS,
  type DimKey,
  type AssessorResult,
} from "./interviewConfig";

// Load philosophy — contextLoader caches it; warm pulls admin DB overrides first.
async function getPhilosophy(): Promise<string> {
  await warmContextOverrides();
  return loadRawFile("BUSINESS_AI_PHILOSOPHY.txt");
}

export interface AssessorUnavailableError {
  unavailable: true;
}

async function callWithTimeout(prompt: string, systemPrompt: string): Promise<string> {
  return Promise.race([
    callAI({ prompt, systemPrompt, provider: "openrouter", maxTokens: 250 }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Assessor timeout")), ASSESSOR_TIMEOUT_MS)
    ),
  ]);
}

/**
 * Run the cloud Assessor for a single dimension.
 * Returns null if the cloud is unavailable (caller handles degradation).
 */
export async function runAssessor(
  dim: DimKey,
  ideaTitle: string,
  ideaDescription: string,
  sector: string,
  dimensionTranscript: string // all user answers relevant to this dimension
): Promise<AssessorResult | null> {
  const systemPrompt = buildAssessorPrompt(await getPhilosophy());

  const userPrompt = `Idea: "${ideaTitle}" — ${ideaDescription}
Sector: ${sector}
Dimension: ${dim}
User's answers about this dimension:
${dimensionTranscript}`;

  try {
    const raw = await callWithTimeout(userPrompt, systemPrompt);
    const parsed = safeJsonParse<{
      score?: number;
      reason?: string;
      oneThingToRaise?: string;
    }>(raw);

    return {
      score: Math.max(-2, Math.min(2, Math.round(parsed.score ?? 0))),
      reason: parsed.reason ?? "No reason provided.",
      oneThingToRaise: parsed.oneThingToRaise ?? "Consider gathering more customer evidence.",
    };
  } catch (err) {
    console.warn("[runAssessor] cloud Assessor unavailable for dim", dim, err);
    return null;
  }
}

export interface FinalVerdictResult {
  verdict: string;
  rating: number;
  nextSteps: string[];
  tier: "senior" | "local";
}

/**
 * Run the cloud Assessor for the final overall verdict.
 * If cloud is unavailable, falls back to a local verdict derived from scores.
 */
export async function runFinalVerdict(
  ideaTitle: string,
  ideaDescription: string,
  finalScores: Record<string, number>,
  assessorReasons: Record<string, string>
): Promise<FinalVerdictResult> {
  const systemPrompt = buildVerdictPrompt(await getPhilosophy());

  const dimSummary = Object.entries(finalScores)
    .map(([dim, score]) => {
      const reason = assessorReasons[dim] ?? "";
      return `- ${dim}: ${score > 0 ? "+" : ""}${score}${reason ? ` (${reason})` : ""}`;
    })
    .join("\n");

  const userPrompt = `Idea: "${ideaTitle}" — ${ideaDescription}
Dimension scores:
${dimSummary}`;

  try {
    const raw = await callWithTimeout(userPrompt, systemPrompt);
    const parsed = safeJsonParse<{
      verdict?: string;
      rating?: number;
      nextSteps?: string[];
    }>(raw);

    return {
      verdict: parsed.verdict ?? "Evaluation complete.",
      rating: Math.max(1, Math.min(5, Math.round(parsed.rating ?? 3))),
      nextSteps: (parsed.nextSteps ?? []).slice(0, 3),
      tier: "senior",
    };
  } catch (err) {
    console.warn("[runAssessor] final verdict cloud unavailable, using local fallback:", err);
    // Local-only fallback verdict
    return buildLocalVerdict(finalScores);
  }
}

function buildLocalVerdict(scores: Record<string, number>): FinalVerdictResult {
  const values = Object.values(scores);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  let verdict = "💡 Idea has potential";
  let rating = 3;
  if (avg >= 1.5) { verdict = "🚀 Strong idea! Ready to validate and execute."; rating = 5; }
  else if (avg >= 0.5) { verdict = "📈 Promising idea with some execution risks."; rating = 4; }
  else if (avg >= -0.5) { verdict = "🤔 Idea needs refinement — validate with customers first."; rating = 3; }
  else { verdict = "⚠️ Significant challenges — reconsider or pivot."; rating = 2; }

  const weakDims = Object.entries(scores)
    .filter(([, s]) => s <= 0)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3);

  const nextSteps = weakDims.map(([dim]) => {
    const map: Record<string, string> = {
      problemClarity: "Clarify the problem: make it specific with real examples.",
      marketNeed: "Validate market: talk to 5–10 potential customers this week.",
      targetAudience: "Define your audience: who exactly, where, and what they earn.",
      uniqueValue: "Sharpen your USP: why would someone switch to you today?",
      feasibility: "Plan your first 30 days: what is the one thing you do first?",
      monetization: "Define pricing: what do competitors charge, and why would you be different?",
    };
    return map[dim] ?? `Strengthen ${dim}.`;
  });

  if (nextSteps.length === 0) {
    nextSteps.push("Get your first customer — everything else is theory.");
  }
  while (nextSteps.length < 3) {
    nextSteps.push("Review and improve the weakest dimension above.");
  }

  return { verdict, rating, nextSteps: nextSteps.slice(0, 3), tier: "local" };
}
