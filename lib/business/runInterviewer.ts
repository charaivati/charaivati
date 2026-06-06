// lib/business/runInterviewer.ts
// Local confidence check — runs on Ollama (gemma/llama local model).
// Uses chatComplete() so it benefits from the standard fallback chain.
// When Ollama is unavailable chatComplete() falls to cloud automatically;
// that is the degraded path (localUnavailable = true in the interview state).

import { chatCompleteWithMeta, safeJsonParse } from "@/app/api/aiClient";
import { buildInterviewerPrompt, LOCAL_TIMEOUT_MS, type DimKey } from "./interviewConfig";

export interface InterviewerResult {
  score: number;          // -2 to 2
  confidence: number;     // 0 to 1
  followUpNeeded: boolean;
  source: "local" | "cloud"; // which model actually responded
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
  const systemPrompt = buildInterviewerPrompt(dim, questionText, sectorNote);

  const model = process.env.INTERVIEW_LOCAL_MODEL ?? process.env.OLLAMA_MODEL ?? "llama3:8b";

  let result: { content: string; source: "local" | "cloud" };
  try {
    const meta = await Promise.race([
      chatCompleteWithMeta({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userAnswer },
        ],
        maxTokens: 120,
        temperature: 0.2,
        jsonMode: true,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Interviewer timeout")), LOCAL_TIMEOUT_MS)
      ),
    ]);
    result = { content: meta.content, source: meta.source };
  } catch (err) {
    console.warn("[runInterviewer] failed, returning neutral:", err);
    return { score: 0, confidence: 0.4, followUpNeeded: true, source: "local" };
  }

  try {
    const parsed = safeJsonParse<{
      score?: number;
      confidence?: number;
      followUpNeeded?: boolean;
    }>(result.content);

    return {
      score: clampScore(parsed.score ?? 0),
      confidence: clampConf(parsed.confidence ?? 0.5),
      followUpNeeded: parsed.followUpNeeded ?? (clampConf(parsed.confidence ?? 0.5) < 0.55),
      source: result.source,
    };
  } catch {
    // Non-JSON response from local model — return neutral, mark as needing follow-up
    return { score: 0, confidence: 0.3, followUpNeeded: true, source: result.source };
  }
}
