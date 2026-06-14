// lib/ai/actionTrigger.ts
//
// PRIV-ACT-1: server-side intent triggers for the Listener's first chat
// actions (friend request, friend reminder). Mirrors lib/ai/mapTrigger.ts's
// simple substring-matching pattern, but these are checked SERVER-SIDE in
// /api/listen (not client-side) because a match leads to a DB search +
// jsonMode extraction call, not a purely local UI action.
//
// On a match, /api/listen does NOT call the conversational model for that
// turn — it runs a deterministic action flow instead (see lib/listener/actions.ts).

export const FRIEND_TRIGGERS: string[] = [
  "add a friend",
  "add my friend",
  "add as a friend",
  "add as friend",
  "find my friend",
  "find a friend",
  "search for my friend",
  "search for a friend",
  "look for my friend",
  "send a friend request",
  "send him a friend request",
  "send her a friend request",
  "connect me with",
  "i want to add",
  "can you add",
  "can you find my friend",
];

export function isFriendRequest(message: string): boolean {
  const lower = message.toLowerCase();
  return FRIEND_TRIGGERS.some((trigger) => lower.includes(trigger));
}

export const REMIND_TRIGGERS: string[] = [
  "remind my friend",
  "send a reminder to",
  "can you remind",
  "could you remind",
  "set a reminder for",
  "send a reminder",
  "remind a friend",
];

export function isReminderRequest(message: string): boolean {
  const lower = message.toLowerCase();
  return REMIND_TRIGGERS.some((trigger) => lower.includes(trigger));
}

// UNFRIEND-1: deterministic unfriend action — resolves against the user's
// ACCEPTED friends only (never a general user search). Always confirm-gated
// before the destructive POST /api/friends/remove call.
export const UNFRIEND_TRIGGERS: string[] = [
  "unfriend",
  "remove friend",
  "remove my friend",
  "remove him from my friends",
  "remove her from my friends",
  "delete friend",
];

export function isUnfriendRequest(message: string): boolean {
  const lower = message.toLowerCase();
  return UNFRIEND_TRIGGERS.some((trigger) => lower.includes(trigger));
}

// ACTION-INTENT-6: deterministic block action — strict-keyword triggers cover
// the explicit "block X" phrasing; looser phrasings ("I don't want X to
// contact me") are caught by the intent classifier's block_user intent (see
// lib/listener/intentClassifier.ts). Always confirm-gated before the
// destructive POST /api/users/block call.
export const BLOCK_TRIGGERS: string[] = [
  "block",
  "unblock",
];

export function isBlockRequest(message: string): boolean {
  const lower = message.toLowerCase();
  return BLOCK_TRIGGERS.some((trigger) => lower.includes(trigger));
}

// ACTION-INTENT-3: logout — strict-keyword-only by design (CAPABILITIES
// doctrine). Never routed through the intent classifier; a false positive
// here would sign the user out unexpectedly.
export const LOGOUT_TRIGGERS: string[] = [
  "log out",
  "logout",
  "sign out",
  "signout",
  "log me out",
  "sign me out",
];

export function isLogoutRequest(message: string): boolean {
  const lower = message.toLowerCase();
  return LOGOUT_TRIGGERS.some((trigger) => lower.includes(trigger));
}

// TONE-DECLINE-1: login — strict-keyword-only, mirrors the logout/clear-chat
// pattern. A match for a guest user surfaces the SecureChatCard (the real
// sign-in path) instead of a flat "I can't do that" reply. For an already
// signed-in user this falls through to the normal conversational flow, where
// the model declines warmly per [SECTION: CAPABILITIES]'s tone guidance.
export const LOGIN_TRIGGERS: string[] = [
  "log me in",
  "sign me in",
  "log in",
  "sign in",
  "i want to log in",
  "i want to sign in",
  "let me log in",
  "let me sign in",
  "help me log in",
  "help me sign in",
];

export function isLoginRequest(message: string): boolean {
  const lower = message.toLowerCase();
  return LOGIN_TRIGGERS.some((trigger) => lower.includes(trigger));
}

// ACTION-INTENT-3: clear/reset chat — strict-keyword-only, same reasoning as
// logout. Confirm-gated; never deletes ConsultMessage rows (fold-don't-delete).
export const CLEAR_CHAT_TRIGGERS: string[] = [
  "clear chat",
  "clear the chat",
  "clear our chat",
  "clear this chat",
  "reset chat",
  "reset the chat",
  "reset our conversation",
  "start over",
  "start a new chat",
  "start fresh",
  "wipe this chat",
  "wipe the chat",
];

export function isClearChatRequest(message: string): boolean {
  const lower = message.toLowerCase();
  return CLEAR_CHAT_TRIGGERS.some((trigger) => lower.includes(trigger));
}

// ACTION-INTENT-5b: cancel phrases for the one-turn pendingReminder follow-up
// window ("Remind Madhurjya" -> "What should I remind him?" -> "never mind").
export const REMINDER_CANCEL_TRIGGERS: string[] = [
  "never mind",
  "nevermind",
  "nvm",
  "cancel that",
  "cancel it",
  "forget it",
  "forget about it",
  "don't bother",
  "no need",
];

export function isReminderCancel(message: string): boolean {
  const lower = message.toLowerCase();
  return REMINDER_CANCEL_TRIGGERS.some((trigger) => lower.includes(trigger));
}
