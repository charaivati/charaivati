// Admin teaching-mode command triggers for the Listener admin bridge (PERSONA-1).
// Mirrors lib/ai/mapTrigger.ts — simple keyword/regex matching, admin-only.
// All matches here are intercepted in app/api/listen/route.ts BEFORE the
// conversational completion call; persona writes happen in deterministic
// route/handler code, never as a side effect of model output alone.

export const TEACH_SAVE_TRIGGERS: string[] = [
  "save this as",
  "save that as",
  "add this to the",
  "add that to the",
  "remember this as",
];

export function isTeachSaveCommand(message: string): boolean {
  const lower = message.toLowerCase();
  return TEACH_SAVE_TRIGGERS.some((t) => lower.includes(t));
}

const TEACH_LIST_PHRASES = new Set([
  "show draft personas",
  "show drafts",
  "list personas",
  "list draft personas",
  "show personas",
]);

export function isTeachListCommand(message: string): boolean {
  return TEACH_LIST_PHRASES.has(message.toLowerCase().trim());
}

/** "activate business persona" / "activate the business lens" -> "business" */
export function parseActivateCommand(message: string): string | null {
  const m = message.toLowerCase().trim().match(/^activate\s+(?:the\s+)?([a-z0-9_\- ]+?)\s*(?:persona|lens)?$/);
  if (!m) return null;
  const name = m[1].trim().replace(/[\s-]+/g, "_");
  return name || null;
}

/** "revise it: be more concise" / "revise business: be more concise" -> { name?, instruction } */
export function parseReviseCommand(message: string): { name?: string; instruction: string } | null {
  const m = message.match(/^revise\s+(it|[a-z0-9_\- ]+)\s*:\s*(.+)$/i);
  if (!m) return null;
  const instruction = m[2].trim();
  if (!instruction) return null;
  const target = m[1].trim().toLowerCase();
  if (target === "it") return { instruction };
  return { name: target.replace(/[\s-]+/g, "_"), instruction };
}

const SKIP_QUESTION_PHRASES = new Set([
  "skip that question",
  "skip this question",
  "skip it",
  "dismiss that question",
]);

export function isSkipQuestionCommand(message: string): boolean {
  return SKIP_QUESTION_PHRASES.has(message.toLowerCase().trim());
}

/** "answer question 2: <answer text>" -> { index (1-based), answer } */
export function parseAnswerQuestionCommand(message: string): { index: number; answer: string } | null {
  const m = message.match(/^answer\s+question\s+(\d+)\s*:\s*(.+)$/i);
  if (!m) return null;
  const answer = m[2].trim();
  if (!answer) return null;
  return { index: parseInt(m[1], 10), answer };
}
