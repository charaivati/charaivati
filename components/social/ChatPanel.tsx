"use client";
// components/social/ChatPanel.tsx — E2E encrypted direct messages
import React, { useEffect, useRef, useState, useCallback } from "react";
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

type Friend = {
  id: string;
  name: string;
  avatarUrl?: string | null;
};

type Conversation = {
  id: string;
  friend: Friend;
  lastMessage?: { ciphertext: string; iv: string; senderId: string; createdAt: string } | null;
  lastMessageAt?: string | null;
};

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avatarLetter(name: string) {
  return (name || "?")[0].toUpperCase();
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return d.toLocaleDateString();
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChatPanel({ myId }: { myId?: string }) {
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);
  const [keyReady, setKeyReady] = useState(false);
  const [keyError, setKeyError] = useState(false);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convsLoading, setConvsLoading] = useState(true);

  const [friends, setFriends] = useState<Friend[]>([]);

  // Active conversation state
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [sharedKey, setSharedKey] = useState<CryptoKey | null>(null);
  const [friendKeyMissing, setFriendKeyMissing] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSeenRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── 1. Generate / load keypair + upload public key ─────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const kp = await getOrCreateKeyPair();
        setKeyPair(kp);
        // Upload public key (idempotent)
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

  // ── 2. Load conversations + friends list ───────────────────────────────────
  useEffect(() => {
    if (!keyReady) return;
    loadConversations();
    loadFriends();
  }, [keyReady]);

  async function loadConversations() {
    setConvsLoading(true);
    try {
      const res = await fetch("/api/chat/conversations", { credentials: "include" });
      const d = await res.json().catch(() => null);
      if (d?.ok) setConversations(d.conversations ?? []);
    } catch {
      // ignore
    } finally {
      setConvsLoading(false);
    }
  }

  async function loadFriends() {
    try {
      const res = await fetch("/api/user/friends", { credentials: "include" });
      const d = await res.json().catch(() => null);
      if (d?.ok) {
        setFriends(
          (d.friends ?? []).map((f: any) => ({
            id: f.id,
            name: f.displayName ?? f.name ?? f.email ?? "User",
            avatarUrl: f.avatarUrl,
          }))
        );
      }
    } catch {
      // ignore
    }
  }

  // ── 3. Open a conversation ─────────────────────────────────────────────────
  async function openConversation(friend: Friend) {
    // Stop previous poll
    if (pollRef.current) clearInterval(pollRef.current);
    lastSeenRef.current = null;
    setMessages([]);
    setDraft("");
    setFriendKeyMissing(false);
    setSharedKey(null);

    // Get or create conversation
    const res = await fetch("/api/chat/conversations", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendId: friend.id }),
    });
    const d = await res.json().catch(() => null);
    if (!d?.ok) return;

    const conv: Conversation = {
      id: d.conversationId,
      friend,
    };
    setActive(conv);

    // Derive shared key
    if (!keyPair) return;
    try {
      const keyRes = await fetch(`/api/keys?userId=${friend.id}`, { credentials: "include" });
      const keyData = await keyRes.json().catch(() => null);
      if (!keyData?.ok) {
        setFriendKeyMissing(true);
        return;
      }
      const sk = await deriveSharedKey(keyPair.privateJwk, keyData.publicKey);
      setSharedKey(sk);

      // Load initial messages
      setMsgLoading(true);
      await fetchMessages(conv.id, sk);
      setMsgLoading(false);

      // Start polling every 3s
      pollRef.current = setInterval(() => fetchMessages(conv.id, sk), 3000);
    } catch {
      setFriendKeyMissing(true);
    }
  }

  // ── 4. Fetch + decrypt messages ────────────────────────────────────────────
  const fetchMessages = useCallback(
    async (convId: string, sk: CryptoKey) => {
      const url = lastSeenRef.current
        ? `/api/chat/conversations/${convId}/messages?after=${encodeURIComponent(lastSeenRef.current)}`
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
        const existingIds = new Set(prev.map((m) => m.id));
        const toAdd = newMsgs.filter((m) => !existingIds.has(m.id));
        return [...prev, ...toAdd];
      });

      // Update cursor
      const latest = d.messages[d.messages.length - 1]?.createdAt;
      if (latest) lastSeenRef.current = latest;
    },
    []
  );

  // Scroll to bottom when messages grow
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup poll on unmount or conversation change
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── 5. Send a message ──────────────────────────────────────────────────────
  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !sharedKey || !active || sending) return;
    setSending(true);
    const text = draft.trim();
    setDraft("");
    try {
      const { ciphertext, iv } = await encryptMessage(sharedKey, text);
      const res = await fetch(`/api/chat/conversations/${active.id}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ciphertext, iv }),
      });
      const d = await res.json().catch(() => null);
      if (d?.ok && d.message) {
        setMessages((prev) => [
          ...prev,
          {
            id: d.message.id,
            senderId: d.message.senderId,
            text,
            createdAt: d.message.createdAt,
          },
        ]);
      }
    } catch {
      // restore draft on error
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  // ── Keyboard shortcut: Enter to send ──────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e as any);
    }
  }

  // ─── Render: crypto error ─────────────────────────────────────────────────
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

  // ── Render: active conversation ────────────────────────────────────────────
  if (active) {
    return (
      <div className="flex flex-col" style={{ minHeight: 360 }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => {
              if (pollRef.current) clearInterval(pollRef.current);
              setActive(null);
              setMessages([]);
              loadConversations();
            }}
            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          {active.friend.avatarUrl ? (
            <img src={active.friend.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
              {avatarLetter(active.friend.name)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{active.friend.name}</p>
            <div className="flex items-center gap-1 text-xs text-green-400">
              <Lock className="w-3 h-3" />
              End-to-end encrypted
            </div>
          </div>
        </div>

        {/* Friend key missing */}
        {friendKeyMissing && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-900/20 border border-amber-700/30 text-amber-400 text-sm mb-3">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Your friend hasn't set up encryption yet. Ask them to open the Messages tab.
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-2 mb-3 pr-1" style={{ maxHeight: 320 }}>
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
                  <p className={`text-[10px] mt-0.5 ${isMe ? "text-indigo-200" : "text-gray-500"}`}>
                    {timeLabel(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {!friendKeyMissing && (
          <form onSubmit={sendMessage} className="flex gap-2 items-end">
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
    );
  }

  // ── Render: conversations + friends list ───────────────────────────────────

  // Merge conversations and friends so all friends appear
  const convFriendIds = new Set(conversations.map((c) => c.friend.id));
  const friendsWithoutConv = friends.filter((f) => !convFriendIds.has(f.id));

  const noChats = conversations.length === 0 && friends.length === 0;

  if (convsLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
        <MessageCircle className="w-4 h-4 animate-pulse" />
        Loading…
      </div>
    );
  }

  if (noChats) {
    return (
      <div className="flex flex-col items-center py-8 gap-2">
        <MessageCircle className="w-10 h-10 text-gray-700" />
        <p className="text-gray-500 text-sm">No friends yet. Add friends to start chatting.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Existing conversations */}
      {conversations.map((c) => (
        <button
          key={c.id}
          onClick={() => openConversation(c.friend)}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-800/60 border border-gray-700/40 hover:bg-gray-700/60 transition-colors text-left"
        >
          {c.friend.avatarUrl ? (
            <img src={c.friend.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium shrink-0">
              {avatarLetter(c.friend.name)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{c.friend.name}</p>
            <p className="text-xs text-gray-500 truncate">
              {c.lastMessageAt ? `${timeLabel(c.lastMessageAt)} · ` : ""}
              <span className="text-gray-600">🔒 encrypted</span>
            </p>
          </div>
        </button>
      ))}

      {/* Friends without a conversation yet */}
      {friendsWithoutConv.length > 0 && (
        <>
          {conversations.length > 0 && (
            <p className="text-xs text-gray-600 uppercase tracking-wider pt-2 pb-1">Friends</p>
          )}
          {friendsWithoutConv.map((f) => (
            <button
              key={f.id}
              onClick={() => openConversation(f)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-800/40 border border-gray-700/30 hover:bg-gray-700/50 transition-colors text-left"
            >
              {f.avatarUrl ? (
                <img src={f.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-medium shrink-0">
                  {avatarLetter(f.name)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{f.name}</p>
                <p className="text-xs text-gray-500">Start a conversation</p>
              </div>
            </button>
          ))}
        </>
      )}
    </div>
  );
}
