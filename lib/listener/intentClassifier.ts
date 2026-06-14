// lib/listener/intentClassifier.ts
//
// ACTION-INTENT-3: a second-tier intent layer for the Listener. The
// FRIEND_TRIGGERS/REMIND_TRIGGERS/UNFRIEND_TRIGGERS/LOGOUT_TRIGGERS/
// CLEAR_CHAT_TRIGGERS substring checks in lib/ai/actionTrigger.ts run first
// and are cheap. Only when ALL of those miss AND the message "looks action
// shaped" do we spend one extra chatComplete jsonMode call to classify intent
// more flexibly (e.g. "can you remove him from my friends list" without the
// exact word "unfriend", or pronoun-based follow-ups like "yes do that").
//
// classifyIntent's output for add_friend / remove_friend / send_reminder
// feeds the SAME existing builders (buildFriendSearchAction /
// buildUnfriendAction / buildReminderAction) — no parallel write paths.
// logout / clear_chat are STRICT-KEYWORD-ONLY by CAPABILITIES doctrine and
// are never acted on directly from classifier output (see route wiring).
import { chatComplete, safeJsonParse } from "@/app/api/aiClient";

export type ClassifiedIntent =
  | "add_friend"
  | "remove_friend"
  | "send_reminder"
  | "block_user"
  | "logout"
  | "clear_chat"
  | "show_map"
  | "accept_friend_request"
  | "chat"
  | "unknown_capability";

const ACTION_WORDS = [
  "friend",
  "remind",
  "reminder",
  "logout",
  "log out",
  "sign out",
  "clear",
  "reset",
  "start over",
  "unfriend",
  "remove",
  "delete",
  "add",
  "send",
  "show",
  "open",
  "map",
  "accept",
  // FIX-UNKNOWN-CAP-1: common shapes of out-of-scope action requests, so they
  // reach classifyIntent (which can return unknown_capability) instead of
  // falling straight to the conversational model. The post-reply
  // isCapabilityDeclineReply backstop in /api/listen catches anything still
  // missed here.
  "book",
  "order",
  "schedule",
  "calendar",
  "weather",
  "call me",
  "navigate",
  "pay",
  "transfer money",
  "play",
  // ACTION-INTENT-6: block phrasing — "block X" is also covered by
  // BLOCK_TRIGGERS in actionTrigger.ts, but looser phrasings like "I don't
  // want X to contact me" rely on this pre-filter + the classifier below.
  "block",
  "don't want",
  "contact me",
  "harass",
];

/**
 * Cheap pre-filter: does this message even plausibly describe an action the
 * Listener could take? If not, skip the classifier call entirely — most
 * turns are ordinary conversation and should never reach this.
 */
export function looksActionShaped(text: string): boolean {
  const lower = text.toLowerCase();
  return ACTION_WORDS.some((w) => lower.includes(w));
}

/**
 * One jsonMode classification call. Fail-safe: any error or malformed JSON
 * resolves to { intent: "chat", params: {} } — i.e. "treat as normal
 * conversation", never "treat as an action by default".
 */
export async function classifyIntent(
  text: string,
  recentContext: string | null,
  model: string
): Promise<{ intent: ClassifiedIntent; params: Record<string, any> }> {
  try {
    const reply = await chatComplete({
      model,
      messages: [
        {
          role: "system",
          content:
            "Classify what the user wants in this message. Reply ONLY with JSON: " +
            '{"intent": "add_friend"|"remove_friend"|"send_reminder"|"block_user"|"logout"|"clear_chat"|"show_map"|"accept_friend_request"|"chat"|"unknown_capability", "params": {}}. ' +
            "Use add_friend when they want to find/add someone as a friend. " +
            "Use remove_friend when they want to remove/unfriend someone (but NOT block them). " +
            "Use send_reminder when they want a reminder sent to a friend. " +
            "Use block_user when they want to block someone, prevent someone from contacting them, or say things like " +
            '"block him", "I don\'t want X to message me anymore", "stop X from contacting me", "I don\'t want to hear from her again". ' +
            "block_user is stronger than remove_friend — if the user wants to cut off ALL contact (not just unfriend), use block_user. " +
            "Use logout when they clearly want to sign out of their account. " +
            "Use clear_chat when they clearly want to clear or reset this conversation. " +
            "Use show_map when they want to see their progress map/overview. " +
            "Use accept_friend_request when they want to accept a pending friend request. " +
            "Use unknown_capability when the user is asking THIS CHAT to perform a real-world action it has no tool for — " +
            'e.g. "book me a cab", "order me food", "add a meeting to my calendar", "what\'s the weather", ' +
            '"pay my bill", "call my mom", "play some music", "translate this for me". ' +
            "These are genuine capability gaps, not friend/reminder/map actions and not casual conversation. " +
            "Use chat for everything else, including small talk, feelings, opinions, and ambiguous messages " +
            '(e.g. "my friend told me a joke", "I\'m feeling tired today" are chat, never unknown_capability). ' +
            "If recent context is given and the message uses a pronoun (him/her/them/that), resolve params using it. " +
            "When in doubt, prefer chat.",
        },
        {
          role: "user",
          content: recentContext
            ? `Recent context: ${recentContext}\n\nMessage: ${text}`
            : `Message: ${text}`,
        },
      ],
      jsonMode: true,
      maxTokens: 100,
      temperature: 0,
    });
    const parsed = safeJsonParse<{ intent?: string; params?: Record<string, any> }>(reply);
    const validIntents: ClassifiedIntent[] = [
      "add_friend",
      "remove_friend",
      "send_reminder",
      "block_user",
      "logout",
      "clear_chat",
      "show_map",
      "accept_friend_request",
      "chat",
      "unknown_capability",
    ];
    const intent = validIntents.includes(parsed.intent as ClassifiedIntent)
      ? (parsed.intent as ClassifiedIntent)
      : "chat";
    return { intent, params: parsed.params && typeof parsed.params === "object" ? parsed.params : {} };
  } catch (err) {
    console.error("[intentClassifier] classifyIntent failed:", err);
    return { intent: "chat", params: {} };
  }
}
