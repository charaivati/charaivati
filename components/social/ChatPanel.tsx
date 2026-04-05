"use client";
// components/social/ChatPanel.tsx — E2E encrypted direct messages
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Lock,
  Send,
  MessageCircle,
  AlertTriangle,
} from "lucide-react";
import {
  getOrCreateKeyPair,
  deriveSharedKey,
  encryptMessage,
  decryptMessage,
  type KeyPair,
} from "@/lib/chat-crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

type Friend = { id: string; name: string; avatarUrl?: string | null };

type ConvItem = {
  id: string;
  friend: Friend;
  lastMessageAt?: string | null;
};

type ActiveConv = { id: string; friend: Friend };

type RawMessage = {
  id: string;
  senderId: string;
  ciphertext: string;
  iv: string;
  createdAt: string;
};

type DecryptedMessage = {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
  failed?: boolean;
};

type CircleUser = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  profile: { displayName: string | null } | null;
};

type CircleMember = { id: string; userId: string; addedAt: string; user: CircleUser };

type Circle = {
  id: string;
  label: string;
  color: string;
  isDefault: boolean;
  members: CircleMember[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avatarLetter(name: string) {
  return (name || "?")[0].toUpperCase();
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return d.toLocaleDateString();
}

function circleMemberName(u: CircleUser): string {
  return u.profile?.displayName ?? u.name ?? "Unknown";
}

const DOT_COLORS: Record<string, string> = {
  amber: "bg-amber-400",
  teal: "bg-teal-400",
  blue: "bg-blue-400",
  rose: "bg-rose-400",
  violet: "bg-violet-400",
};

function sortConvs(convs: ConvItem[]): ConvItem[] {
  return [...convs].sort((a, b) => {
    if (!a.lastMessageAt && !b.lastMessageAt) return 0;
    if (!a.lastMessageAt) return 1;
    if (!b.lastMessageAt) return -1;
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ src, name, size = 8 }: { src?: string | null; name: string; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full object-cover shrink-0`;
  if (src) return <img src={src} alt={name} className={cls} />;
  return (
    <div
      className={`${cls} bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium`}
    >
      {avatarLetter(name)}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChatPanel({ myId }: { myId?: string }) {
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);
  const [keyReady, setKeyReady] = useState(false);
  const [keyError, setKeyError] = useState(false);

  const [convs, setConvs] = useState<ConvItem[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [convsLoading, setConvsLoading] = useState(true);

  // Active chat
  const [active, setActive] = useState<ActiveConv | null>(null);
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [friendKeyMissing, setFriendKeyMissing] = useState(false);
  const [notFriends, setNotFriends] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  // Mobile: true = show list, false = show chat
  const [showList, setShowList] = useState(true);

  // Caches — survive conversation switches
  const sharedKeyCache = useRef<Map<string, CryptoKey>>(new Map());
  const lastSeenCache = useRef<Map<string, string>>(new Map());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeConvIdRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── 1. Init keypair + upload public key ────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const kp = await getOrCreateKeyPair();
        setKeyPair(kp);
        await fetch("/api/keys", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicKey: kp.publicJwk }),
        });
        setKeyReady(true);
      } catch {
        setKeyError(true);
      }
    })();
  }, []);

  // ── 2. Load all data when key is ready ────────────────────────────────────
  useEffect(() => {
    if (!keyReady) return;
    loadAll();
  }, [keyReady]);

  async function loadAll() {
    setConvsLoading(true);
    const [convsRes, friendsRes, circlesRes] = await Promise.all([
      fetch("/api/chat/conversations", { credentials: "include" })
        .then((r) => r.json())
        .catch(() => null),
      fetch("/api/user/friends", { credentials: "include" })
        .then((r) => r.json())
        .catch(() => null),
      fetch("/api/circles", { credentials: "include" })
        .then((r) => r.json())
        .catch(() => null),
    ]);

    if (convsRes?.ok) setConvs(sortConvs(convsRes.conversations ?? []));
    if (friendsRes?.ok) {
      setFriends(
        (friendsRes.friends ?? []).map((f: any) => ({
          id: f.id,
          name: f.displayName ?? f.name ?? f.email ?? "User",
          avatarUrl: f.avatarUrl,
        }))
      );
    }
    if (circlesRes?.ok) setCircles(circlesRes.circles ?? []);
    setConvsLoading(false);
  }

  // ── 3. Open / switch conversation ─────────────────────────────────────────
  async function openConversation(friend: Friend) {
    // If already active, do nothing
    if (active?.friend.id === friend.id) {
      setShowList(false);
      return;
    }

    // Stop poll for previous conv
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    setMessages([]);
    setDraft("");
    setFriendKeyMissing(false);
    setNotFriends(false);
    setShowList(false); // mobile: switch to chat view

    // Get / create conversation
    const res = await fetch("/api/chat/conversations", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendId: friend.id }),
    });
    const d = await res.json().catch(() => null);

    if (!d?.ok) {
      if (res.status === 403) setNotFriends(true);
      setActive({ id: "", friend }); // show the friend name in header even on error
      return;
    }

    const convId: string = d.conversationId;
    activeConvIdRef.current = convId;
    setActive({ id: convId, friend });

    // Add conv to list if not already there
    setConvs((prev) => {
      if (prev.find((c) => c.id === convId)) return prev;
      return sortConvs([...prev, { id: convId, friend }]);
    });

    // Derive shared key (cached per friend)
    if (!keyPair) return;

    let sk = sharedKeyCache.current.get(friend.id);
    if (!sk) {
      try {
        const keyRes = await fetch(`/api/keys?userId=${friend.id}`, {
          credentials: "include",
        });
        const keyData = await keyRes.json().catch(() => null);
        if (!keyData?.ok) {
          setFriendKeyMissing(true);
          return;
        }
        sk = await deriveSharedKey(keyPair.privateJwk, keyData.publicKey);
        sharedKeyCache.current.set(friend.id, sk);
      } catch {
        setFriendKeyMissing(true);
        return;
      }
    }

    const sharedKey = sk;

    // Load initial messages
    setMsgLoading(true);
    await fetchMessages(convId, sharedKey);
    setMsgLoading(false);

    // Poll every 3 s — only if this conv is still active
    pollRef.current = setInterval(() => {
      if (activeConvIdRef.current === convId) {
        fetchMessages(convId, sharedKey);
      }
    }, 3000);
  }

  // ── 4. Fetch + decrypt messages ────────────────────────────────────────────
  const fetchMessages = useCallback(async (convId: string, sk: CryptoKey) => {
    const after = lastSeenCache.current.get(convId);
    const url = after
      ? `/api/chat/conversations/${convId}/messages?after=${encodeURIComponent(after)}`
      : `/api/chat/conversations/${convId}/messages`;

    const res = await fetch(url, { credentials: "include" });
    const d = await res.json().catch(() => null);
    if (!d?.ok || !d.messages?.length) return;

    const newMsgs: DecryptedMessage[] = await Promise.all(
      (d.messages as RawMessage[]).map(async (m) => {
        try {
          const text = await decryptMessage(sk, m.ciphertext, m.iv);
          return { id: m.id, senderId: m.senderId, text, createdAt: m.createdAt };
        } catch {
          return {
            id: m.id,
            senderId: m.senderId,
            text: "[Unable to decrypt]",
            createdAt: m.createdAt,
            failed: true,
          };
        }
      })
    );

    setMessages((prev) => {
      const existing = new Set(prev.map((m) => m.id));
      const toAdd = newMsgs.filter((m) => !existing.has(m.id));
      return toAdd.length ? [...prev, ...toAdd] : prev;
    });

    const latest = d.messages[d.messages.length - 1]?.createdAt;
    if (latest) {
      lastSeenCache.current.set(convId, latest);
      // Update conversation ordering
      setConvs((prev) =>
        sortConvs(
          prev.map((c) => (c.id === convId ? { ...c, lastMessageAt: latest } : c))
        )
      );
    }
  }, []);

  // ── 5. Send a message ──────────────────────────────────────────────────────
  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !active?.id || sending) return;
    const sk = sharedKeyCache.current.get(active.friend.id);
    if (!sk) return;

    setSending(true);
    const text = draft.trim();
    setDraft("");

    try {
      const { ciphertext, iv } = await encryptMessage(sk, text);
      const res = await fetch(`/api/chat/conversations/${active.id}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ciphertext, iv }),
      });
      const d = await res.json().catch(() => null);
      if (d?.ok && d.message) {
        const msg: DecryptedMessage = {
          id: d.message.id,
          senderId: myId ?? d.message.senderId,
          text,
          createdAt: d.message.createdAt,
        };
        setMessages((prev) => [...prev, msg]);
        // Advance cursor so next poll skips this message
        lastSeenCache.current.set(active.id, d.message.createdAt);
        // Move conv to top
        setConvs((prev) =>
          sortConvs(
            prev.map((c) =>
              c.id === active.id ? { ...c, lastMessageAt: d.message.createdAt } : c
            )
          )
        );
      }
    } catch {
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e as any);
    }
  }

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function goBack() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    activeConvIdRef.current = null;
    setShowList(true);
    setActive(null);
    setMessages([]);
    loadAll();
  }

  // ── Error states ───────────────────────────────────────────────────────────
  if (keyError) {
    return (
      <div className="flex items-center gap-3 py-4 text-amber-400 text-sm">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <span>Could not set up encryption. Please refresh and try again.</span>
      </div>
    );
  }

  if (!keyReady) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
        <Lock className="w-4 h-4 animate-pulse" />
        Setting up encryption…
      </div>
    );
  }

  // ── Derived list data ──────────────────────────────────────────────────────
  const convFriendIds = new Set(convs.map((c) => c.friend.id));
  const friendsNoConv = friends.filter((f) => !convFriendIds.has(f.id));
  const hasAnything =
    convs.length > 0 ||
    friends.length > 0 ||
    circles.some((c) => c.members.length > 0);

  // ── Left sidebar (friend + circle list) ───────────────────────────────────
  const sidebarEl = (
    <div className="flex flex-col overflow-y-auto gap-0.5 h-full">
      {convsLoading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
          <MessageCircle className="w-4 h-4 animate-pulse" />
          Loading…
        </div>
      ) : !hasAnything ? (
        <div className="flex flex-col items-center py-8 gap-2">
          <MessageCircle className="w-10 h-10 text-gray-700" />
          <p className="text-gray-500 text-sm text-center">
            No friends yet. Add friends to start chatting.
          </p>
        </div>
      ) : (
        <>
          {/* Conversations sorted by recent activity */}
          {convs.map((c) => (
            <button
              key={c.id}
              onClick={() => openConversation(c.friend)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl border transition-colors text-left ${
                active?.friend.id === c.friend.id
                  ? "bg-indigo-600/20 border-indigo-500/40"
                  : "bg-gray-800/60 border-gray-700/40 hover:bg-gray-700/60"
              }`}
            >
              <Avatar src={c.friend.avatarUrl} name={c.friend.name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{c.friend.name}</p>
                {c.lastMessageAt && (
                  <p className="text-[10px] text-gray-500">{timeLabel(c.lastMessageAt)}</p>
                )}
              </div>
            </button>
          ))}

          {/* Friends without a conversation yet */}
          {friendsNoConv.length > 0 && (
            <>
              {convs.length > 0 && (
                <p className="text-[10px] text-gray-600 uppercase tracking-wider pt-2 pb-0.5 px-1">
                  Friends
                </p>
              )}
              {friendsNoConv.map((f) => (
                <button
                  key={f.id}
                  onClick={() => openConversation(f)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-gray-800/40 border border-gray-700/30 hover:bg-gray-700/50 transition-colors text-left"
                >
                  <Avatar src={f.avatarUrl} name={f.name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">{f.name}</p>
                    <p className="text-[10px] text-gray-600">Start chatting</p>
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Circles */}
          {circles
            .filter((circle) => circle.members.length > 0)
            .map((circle) => (
              <div key={circle.id}>
                <div className="flex items-center gap-1.5 pt-3 pb-0.5 px-1">
                  <div
                    className={`w-2 h-2 rounded-full ${DOT_COLORS[circle.color] ?? "bg-blue-400"}`}
                  />
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider">
                    {circle.label}
                  </p>
                </div>
                {circle.members.map((m) => {
                  const name = circleMemberName(m.user);
                  const friend: Friend = {
                    id: m.userId,
                    name,
                    avatarUrl: m.user.avatarUrl,
                  };
                  return (
                    <button
                      key={m.id}
                      onClick={() => openConversation(friend)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl border transition-colors text-left ${
                        active?.friend.id === m.userId
                          ? "bg-indigo-600/20 border-indigo-500/40"
                          : "bg-gray-800/30 border-gray-700/20 hover:bg-gray-700/40"
                      }`}
                    >
                      <Avatar src={m.user.avatarUrl} name={name} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-200 truncate">{name}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
        </>
      )}
    </div>
  );

  // ── Chat area ──────────────────────────────────────────────────────────────
  const chatEl = active ? (
    <div className="flex flex-col flex-1 min-h-0 min-w-0">
      {/* Header */}
      <div className="flex items-center gap-2.5 pb-3 border-b border-gray-700/40 mb-3 shrink-0">
        <button
          onClick={goBack}
          className="md:hidden p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <Avatar src={active.friend.avatarUrl} name={active.friend.name} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{active.friend.name}</p>
          {!notFriends && !friendKeyMissing && (
            <div className="flex items-center gap-1 text-[10px] text-green-400">
              <Lock className="w-3 h-3" />
              End-to-end encrypted
            </div>
          )}
        </div>
      </div>

      {/* Warnings */}
      {notFriends && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-900/20 border border-amber-700/30 text-amber-400 text-sm mb-3 shrink-0">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          You need to be friends to message this person.
        </div>
      )}
      {friendKeyMissing && !notFriends && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-900/20 border border-amber-700/30 text-amber-400 text-sm mb-3 shrink-0">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Your friend hasn&apos;t set up encryption yet. Ask them to open the Messages tab.
        </div>
      )}

      {/* Messages */}
      {!notFriends && (
        <div className="flex-1 overflow-y-auto space-y-2 mb-3 pr-1 min-h-0">
          {msgLoading && (
            <p className="text-center text-xs text-gray-500 py-4">Loading messages…</p>
          )}
          {!msgLoading && messages.length === 0 && (
            <p className="text-center text-xs text-gray-500 py-8">
              No messages yet. Say hello!
            </p>
          )}
          {messages.map((m) => {
            const isMe = m.senderId === myId;
            return (
              <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-snug ${
                    m.failed
                      ? "bg-red-900/40 text-red-400 border border-red-700/30"
                      : isMe
                      ? "bg-indigo-600 text-white rounded-br-sm"
                      : "bg-gray-700/80 text-gray-100 rounded-bl-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <p
                    className={`text-[10px] mt-0.5 ${isMe ? "text-indigo-200" : "text-gray-500"}`}
                  >
                    {timeLabel(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      {!friendKeyMissing && !notFriends && (
        <form onSubmit={sendMessage} className="flex gap-2 items-end shrink-0">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message… (Enter to send)"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-indigo-500 transition-colors"
            style={{ maxHeight: 120, overflowY: "auto" }}
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      )}
    </div>
  ) : (
    // Desktop placeholder when no conv is selected
    <div className="hidden md:flex flex-1 items-center justify-center text-gray-700">
      <div className="text-center space-y-2">
        <MessageCircle className="w-10 h-10 mx-auto opacity-30" />
        <p className="text-sm">Select a conversation</p>
      </div>
    </div>
  );

  // ── Layout: split-pane on desktop, toggling on mobile ─────────────────────
  return (
    <div className="flex gap-3 overflow-hidden" style={{ height: "clamp(320px, 60vh, 520px)" }}>
      {/* Sidebar — always visible on desktop; hidden on mobile when chat is open */}
      <div
        className={`${
          !showList ? "hidden md:flex" : "flex"
        } flex-col md:w-48 w-full shrink-0 overflow-hidden`}
      >
        {sidebarEl}
      </div>

      {/* Divider (desktop only) */}
      <div className="hidden md:block w-px bg-gray-700/40 shrink-0" />

      {/* Chat area — always visible on desktop; shown on mobile when conv is open */}
      <div
        className={`${
          showList ? "hidden md:flex" : "flex"
        } flex-1 flex-col min-h-0 min-w-0`}
      >
        {chatEl}
      </div>
    </div>
  );
}
