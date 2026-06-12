// Admin bridge for the Listener (PERSONA-1) — admin recognition, teaching-mode
// distillation, and the anonymized admin-question queue.
//
// HARD RULES (mirrors the Listener's own doctrine):
//  - PhilosophyPersona writes happen ONLY in deterministic code here, triggered
//    by an explicit admin command AFTER a confirmation card is accepted — never
//    as a side effect of model output alone.
//  - AdminQuestion rows store NO userId — anonymized by design.
//  - Personas are TONE LENSES, not characters: capture the way of thinking, never
//    name the teacher, thinkers may be referenced by name but never quoted.
//  - (db as any) — both models post-date the last full `prisma generate`.

import { db } from "@/lib/db";
import { chatComplete, safeJsonParse } from "@/app/api/aiClient";
import { checkRateLimit } from "@/lib/rateLimit";

const CHAT_MODEL = process.env.CHAT_AI_MODEL ?? "llama3:8b";

export interface DistilledPersona {
  name: string;
  displayName: string;
  body: string;
  triggers: string[];
  attribution?: string | null;
}

const DISTILL_RULES = `Distillation rules — read carefully:
- Capture the WAY OF THINKING being described (how this person reasons about decisions, risk, people, money, time), not the person themselves.
- NEVER name or identify the teacher/admin. If they reference a thinker, philosophy, or tradition by name, that name MAY appear in "attribution" only (e.g. "informed by stoic thinking") — never as a direct quote, and never in "body".
- The core truths/values of the assistant stay constant. This is a TONE AND LENS adjustment, not a different character or a new set of beliefs.
- "body" must be wrapped as [SECTION: <name>]...[/SECTION] and stay under ~200 tokens — a few short paragraphs of guidance on HOW to reason and respond when this lens is active.
- "name" is a short lowercase_snake_case identifier (e.g. "business", "spiritual", "money_pragmatism").
- "displayName" is a short human label (e.g. "Business pragmatism").
- "triggers" is 3-8 lowercase keywords/phrases that would later route a user's message toward this lens (e.g. ["startup","pricing","negotiation","cash flow"]).
Return ONLY this JSON shape:
{"name":"...","displayName":"...","body":"[SECTION: ...]\\n...\\n[/SECTION]","triggers":["..."],"attribution":"..." or null}`;

/** Returns the resolved admin email, or null if not configured. */
function adminEmail(): string | null {
  return process.env.ADMIN_EMAIL ?? process.env.ADMIN_ALERT_EMAIL ?? null;
}

/** Mirrors /admin/security and /api/admin/verify's admin check. */
export async function isAdminUser(userId: string): Promise<boolean> {
  const email = adminEmail();
  if (!email) return false;
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } }).catch(() => null);
  return !!user?.email && user.email.toLowerCase() === email.toLowerCase();
}

/** First distillation pass — from a fresh conversation excerpt + the admin's save instruction. */
export async function distillPersona(conversationText: string, instruction: string): Promise<DistilledPersona | null> {
  return runDistillation(
    `Recent conversation with the admin/teacher:\n${conversationText}\n\nThe admin just said: "${instruction}"\n\nDistill the philosophy/lens being described above into a persona.\n\n${DISTILL_RULES}`
  );
}

/** Revision pass — re-runs distillation against an existing persona body + an instruction. */
export async function revisePersona(existing: { name: string; displayName: string; body: string; triggers: string[]; attribution?: string | null }, instruction: string): Promise<DistilledPersona | null> {
  const result = await runDistillation(
    `Existing persona:\n${JSON.stringify(existing)}\n\nThe admin wants this revised: "${instruction}"\n\nProduce a revised version of the SAME persona (keep "name" identical unless the admin explicitly asks for a rename).\n\n${DISTILL_RULES}`
  );
  if (result && !instruction.toLowerCase().includes("rename")) {
    result.name = existing.name;
  }
  return result;
}

/** Answer-to-persona pass — folds an admin's answer to a queued question into a persona update. */
export async function distillAnswer(question: string, answer: string, existing?: { name: string; displayName: string; body: string; triggers: string[]; attribution?: string | null } | null): Promise<DistilledPersona | null> {
  const context = existing
    ? `Existing persona to extend:\n${JSON.stringify(existing)}\n\nFold the admin's answer below into it — extend "body" with this guidance, keep "name" and "displayName" the same unless it no longer fits.`
    : `There is no existing persona for this topic yet — create one.`;
  return runDistillation(
    `A user asked: "${question}"\nThe admin answered: "${answer}"\n\n${context}\n\n${DISTILL_RULES}`
  );
}

async function runDistillation(userContent: string): Promise<DistilledPersona | null> {
  try {
    const raw = await chatComplete({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: "Respond ONLY with valid JSON, no markdown, no explanation." },
        { role: "user", content: userContent },
      ],
      maxTokens: 500,
      temperature: 0.3,
      jsonMode: true,
    });
    const parsed = safeJsonParse<Record<string, unknown>>(raw);
    if (!parsed) return null;
    const name = typeof parsed.name === "string" ? parsed.name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_") : "";
    const displayName = typeof parsed.displayName === "string" ? parsed.displayName.trim() : "";
    const body = typeof parsed.body === "string" ? parsed.body.trim() : "";
    if (!name || !displayName || !body) return null;
    const triggers = Array.isArray(parsed.triggers) ? parsed.triggers.filter((t): t is string => typeof t === "string").map((t) => t.toLowerCase().trim()).filter(Boolean) : [];
    const attribution = typeof parsed.attribution === "string" && parsed.attribution.trim() ? parsed.attribution.trim() : null;
    return { name, displayName, body, triggers, attribution };
  } catch (err) {
    console.error("[adminBridge] distillation failed:", err);
    return null;
  }
}

// ── Anonymized admin-question queue ──────────────────────────────────────────

/** Simple scrubbing pass — strips obvious PII before a question is queued. */
export function anonymizeQuestion(message: string): string {
  return message
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\b\d{10,}\b/g, "[number]")
    .replace(/\bmy name is\s+\S+/gi, "my name is [name]")
    .replace(/\bi('m| am)\s+([A-Z][a-z]+)\b/g, "i'm [name]")
    .trim();
}

/**
 * Files an anonymized AdminQuestion when a non-admin session hits a
 * knowledge-gap. Rate-capped per user (~1 per 30 min, an approximation of
 * "max 1 per session per 10 messages" — see TECH_DEBT.md).
 */
export async function fileAdminQuestion(userId: string, question: string, topic?: string | null): Promise<void> {
  const limit = await checkRateLimit(`listen:adminq:${userId}`, 1, 1800);
  if (!limit.ok) return;
  try {
    await (db as any).adminQuestion.create({
      data: {
        source: "user_question",
        question: anonymizeQuestion(question),
        topic: topic ?? null,
      },
    });
  } catch (err) {
    console.error("[adminBridge] failed to file admin question:", err);
  }
}

export interface OpenAdminQuestion {
  id: string;
  question: string;
  topic: string | null;
}

export async function getOpenAdminQuestions(limit = 3): Promise<OpenAdminQuestion[]> {
  try {
    const rows = await (db as any).adminQuestion.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: { id: true, question: true, topic: true },
    });
    return rows ?? [];
  } catch (err) {
    console.error("[adminBridge] failed to load open admin questions:", err);
    return [];
  }
}

// ── Admin command handling ───────────────────────────────────────────────────

export interface AdminCommandResult {
  reply: string;
  personaProposal?: DistilledPersona & { questionId?: string };
}

import {
  isTeachSaveCommand,
  isTeachListCommand,
  parseActivateCommand,
  parseReviseCommand,
  isSkipQuestionCommand,
  parseAnswerQuestionCommand,
} from "@/lib/ai/teachTrigger";

/**
 * Intercepts deterministic admin commands BEFORE the conversational model call.
 * Returns null if `message` isn't a recognized admin command — the route then
 * proceeds with the normal (admin-mode) conversational completion.
 */
export async function handleAdminCommand(message: string, conversationText: string): Promise<AdminCommandResult | null> {
  const trimmed = message.trim();
  if (!trimmed) return null;

  // "save this as <...> philosophy" / "add this to the spiritual lens" etc.
  if (isTeachSaveCommand(trimmed)) {
    const distilled = await distillPersona(conversationText, trimmed);
    if (!distilled) {
      return { reply: "I tried to distill that into a lens but couldn't make sense of it yet — could you say a bit more about how you'd apply that thinking?" };
    }
    return {
      reply: `Here's what I distilled — take a look and let me know if you'd like to save it as a draft lens.`,
      personaProposal: distilled,
    };
  }

  // "show draft personas" / "list personas"
  if (isTeachListCommand(trimmed)) {
    try {
      const rows = await (db as any).philosophyPersona.findMany({
        orderBy: { updatedAt: "desc" },
        select: { name: true, displayName: true, status: true },
      });
      if (!rows || rows.length === 0) {
        return { reply: "There are no philosophy lenses yet — teach me one by saying something like \"save this as business philosophy\"." };
      }
      const lines = rows.map((r: { name: string; displayName: string; status: string }) => `- ${r.displayName} (${r.name}) — ${r.status}`);
      return { reply: `Here's what's been taught so far:\n${lines.join("\n")}` };
    } catch (err) {
      console.error("[adminBridge] list personas failed:", err);
      return { reply: "I couldn't load the persona list just now." };
    }
  }

  // "activate business persona"
  const activateName = parseActivateCommand(trimmed);
  if (activateName) {
    try {
      const existing = await (db as any).philosophyPersona.findUnique({ where: { name: activateName } });
      if (!existing) {
        return { reply: `I don't have a draft called "${activateName}" yet — say "show draft personas" to see what's there.` };
      }
      await (db as any).philosophyPersona.update({ where: { name: activateName }, data: { status: "active" } });
      return { reply: `Activated "${existing.displayName}". It's now part of the active set of lenses.` };
    } catch (err) {
      console.error("[adminBridge] activate persona failed:", err);
      return { reply: "I couldn't activate that just now." };
    }
  }

  // "revise it: <instruction>" / "revise business: <instruction>"
  const revise = parseReviseCommand(trimmed);
  if (revise) {
    try {
      let existing;
      if (revise.name) {
        existing = await (db as any).philosophyPersona.findUnique({ where: { name: revise.name } });
      } else {
        existing = await (db as any).philosophyPersona.findFirst({ orderBy: { updatedAt: "desc" } });
      }
      if (!existing) {
        return { reply: "I don't have a persona to revise yet — teach me one first." };
      }
      const distilled = await revisePersona(existing, revise.instruction);
      if (!distilled) {
        return { reply: "I couldn't work out a revision from that — could you rephrase what you'd like changed?" };
      }
      return {
        reply: `Here's the revised version of "${existing.displayName}" — take a look.`,
        personaProposal: distilled,
      };
    } catch (err) {
      console.error("[adminBridge] revise persona failed:", err);
      return { reply: "I couldn't revise that just now." };
    }
  }

  // "answer question 2: <answer>"
  const answerCmd = parseAnswerQuestionCommand(trimmed);
  if (answerCmd) {
    try {
      const open = await getOpenAdminQuestions(10);
      const target = open[answerCmd.index - 1];
      if (!target) {
        return { reply: `I don't see a question #${answerCmd.index} in the open queue.` };
      }
      const existing = target.topic
        ? await (db as any).philosophyPersona.findFirst({ where: { triggers: { has: target.topic } } }).catch(() => null)
        : null;
      const distilled = await distillAnswer(target.question, answerCmd.answer, existing);
      if (!distilled) {
        return { reply: "I couldn't distill that answer into a lens yet — could you say a little more?" };
      }
      return {
        reply: `Here's how I'd fold that into our lenses — take a look.`,
        personaProposal: { ...distilled, questionId: target.id },
      };
    } catch (err) {
      console.error("[adminBridge] answer question failed:", err);
      return { reply: "I couldn't process that answer just now." };
    }
  }

  // "skip that question" — dismisses the oldest open question.
  if (isSkipQuestionCommand(trimmed)) {
    try {
      const open = await getOpenAdminQuestions(1);
      if (open.length === 0) {
        return { reply: "There's nothing in the question queue right now." };
      }
      await (db as any).adminQuestion.update({ where: { id: open[0].id }, data: { status: "dismissed" } });
      return { reply: "Okay, skipped that one." };
    } catch (err) {
      console.error("[adminBridge] skip question failed:", err);
      return { reply: "I couldn't skip that just now." };
    }
  }

  return null;
}
