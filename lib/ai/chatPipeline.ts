// lib/ai/chatPipeline.ts
// Shared, mode-agnostic machinery for guarded AI chat: auth resolution, input
// guardrail scanning (message + attached document), the timeout wrapper, and the
// guarded completion (LLM call + output scan + tier resolution + fallback).
//
// System-prompt ASSEMBLY does NOT live here — that stays per-route (companion
// branching, persona, context loading). /api/chat (and future callers such as
// /api/listen) import this so guardrail/completion behavior is identical across modes.

import { getTokenFromRequest, verifySessionToken } from "@/lib/session";
import { chatCompleteWithMeta } from "@/app/api/aiClient";
import { getTier, getTierUI } from "@/lib/ai/modelTiers";
import { scanInput, scanOutput } from "@/lib/ai/guardRail";
import { notifyAdmin } from "@/lib/ai/adminNotify";

const CHAT_MODEL = process.env.CHAT_AI_MODEL ?? "llama3:8b";
const CHAT_TIMEOUT_MS = 30_000;

const BLOCKED_INPUT_REPLY =
  "I'm here to help you move forward on your goals. Is there something specific you'd like to work on?";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export function withChatTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`chatComplete timed out after ${CHAT_TIMEOUT_MS}ms`)), CHAT_TIMEOUT_MS)
    ),
  ]);
}

export async function authenticateChat(req: Request) {
  const token = getTokenFromRequest(req);
  return verifySessionToken(token);
}

// ── Input guardrail ──────────────────────────────────────────────────────────
// Scans the user message and any attached document. Fires notifyAdmin for BLOCK
// and WARN. Returns a canned blocked reply when either scan blocks; otherwise
// signals the caller to proceed.
export type InputGuardResult =
  | { blocked: true; reply: { reply: string; blocked: true } }
  | { blocked: false };

export function runInputGuard(params: {
  userId: string;
  message: string;
  attachedDocument?: { name: string; text: string };
  ipAddress: string;
}): InputGuardResult {
  const { userId, message, attachedDocument, ipAddress } = params;

  const inputScan = scanInput(message);
  if (inputScan.level === "BLOCK") {
    notifyAdmin({
      userId,
      eventType: "INPUT_BLOCKED",
      userMessage: message,
      reason: inputScan.reason!,
      matchedPattern: inputScan.matchedPattern!,
      timestamp: new Date().toISOString(),
      ipAddress,
    }).catch(console.error);
    return { blocked: true, reply: { reply: BLOCKED_INPUT_REPLY, blocked: true } };
  }

  if (inputScan.level === "WARN") {
    notifyAdmin({
      userId,
      eventType: "INPUT_WARNED",
      userMessage: message,
      reason: inputScan.reason!,
      matchedPattern: inputScan.matchedPattern!,
      timestamp: new Date().toISOString(),
      ipAddress,
    }).catch(console.error);
  }

  if (attachedDocument?.text) {
    const docScan = scanInput(attachedDocument.text);
    if (docScan.level === "BLOCK") {
      notifyAdmin({
        userId,
        eventType: "INPUT_BLOCKED",
        userMessage: attachedDocument.text,
        reason: docScan.reason!,
        matchedPattern: docScan.matchedPattern!,
        timestamp: new Date().toISOString(),
        ipAddress,
      }).catch(console.error);
      return { blocked: true, reply: { reply: BLOCKED_INPUT_REPLY, blocked: true } };
    }

    if (docScan.level === "WARN") {
      notifyAdmin({
        userId,
        eventType: "INPUT_WARNED",
        userMessage: attachedDocument.text,
        reason: docScan.reason!,
        matchedPattern: docScan.matchedPattern!,
        timestamp: new Date().toISOString(),
        ipAddress,
      }).catch(console.error);
    }
  }

  return { blocked: false };
}

// ── Guarded completion ───────────────────────────────────────────────────────
// Runs the LLM call (with timeout), scans the output, resolves tier metadata.
// Returns the reply + provider metadata on success, or a ready-to-return response
// payload when the output is blocked or all providers fail.
export type GuardedCompletion =
  | {
      type: "ok";
      reply: string;
      source: "local" | "cloud";
      coldStart: boolean;
      usedModel: string;
      tier: ReturnType<typeof getTier>;
      tierUI: ReturnType<typeof getTierUI>;
    }
  | { type: "output_blocked"; response: { reply: string; outputBlocked: true } }
  | { type: "fallback"; response: { reply: string; _fallback: true } };

export async function runGuardedCompletion(params: {
  userId: string;
  message: string;
  ipAddress: string;
  messages: ChatMessage[];
  cloudMessages?: ChatMessage[];
  maxTokens: number;
  temperature: number;
  requestStart: number;
  activeModel: string;
}): Promise<GuardedCompletion> {
  const { userId, message, ipAddress, messages, cloudMessages, maxTokens, temperature, requestStart, activeModel } = params;

  try {
    console.log(`[chat] Calling chatCompleteWithMeta — model=${activeModel} timeout=${CHAT_TIMEOUT_MS}ms`);
    const { content: reply, source, coldStart, model: usedModel } = await withChatTimeout(
      chatCompleteWithMeta({ model: CHAT_MODEL, messages, cloudMessages, maxTokens, temperature })
    );
    console.log(
      `[chat] Reply in ${Date.now() - requestStart}ms (${reply.length} chars) source=${source} coldStart=${coldStart} model=${usedModel}`
    );

    const outputScan = scanOutput(reply);
    if (outputScan.level === "BLOCK") {
      notifyAdmin({
        userId,
        eventType: "OUTPUT_BLOCKED",
        userMessage: message,
        reason: outputScan.reason!,
        matchedPattern: outputScan.matchedPattern!,
        timestamp: new Date().toISOString(),
        ipAddress,
      }).catch(console.error);
      return {
        type: "output_blocked",
        response: { reply: "I ran into an issue generating that response. Try asking something else.", outputBlocked: true },
      };
    }

    return {
      type: "ok",
      reply,
      source,
      coldStart,
      usedModel,
      tier: getTier(usedModel),
      tierUI: getTierUI(usedModel),
    };
  } catch (err) {
    const elapsed = Date.now() - requestStart;
    console.error(`[chat] chatComplete failed after ${elapsed}ms`);
    if (err instanceof Error) {
      console.error(`[chat] Error name: ${err.name}`);
      console.error(`[chat] Error message: ${err.message}`);
      console.error(`[chat] Error stack:`, err.stack);
    } else {
      console.error("[chat] Non-Error thrown:", JSON.stringify(err, null, 2));
    }
    return {
      type: "fallback",
      response: { reply: "I'm having trouble connecting right now. Please try again in a moment.", _fallback: true },
    };
  }
}
