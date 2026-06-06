// lib/business/runInterviewer.ts
// Local confidence check — runs on Ollama (gemma/llama local model).
// Uses chatCompleteWithMeta() so it benefits from the standard fallback chain.
// When Ollama is unavailable chatCompleteWithMeta() falls to cloud automatically;
// that is the degraded path (localUnavailable = true in the interview state).
//
// NOTE: No outer Promise.race timeout is applied here. The internal Ollama
// resilient caller already handles per-attempt timeouts (8s × 2 attempts).
// Cloud providers respond within seconds once Ollama is marked unavailable.
// An outer race would fire BEFORE the cloud fallback completes (Ollama alone
// can take 16s) and would hide the source:"cloud" signal that the route needs
// to set localUnavailable correctly.

import { chatCompleteWithMeta, safeJsonParse } from "@/app/api/aiClient";
import { buildInterviewerPrompt, type DimKey } from "./interviewConfig";

// Extended prompt that also asks for a one-sentence reaction (BIZDOC-4).
// Falls back gracefully if model omits the field.
function buildInterviewerPromptWithReaction(dim: DimKey, question: string, sectorNote: string): string {
  return buildInterviewerPrompt(dim, question, sectorNote).replace(
    `}`,
    `  "reaction": <one honest, sector-grounded sentence reacting to the answer — not flattery, not a lecture; null if unsure>
}`
  );
}

export interface InterviewerResult {
  score: number;          // -2 to 2
  confidence: number;     // 0 to 1
  followUpNeeded: boolean;
  source: "local" | "cloud";
  /** One honest, sector-grounded sentence reacting to the answer (BIZDOC-4). null if model skipped it. */
  reaction: string | null;
}

const SECTOR_NOTES: Record<string, string> = {
  food: "food/restaurant sector — FSSAI, spoilage, footfall are relevant",
  service: "service business — repeat clients, capacity, and pricing matter",
  retail: "retail/shop — location, margins, inventory are key",
  craft: "craft/handicraft — production capacity and distribution",
  education: "education/tutoring — student acquisition and retention",
  delivery: "delivery/logistics — reliability and route economics",
  digital: "digital/tech product — user acquisition and trust",
  health: "health/wellness — compliance and trust are critical",
  general: "",
};

function clampScore(s: number): number {
  return Math.max(-2, Math.min(2, Math.round(s)));
}

function clampConf(c: number): number {
  return Math.max(0, Math.min(1, c));
}

export async function runInterviewer(
  dim: DimKey,
  questionText: string,
  userAnswer: string,
  sector: string
): Promise<InterviewerResult> {
  const sectorNote = SECTOR_NOTES[sector] ?? "";
  const systemPrompt = buildInterviewerPromptWithReaction(dim, questionText, sectorNote);
  const model = process.env.INTERVIEW_LOCAL_MODEL ?? process.env.OLLAMA_MODEL ?? "llama3:8b";

  let meta: { content: string; source: "local" | "cloud" };
  try {
    meta = await chatCompleteWithMeta({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userAnswer },
      ],
      maxTokens: 120,
      temperature: 0.2,
      jsonMode: true,
    });
    console.log(`[Interviewer] dim=${dim} answered via ${meta.source}`);
  } catch (err) {
    // All providers failed. Return source:"cloud" so the route sets
    // localUnavailable=true and skips probe logic for this turn.
    console.warn("[runInterviewer] all providers failed — returning neutral (degraded):", err);
    return { score: 0, confidence: 0.3, followUpNeeded: false, source: "cloud", reaction: null };
  }

  try {
    const parsed = safeJsonParse<{
      score?: number;
      confidence?: number;
      followUpNeeded?: boolean;
      reaction?: string | null;
    }>(meta.content);

    const reaction = typeof parsed.reaction === "string" && parsed.reaction.trim()
      ? parsed.reaction.trim()
      : null;

    return {
      score: clampScore(parsed.score ?? 0),
      confidence: clampConf(parsed.confidence ?? 0.5),
      followUpNeeded: parsed.followUpNeeded ?? (clampConf(parsed.confidence ?? 0.5) < 0.55),
      source: meta.source,
      reaction,
    };
  } catch {
    console.warn("[runInterviewer] unparseable response from", meta.source, meta.content.slice(0, 120));
    return { score: 0, confidence: 0.3, followUpNeeded: false, source: meta.source, reaction: null };
  }
}
