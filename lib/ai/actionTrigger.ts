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
