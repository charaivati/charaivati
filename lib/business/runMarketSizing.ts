// lib/business/runMarketSizing.ts
// BIZDOC-4: Market-sizing deepening — TAM/SAM/SOM
//
// CRITICAL CONTRACT (BUSINESS_ANALYSIS_FLOW.md §5):
//   - Math lives in CODE: all arithmetic (tam, sam, som) is computed here in JS.
//   - Judgment lives in the MODEL: population figure, SAM%, SOM%, rationale.
//   - Every model-supplied number is labelled an ASSUMPTION.
//   - Degrades honestly: if cloud is unavailable, returns null — caller shows
//     the framework with empty fields for the user to fill.

import { callAI, safeJsonParse } from "@/app/api/aiClient";
import { ASSESSOR_TIMEOUT_MS } from "./interviewConfig";

// ─── Public Types ──────────────────────────────────────────────────────────────

export interface MarketAssumption {
  id: string;
  label: string;
  pct: number;
  rationale: string;
  validationTask: string;
  successThreshold: string;
}

export interface MarketSizing {
  tam: number;
  sam: number;
  som: number;
  populationBasis: number;
  populationDescription: string;
  samPct: number;
  samRationale: string;
  somPct: number;
  somRationale: string;
  assumptions: MarketAssumption[];
}

// ─── AI call ──────────────────────────────────────────────────────────────────

interface RawSizingOutput {
  populationBasis?: number;
  populationDescription?: string;
  samPct?: number;
  samRationale?: string;
  somPct?: number;
  somRationale?: string;
  samValidationTask?: string;
  samSuccessThreshold?: string;
  somValidationTask?: string;
  somSuccessThreshold?: string;
}

const SYSTEM_PROMPT = `You are a market-sizing expert for small businesses in India (tier-2 and tier-3 cities, informal economy).
Given a business idea, estimate a realistic TAM/SAM/SOM using local Indian data.

Rules:
- populationBasis = TAM: the total population you are sizing from (real number)
- samPct: fraction of TAM that is reachable/relevant (0.0–1.0), with rationale
- somPct: fraction of SAM realistically captured in year 1 (0.0–1.0), with rationale
- Be conservative. A local chai stall's TAM is not all of India.
- Every % is a named assumption with a concrete real-world validation task.
- samValidationTask: specific action the founder can take to validate the SAM assumption
- samSuccessThreshold: what counts as passing (e.g. "6 of 10 people say yes")
- somValidationTask: specific action to validate the SOM assumption
- somSuccessThreshold: what counts as passing for SOM

Respond with valid JSON only, no other text:
{
  "populationBasis": <integer>,
  "populationDescription": <string: how you derived the TAM number>,
  "samPct": <float 0.0–1.0>,
  "samRationale": <string: why this % is realistic>,
  "somPct": <float 0.0–1.0>,
  "somRationale": <string: why this % is realistic for year 1>,
  "samValidationTask": <string: concrete action to validate the SAM assumption>,
  "samSuccessThreshold": <string: what counts as pass>,
  "somValidationTask": <string: concrete action to validate the SOM assumption>,
  "somSuccessThreshold": <string: what counts as pass>
}`;

// ─── Math in code ─────────────────────────────────────────────────────────────

function clampPct(n: number): number {
  return Math.max(0.001, Math.min(0.999, n));
}

function computeSizing(raw: RawSizingOutput): MarketSizing | null {
  const pop = Math.round(Math.abs(raw.populationBasis ?? 0));
  if (!pop) return null;

  const samPct = clampPct(raw.samPct ?? 0.1);
  const somPct = clampPct(raw.somPct ?? 0.05);

  // All arithmetic here — model never does this
  const tam = pop;
  const sam = Math.round(tam * samPct);
  const som = Math.round(sam * somPct);

  const samLabel = `${Math.round(samPct * 100)}% of the market is reachable`;
  const somLabel = `${Math.round(somPct * 100)}% of reachable market captured in year 1`;

  return {
    tam,
    sam,
    som,
    populationBasis: pop,
    populationDescription: raw.populationDescription ?? "Estimated addressable population",
    samPct,
    samRationale: raw.samRationale ?? "Based on typical market penetration for this segment",
    somPct,
    somRationale: raw.somRationale ?? "Conservative year-1 capture rate",
    assumptions: [
      {
        id: "sam",
        label: samLabel,
        pct: samPct,
        rationale: raw.samRationale ?? "",
        validationTask: raw.samValidationTask ?? `Ask 10 people in your target area if they fit the customer profile; look for ${Math.max(3, Math.round(samPct * 10))}+ yes`,
        successThreshold: raw.samSuccessThreshold ?? `${Math.max(3, Math.round(samPct * 10))} of 10 people say yes`,
      },
      {
        id: "som",
        label: somLabel,
        pct: somPct,
        rationale: raw.somRationale ?? "",
        validationTask: raw.somValidationTask ?? `Ask 5 potential customers: "Would you try this in the next month?" Look for ${Math.max(1, Math.round(somPct * 20))}+ yes`,
        successThreshold: raw.somSuccessThreshold ?? `${Math.max(1, Math.round(somPct * 20))} of 5 say yes`,
      },
    ],
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate TAM/SAM/SOM for a business idea.
 * Returns null if cloud is unavailable — caller must degrade gracefully.
 */
export async function runMarketSizing(
  ideaTitle: string,
  ideaDescription: string,
  sector: string,
  userAnswer: string
): Promise<MarketSizing | null> {
  const userPrompt = `Business idea: "${ideaTitle}" — ${ideaDescription}
Sector: ${sector}
Founder's market size answer: "${userAnswer}"

Generate a realistic, conservative TAM/SAM/SOM for this idea in India.`;

  try {
    const raw = await Promise.race([
      callAI({ prompt: userPrompt, systemPrompt: SYSTEM_PROMPT, provider: "openrouter", maxTokens: 400 }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Market sizing timeout")), ASSESSOR_TIMEOUT_MS)
      ),
    ]);

    const parsed = safeJsonParse<RawSizingOutput>(raw);
    const result = computeSizing(parsed);
    if (!result) {
      console.warn("[runMarketSizing] parsed output missing populationBasis");
      return null;
    }
    return result;
  } catch (err) {
    console.warn("[runMarketSizing] cloud unavailable:", err);
    return null;
  }
}
