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
import { searchUsers, SEARCH_MAX_RESULTS } from "@/lib/users/searchUsers";
import { scanInput } from "@/lib/ai/guardRail";
import { checkRateLimit } from "@/lib/rateLimit";
import { createNotification } from "@/lib/notifications/createNotification";
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

export async function extractUnfriendQuery(text: string, model: string): Promise<{ name: string | null }> {
  try {
    const reply = await chatComplete({
      model,
      messages: [
        {
          role: "system",
          content:
            "Extract the name of the friend the user wants to remove/unfriend. " +
            'Reply ONLY with JSON: {"name": string|null}. If no name is mentioned, set name to null.',
        },
        { role: "user", content: text },
      ],
      jsonMode: true,
      maxTokens: 60,
      temperature: 0,
    });
    const parsed = safeJsonParse<{ name?: string | null }>(reply);
    return {
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : null,
    };
  } catch (err) {
    console.error("[listener/actions] extractUnfriendQuery failed:", err);
    return { name: null };
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
    relationship: r.id === userId
      ? "self"
      : friendIds.has(r.id)
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

// ACTION-INTENT-5b: shared send path. Used both by the direct send-and-report
// flow in /api/listen (no confirm card for the single-friend-match case) and
// by the existing confirm route (app/api/listen/actions/reminder) for the
// reminder_pick / reminder_non_friend cards, which still confirm explicitly.
// Extracted unchanged from the original confirm-route logic — same friendship
// check, scanInput BLOCK check, day + per-recipient rate limits, and
// ACTION-INTENT-5a doctrine (createNotification's real boolean result gates
// the "sent" reply, never assumed).
const REMINDERS_PER_DAY = 5;
const REMINDERS_PER_RECIPIENT_PER_HOUR = 1;

export async function sendReminder(
  senderId: string,
  recipientUserId: string,
  rawText: string
): Promise<{ ok: boolean; error?: "not_friends" | "blocked" | "rate_limited_day" | "rate_limited_recipient" | "delivery_failed"; message?: string }> {
  if (recipientUserId === senderId) {
    return { ok: false, error: "blocked", message: "Cannot send a reminder to yourself." };
  }

  const text = clampReminderText(rawText);

  const friendship = await db.friendship.findFirst({
    where: {
      OR: [
        { userAId: senderId, userBId: recipientUserId },
        { userAId: recipientUserId, userBId: senderId },
      ],
    },
  });
  if (!friendship) {
    return { ok: false, error: "not_friends", message: "You can only send reminders to friends." };
  }

  const scan = scanInput(text);
  if (scan.level === "BLOCK") {
    return { ok: false, error: "blocked", message: "That reminder can't be sent — try rephrasing it." };
  }

  const dayLimit = await checkRateLimit(`listen:reminder:day:${senderId}`, REMINDERS_PER_DAY, 86400);
  if (!dayLimit.ok) {
    return { ok: false, error: "rate_limited_day", message: "You've sent enough reminders for today." };
  }

  const recipientLimit = await checkRateLimit(
    `listen:reminder:recipient:${senderId}:${recipientUserId}`,
    REMINDERS_PER_RECIPIENT_PER_HOUR,
    3600
  );
  if (!recipientLimit.ok) {
    return { ok: false, error: "rate_limited_recipient", message: "You already sent this person a reminder recently." };
  }

  const sender = await db.user.findUnique({ where: { id: senderId }, select: { name: true } });

  const delivered = await createNotification({
    userId: recipientUserId,
    type: "friend_reminder",
    title: `Reminder from ${sender?.name ?? "a friend"}`,
    body: text,
  });

  if (!delivered) {
    return { ok: false, error: "delivery_failed", message: "Couldn't send that reminder — please try again." };
  }

  return { ok: true };
}

// ── Unfriend action (UNFRIEND-1) ─────────────────────────────────────────────
// Resolves against the user's ACCEPTED friends only — never a general user
// search. The actual removal happens only after a confirm-card click, via
// the existing POST /api/friends/remove (UNFRIEND-1 audit: reused, not new).

export async function buildUnfriendAction(userId: string, name: string): Promise<ListenAction> {
  const friendships = await db.friendship.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    include: {
      userA: { select: { id: true, name: true, avatarUrl: true } },
      userB: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  const friends = friendships.map((f) => (f.userAId === userId ? f.userB : f.userA));
  const lowerName = name.toLowerCase();
  const matches = friends.filter((f) => (f.name ?? "").toLowerCase().includes(lowerName));

  if (matches.length === 1) {
    const f = matches[0];
    return { type: "unfriend_confirm", friend: { id: f.id, name: f.name, avatarUrl: f.avatarUrl } };
  }

  if (matches.length > 1) {
    return {
      type: "unfriend_pick",
      candidates: matches.map((f) => ({ id: f.id, name: f.name, avatarUrl: f.avatarUrl })),
    };
  }

  return { type: "unfriend_not_found", name };
}

export function describeUnfriendReply(action: ListenAction): string {
  switch (action.type) {
    case "unfriend_confirm":
      return `Are you sure you want to remove ${action.friend.name ?? "them"} from your friends?`;
    case "unfriend_pick":
      return `I found a few friends matching that name — which one did you mean?`;
    case "unfriend_not_found":
      return `You're not friends with anyone by that name.`;
    default:
      return "";
  }
}

// ── Block action (ACTION-INTENT-6) ──────────────────────────────────────────
// Unlike unfriend, a block can target someone who is NOT a friend — so
// resolution checks friends first (most likely intent — "block <friend>"),
// then falls back to a platform-wide searchUsers() lookup. Still confirm-gated
// (destructive). The actual write happens via POST /api/users/block.

export async function extractBlockQuery(text: string, model: string): Promise<{ name: string | null }> {
  try {
    const reply = await chatComplete({
      model,
      messages: [
        {
          role: "system",
          content:
            "Extract the name of the person the user wants to block. " +
            'Reply ONLY with JSON: {"name": string|null}. If no name is mentioned, set name to null.',
        },
        { role: "user", content: text },
      ],
      jsonMode: true,
      maxTokens: 60,
      temperature: 0,
    });
    const parsed = safeJsonParse<{ name?: string | null }>(reply);
    return {
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : null,
    };
  } catch (err) {
    console.error("[listener/actions] extractBlockQuery failed:", err);
    return { name: null };
  }
}

export async function buildBlockAction(userId: string, name: string): Promise<ListenAction> {
  const friendships = await db.friendship.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    include: {
      userA: { select: { id: true, name: true, avatarUrl: true } },
      userB: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  const friends = friendships.map((f) => (f.userAId === userId ? f.userB : f.userA));
  const lowerName = name.toLowerCase();
  const friendMatches = friends.filter((f) => (f.name ?? "").toLowerCase().includes(lowerName));

  if (friendMatches.length === 1) {
    const f = friendMatches[0];
    return { type: "block_confirm", target: { id: f.id, name: f.name, avatarUrl: f.avatarUrl } };
  }

  if (friendMatches.length > 1) {
    return {
      type: "block_pick",
      candidates: friendMatches.map((f) => ({ id: f.id, name: f.name, avatarUrl: f.avatarUrl })),
    };
  }

  // Not a friend — block can still target anyone discoverable on the platform.
  const results = await searchUsers({ q: name, excludeUserId: userId, limit: SEARCH_MAX_RESULTS });

  if (results.length === 1) {
    const r = results[0];
    return { type: "block_confirm", target: { id: r.id, name: r.name, avatarUrl: r.avatarUrl } };
  }

  if (results.length > 1) {
    return {
      type: "block_pick",
      candidates: results.map((r) => ({ id: r.id, name: r.name, avatarUrl: r.avatarUrl })),
    };
  }

  return { type: "block_not_found", name };
}

export function describeBlockReply(action: ListenAction): string {
  switch (action.type) {
    case "block_confirm":
      return `Are you sure you want to block ${action.target.name ?? "them"}? They won't be able to find you, friend you, or contact you, and any existing friendship will be removed.`;
    case "block_pick":
      return `I found a few people matching that name — which one did you mean?`;
    case "block_not_found":
      return `I couldn't find anyone matching that name.`;
    default:
      return "";
  }
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

// ── Pending friend requests (FRIEND-NOTIFY-1) ───────────────────────────────
// Minimal public fields only (id, name, avatarUrl, location) — same shape as
// searchUsers(). Never email/phone.

export interface PendingFriendRequest {
  id: string;
  createdAt: Date;
  sender: { id: string; name: string | null; avatarUrl: string | null; location: string | null };
}

export async function getPendingFriendRequests(userId: string, limit = 5): Promise<PendingFriendRequest[]> {
  const requests = await db.friendRequest.findMany({
    where: { receiverId: userId, status: "pending" },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      sender: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          addresses: { where: { isDefault: true }, select: { city: true, state: true }, take: 1 },
        },
      },
    },
  });

  return requests.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    sender: {
      id: r.sender.id,
      name: r.sender.name,
      avatarUrl: r.sender.avatarUrl,
      location: r.sender.addresses[0]
        ? [r.sender.addresses[0].city, r.sender.addresses[0].state].filter(Boolean).join(", ") || null
        : null,
    },
  }));
}

// ── Logout / clear-chat actions (ACTION-INTENT-3) ───────────────────────────
// Strict-keyword-only, confirm-gated, no model call. The confirm cards POST
// to dedicated routes — never a raw model side effect.

export function describeLogoutReply(): string {
  return "Want me to sign you out?";
}

export function describeClearChatReply(): string {
  return "Want to clear this chat and start fresh? Your past conversation stays saved — this just clears what's on screen.";
}

// LOGIN-IN-CHAT-1: a guest asked to log in. Sign-in happens fully in-chat —
// surface the card right here rather than declining or pointing elsewhere.
export function describeLoginOfferReply(): string {
  return "I can sign you in right here — just tap below to log in or secure this account.";
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

// ACTION-INTENT-5b: send-and-report doctrine (friendly, low-stakes reminders —
// distinct from unfriend/block, which keep confirm cards).

export function describeReminderSentReply(recipientName: string | null, text: string): string {
  return `Sent "${text}" to ${recipientName ?? "them"}.`;
}

export function describeReminderAskTextReply(recipientName: string | null): string {
  return `What should I remind ${recipientName ?? "them"}?`;
}

export function describeReminderFailedReply(message?: string): string {
  return message ?? "Something went wrong sending that reminder — try again?";
}

export function describeReminderCancelledReply(): string {
  return "No worries — let me know if you'd like to send a reminder later.";
}
