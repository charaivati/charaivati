// lib/listener/actions.ts
//
// PRIV-ACT-1: deterministic action flows for the Listener (/api/listen).
// On a FRIEND_TRIGGERS / REMIND_TRIGGERS match, /api/listen does NOT call the
// conversational model — it calls one jsonMode extraction here (name/location
// or recipient/reminder-text), then builds a deterministic `action` payload
// from DB lookups. Confirmation (the actual write) happens in dedicated routes
// under app/api/listen/actions/* — never as a raw model side effect.
import { db } from "@/lib/db";
import { chatComplete, safeJsonParse } from "@/app/api/aiClient";
import { searchUsers } from "@/lib/users/searchUsers";
import type { FriendCandidate, ListenAction } from "@/lib/listener/actionTypes";

export type { FriendCandidate, ListenAction } from "@/lib/listener/actionTypes";

// ── Extraction (jsonMode, local-first) ───────────────────────────────────────

export async function extractFriendQuery(
  text: string,
  model: string
): Promise<{ name: string | null; location: string | null }> {
  try {
    const reply = await chatComplete({
      model,
      messages: [
        {
          role: "system",
          content:
            "Extract the person's name and (optional) location/city the user wants to add as a friend or search for. " +
            'Reply ONLY with JSON: {"name": string|null, "location": string|null}. ' +
            "If no name is mentioned, set name to null.",
        },
        { role: "user", content: text },
      ],
      jsonMode: true,
      maxTokens: 100,
      temperature: 0,
    });
    const parsed = safeJsonParse<{ name?: string | null; location?: string | null }>(reply);
    return {
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : null,
      location: typeof parsed.location === "string" && parsed.location.trim() ? parsed.location.trim() : null,
    };
  } catch (err) {
    console.error("[listener/actions] extractFriendQuery failed:", err);
    return { name: null, location: null };
  }
}

export async function extractReminderQuery(
  text: string,
  model: string
): Promise<{ recipientName: string | null; reminderText: string | null }> {
  try {
    const reply = await chatComplete({
      model,
      messages: [
        {
          role: "system",
          content:
            "Extract who the user wants to send a reminder to, and the reminder message itself. " +
            'Reply ONLY with JSON: {"recipientName": string|null, "reminderText": string|null}. ' +
            "reminderText should be the short message to deliver, written from the sender's perspective " +
            '(e.g. "Don\'t forget our meeting tomorrow"). If either is missing, set it to null.',
        },
        { role: "user", content: text },
      ],
      jsonMode: true,
      maxTokens: 150,
      temperature: 0,
    });
    const parsed = safeJsonParse<{ recipientName?: string | null; reminderText?: string | null }>(reply);
    return {
      recipientName:
        typeof parsed.recipientName === "string" && parsed.recipientName.trim() ? parsed.recipientName.trim() : null,
      reminderText:
        typeof parsed.reminderText === "string" && parsed.reminderText.trim() ? parsed.reminderText.trim() : null,
    };
  } catch (err) {
    console.error("[listener/actions] extractReminderQuery failed:", err);
    return { recipientName: null, reminderText: null };
  }
}

// ── Friend search action ─────────────────────────────────────────────────────

export async function buildFriendSearchAction(
  userId: string,
  query: { name: string; location: string | null }
): Promise<ListenAction> {
  const results = await searchUsers({ q: query.name, location: query.location, excludeUserId: userId });

  if (results.length === 0) {
    return { type: "friend_search_empty", query };
  }

  const ids = results.map((r) => r.id);
  const [friendships, outgoing, incoming] = await Promise.all([
    db.friendship.findMany({
      where: {
        OR: [
          { userAId: userId, userBId: { in: ids } },
          { userBId: userId, userAId: { in: ids } },
        ],
      },
    }),
    db.friendRequest.findMany({
      where: { senderId: userId, receiverId: { in: ids }, status: "pending" },
    }),
    db.friendRequest.findMany({
      where: { receiverId: userId, senderId: { in: ids }, status: "pending" },
    }),
  ]);

  const friendIds = new Set(friendships.map((f) => (f.userAId === userId ? f.userBId : f.userAId)));
  const outgoingIds = new Set(outgoing.map((r) => r.receiverId));
  const incomingIds = new Set(incoming.map((r) => r.senderId));

  const candidates: FriendCandidate[] = results.map((r) => ({
    ...r,
    relationship: friendIds.has(r.id)
      ? "friends"
      : outgoingIds.has(r.id)
        ? "outgoing"
        : incomingIds.has(r.id)
          ? "incoming"
          : "none",
  }));

  return { type: "friend_search", query, results: candidates };
}

// ── Reminder action ───────────────────────────────────────────────────────────

const REMINDER_MAX_LEN = 140;

export function clampReminderText(text: string): string {
  return text.slice(0, REMINDER_MAX_LEN);
}

export async function buildReminderAction(
  userId: string,
  recipientName: string,
  reminderText: string
): Promise<ListenAction> {
  const text = clampReminderText(reminderText);

  const friendships = await db.friendship.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    include: {
      userA: { select: { id: true, name: true, avatarUrl: true } },
      userB: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  const friends = friendships.map((f) => (f.userAId === userId ? f.userB : f.userA));
  const lowerName = recipientName.toLowerCase();
  const friendMatches = friends.filter((f) => (f.name ?? "").toLowerCase().includes(lowerName));

  if (friendMatches.length === 1) {
    const f = friendMatches[0];
    return { type: "reminder_confirm", recipient: { id: f.id, name: f.name, avatarUrl: f.avatarUrl }, text };
  }

  if (friendMatches.length > 1) {
    return {
      type: "reminder_pick",
      candidates: friendMatches.map((f) => ({ id: f.id, name: f.name, avatarUrl: f.avatarUrl })),
      text,
    };
  }

  // No friend matches — see if this is someone on the platform who isn't a friend yet.
  const nonFriendResults = await searchUsers({ q: recipientName, excludeUserId: userId, limit: 1 });
  if (nonFriendResults.length > 0) {
    const c = nonFriendResults[0];
    return {
      type: "reminder_non_friend",
      candidate: { id: c.id, name: c.name, avatarUrl: c.avatarUrl, location: c.location },
      text,
    };
  }

  return { type: "reminder_not_found", name: recipientName };
}

// ── Reply text for each action (no model generation needed) ───────────────────

export function describeFriendSearchReply(action: ListenAction): string {
  switch (action.type) {
    case "friend_search":
      return `I found ${action.results.length === 1 ? "someone" : "a few people"} matching "${action.query.name}" — take a look below and let me know if one of them is your friend.`;
    case "friend_search_empty":
      return `I couldn't find anyone matching "${action.query.name}"${
        action.query.location ? ` in ${action.query.location}` : ""
      }. They might not be on Charaivati yet, or they've turned off search visibility.`;
    default:
      return "";
  }
}

export function describeReminderReply(action: ListenAction): string {
  switch (action.type) {
    case "reminder_confirm":
      return `Got it — want me to send this reminder to ${action.recipient.name ?? "them"}?`;
    case "reminder_pick":
      return `I found a few friends matching that name — which one did you mean?`;
    case "reminder_non_friend":
      return `${action.candidate.name ?? "That person"} is on Charaivati but isn't your friend yet, so I can't send them a reminder directly. Want to send a friend request first?`;
    case "reminder_not_found":
      return `I couldn't find "${action.name}" among your friends or on Charaivati. Could you double-check the name?`;
    default:
      return "";
  }
}
