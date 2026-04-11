"use client";
// components/social/ChatPanel.tsx — E2E encrypted direct messages
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Lock,
  Send,
  MessageCircle,
  AlertTriangle,
  X,
} from "lucide-react";
import {
  ensureKeyPair,
  getFriendPublicKey,
  getSharedKey,
  encryptMessage,
  decryptMessage,
  decryptWithFallback,
} from "@/lib/chat-crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

type Friend    = { id: string; name: string; avatarUrl?: string | null };
type ConvItem  = { id: string; friend: Friend; lastMessageAt?: string | null };
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

type CircleUser   = { id: string; name: string | null; avatarUrl: string | null; profile: { displayName: string | null } | null };
type CircleMember = { id: string; userId: string; addedAt: string; user: CircleUser };
type Circle       = { id: string; label: string; color: string; isDefault: boolean; members: CircleMember[] };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avatarLetter(name: string) { return (name || "?")[0].toUpperCase(); }

function timeLabel(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)      return "now";
  if (diff < 3_600_000)   return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000)  return `${Math.floor(diff / 3_600_000)}h`;
  return new Date(iso).toLocaleDateString();
}

function circleName(u: CircleUser) { return u.profile?.displayName ?? u.name ?? "Unknown"; }

const DOT: Record<string, string> = {
  amber: "bg-amber-400", teal: "bg-teal-400", blue: "bg-blue-400",
  rose: "bg-rose-400",   violet: "bg-violet-400",
};

function sortConvs(cs: ConvItem[]): ConvItem[] {
  return [...cs].sort((a, b) => {
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
    <div className={`${cls} bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium`}>
      {avatarLetter(name)}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChatPanel({ myId }: { myId?: string }) {
  // Crypto setup
  const [keyReady, setKeyReady] = useState(false);
  const [keyError, setKeyError] = useState(false);

  // Lists
  const [convs, setConvs]           = useState<ConvItem[]>([]);
  const [friends, setFriends]       = useState<Friend[]>([]);
  const [circles, setCircles]       = useState<Circle[]>([]);
  const [convsLoading, setConvsLoading] = useState(true);

  // Active conversation
  const [active, setActive]               = useState<ActiveConv | null>(null);
  const [messages, setMessages]           = useState<DecryptedMessage[]>([]);
  const [msgLoading, setMsgLoading]       = useState(false);
  const [friendKeyMissing, setFriendKeyMissing] = useState(false);
  const [notFriends, setNotFriends]       = useState(false);
  const [draft, setDraft]                 = useState("");
  const [sending, setSending]             = useState(false);

  // Mobile: true = show list, false = show chat
  const [showList, setShowList] = useState(true);

  // Mobile message popup — tapping a bubble on mobile shows a full-screen sheet
  const [selectedMsg, setSelectedMsg] = useState<DecryptedMessage | null>(null);

  // Refs
  const activeSharedKeyRef    = useRef<CryptoKey | null>(null); // key for current conv
  const activeConvIdRef       = useRef<string | null>(null);
  const friendJwkRef          = useRef<JsonWebKey | null>(null); // friend's JWK for fallback
  const activeFriendIdRef     = useRef<string | null>(null);
  const eventSourceRef        = useRef<EventSource | null>(null);
  const bottomRef             = useRef<HTMLDivElement>(null);
  const messagesContainerRef  = useRef<HTMLDivElement>(null);

  // ── 1. Ensure keypair + load lists (both run immediately on mount) ────────
  useEffect(() => {
    // WithNavClient already calls ensureKeyPair() on layout mount.
    // We check if the key is already ready to avoid the "Setting up…" flash,
    // and call it here as a safety net (e.g. if ChatPanel mounts before layout).
    _initKeys();
    loadAll();
  }, []);

  function _initKeys() {
    ensureKeyPair()
      .then(() => { setKeyReady(true); setKeyError(false); })
      .catch(() => setKeyError(true));
  }

  async function loadAll() {
    setConvsLoading(true);
    const [cr, fr, cir] = await Promise.all([
      fetch("/api/chat/conversations", { credentials: "include" }).then(r => r.json()).catch(() => null),
      fetch("/api/user/friends",       { credentials: "include" }).then(r => r.json()).catch(() => null),
      fetch("/api/circles",            { credentials: "include" }).then(r => r.json()).catch(() => null),
    ]);
    if (cr?.ok)  setConvs(sortConvs(cr.conversations ?? []));
    if (fr?.ok)  setFriends((fr.friends ?? []).map((f: any) => ({
      id: f.id,
      name: f.displayName ?? f.name ?? f.email ?? "User",
      avatarUrl: f.avatarUrl,
    })));
    if (cir?.ok) setCircles(cir.circles ?? []);
    setConvsLoading(false);
  }

  // ── 3. Open / switch conversation ─────────────────────────────────────────
  async function openConversation(friend: Friend) {
    if (active?.friend.id === friend.id) { setShowList(false); return; }

    // Close previous SSE stream
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    activeConvIdRef.current   = null;
    activeSharedKeyRef.current = null;
    friendJwkRef.current       = null;
    activeFriendIdRef.current  = null;

    setMessages([]);
    setDraft("");
    setFriendKeyMissing(false);
    setNotFriends(false);
    setShowList(false);

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
      setActive({ id: "", friend });
      return;
    }

    const convId: string = d.conversationId;
    activeConvIdRef.current   = convId;
    activeFriendIdRef.current = friend.id;
    setActive({ id: convId, friend });
    setConvs(prev => {
      if (prev.find(c => c.id === convId)) return prev;
      return sortConvs([...prev, { id: convId, friend }]);
    });

    // Get friend's public key — cached in localStorage for 30 min
    let theirJwk: JsonWebKey;
    try {
      theirJwk = await getFriendPublicKey(friend.id);
    } catch {
      setFriendKeyMissing(true);
      return;
    }
    friendJwkRef.current = theirJwk;

    // Derive shared key — cached in module Map, runs once per friend per session
    let sk: CryptoKey;
    try {
      sk = await getSharedKey(friend.id, theirJwk);
    } catch {
      setFriendKeyMissing(true);
      return;
    }
    activeSharedKeyRef.current = sk;

    // Initial message load (existing history)
    setMsgLoading(true);
    await fetchMessages(convId, sk, friend.id, theirJwk);
    setMsgLoading(false);

    // Open SSE stream — replaces polling
    const es = new EventSource(
      `/api/messages/stream?conversationId=${encodeURIComponent(convId)}`
    );
    eventSourceRef.current = es;

    es.addEventListener("message", async (event) => {
      try {
        const raw      = JSON.parse(event.data) as RawMessage;
        const curSk    = activeSharedKeyRef.current;
        const curJwk   = friendJwkRef.current;
        const curFriend = activeFriendIdRef.current;
        if (!curSk || !curJwk || !curFriend) return;

        // Deduplicate — SSE may deliver messages that were added via optimistic UI
        setMessages(prev => { if (prev.find(m => m.id === raw.id)) return prev; return prev; });

        const { text, failed } = await decryptWithFallback(curSk, curFriend, curJwk, raw.ciphertext, raw.iv);

        setMessages(prev => {
          if (prev.find(m => m.id === raw.id)) return prev;
          return [...prev, { id: raw.id, senderId: raw.senderId, text, createdAt: raw.createdAt, failed }];
        });
        setConvs(prev =>
          sortConvs(prev.map(c => c.id === convId ? { ...c, lastMessageAt: raw.createdAt } : c))
        );

        // Save successful decryptions to server backup (fire-and-forget)
        if (!failed) {
          _saveBackup([{ messageId: raw.id, plaintext: text }]);
        }
      } catch { /* SSE parse/decrypt error — ignore */ }
    });

    es.addEventListener("error", () => {
      // Browser will auto-reconnect EventSource — no manual action needed.
    });
  }

  // ── 4. Initial fetch (history) ─────────────────────────────────────────────
  const fetchMessages = useCallback(async (
    convId: string,
    sk: CryptoKey,
    friendId: string,
    theirJwk: JsonWebKey,
  ) => {
    const res = await fetch(`/api/chat/conversations/${convId}/messages`, { credentials: "include" });
    const d   = await res.json().catch(() => null);
    if (!d?.ok || !d.messages?.length) return;

    // Try to decrypt each message; fall back to key-history, then server backup
    const rawMsgs = d.messages as RawMessage[];
    const decrypted: DecryptedMessage[] = await Promise.all(
      rawMsgs.map(async m => {
        const { text, failed } = await decryptWithFallback(sk, friendId, theirJwk, m.ciphertext, m.iv);
        return { id: m.id, senderId: m.senderId, text, createdAt: m.createdAt, failed };
      })
    );

    // For messages that still failed, try the server-side backup
    const stillFailed = decrypted.filter(m => m.failed);
    if (stillFailed.length > 0) {
      const recovered = await _fetchBackup(stillFailed.map(m => m.id));
      for (const m of decrypted) {
        if (m.failed && recovered[m.id]) {
          m.text   = recovered[m.id];
          m.failed = false;
        }
      }
    }

    setMessages(decrypted);

    // Save successfully decrypted messages to server backup (fire-and-forget)
    const toBackup = decrypted
      .filter(m => !m.failed)
      .map(m => ({ messageId: m.id, plaintext: m.text }));
    if (toBackup.length > 0) _saveBackup(toBackup);
  }, []);

  // ── Backup helpers (fire-and-forget) ──────────────────────────────────────
  function _saveBackup(items: Array<{ messageId: string; plaintext: string }>) {
    fetch("/api/chat/backup", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    }).catch(() => {});
  }

  async function _fetchBackup(messageIds: string[]): Promise<Record<string, string>> {
    try {
      const ids = messageIds.join(",");
      const res = await fetch(`/api/chat/backup?ids=${encodeURIComponent(ids)}`, {
        credentials: "include",
      });
      const d = await res.json().catch(() => null);
      return d?.results ?? {};
    } catch {
      return {};
    }
  }

  // ── 5. Send a message ──────────────────────────────────────────────────────
  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const sk = activeSharedKeyRef.current;
    if (!draft.trim() || !active?.id || sending || !sk) return;

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
        // Optimistic append — SSE will deliver to the other side.
        // We add it here directly to avoid seeing it again via SSE (deduplication by id).
        setMessages(prev => [
          ...prev,
          { id: d.message.id, senderId: myId ?? d.message.senderId, text, createdAt: d.message.createdAt },
        ]);
        setConvs(prev =>
          sortConvs(prev.map(c => c.id === active.id ? { ...c, lastMessageAt: d.message.createdAt } : c))
        );
        // Back up sent message too
        _saveBackup([{ messageId: d.message.id, plaintext: text }]);
      }
    } catch {
      setDraft(text); // restore on error
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(e as any); }
  }

  // Scroll to bottom on new messages — direct scrollTop to avoid page-level scroll jank
  useEffect(() => {
    if (messages.length === 0) return;
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => { eventSourceRef.current?.close(); };
  }, []);

  function goBack() {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    activeConvIdRef.current = null;
    activeSharedKeyRef.current = null;
    friendJwkRef.current = null;
    activeFriendIdRef.current = null;
    setShowList(true);
    setActive(null);
    setMessages([]);
    loadAll();
  }

  // ── Sidebar data ───────────────────────────────────────────────────────────
  const convFriendIds = new Set(convs.map(c => c.friend.id));
  const friendsNoConv = friends.filter(f => !convFriendIds.has(f.id));
  const hasAnything   = convs.length > 0 || friends.length > 0 || circles.some(c => c.members.length > 0);

  // ── Left sidebar ───────────────────────────────────────────────────────────
  const sidebarEl = (
    <div className="flex flex-col overflow-y-auto gap-0.5 h-full">
      {/* Inline key status — shows briefly while keys load, or on error */}
      {keyError && (
        <div className="flex items-start gap-2 px-2 py-2 mb-1 rounded-lg bg-amber-900/20 border border-amber-700/30 text-amber-400 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div>
            Encryption setup failed.{" "}
            <button
              onClick={() => { setKeyError(false); _initKeys(); }}
              className="underline hover:text-amber-300"
            >
              Retry
            </button>
          </div>
        </div>
      )}
      {!keyReady && !keyError && (
        <div className="flex items-center gap-2 px-2 py-1 text-xs text-gray-600">
          <Lock className="w-3 h-3 animate-pulse" /> Setting up encryption…
        </div>
      )}
      {convsLoading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
          <MessageCircle className="w-4 h-4 animate-pulse" /> Loading…
        </div>
      ) : !hasAnything ? (
        <div className="flex flex-col items-center py-8 gap-2">
          <MessageCircle className="w-10 h-10 text-gray-700" />
          <p className="text-gray-500 text-sm text-center">No friends yet. Add friends to start chatting.</p>
        </div>
      ) : (
        <>
          {convs.map(c => (
            <button
              key={c.id}
              onClick={() => openConversation(c.friend)}
              disabled={!keyReady}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl border transition-colors text-left disabled:opacity-50 disabled:cursor-wait ${
                active?.friend.id === c.friend.id
                  ? "bg-indigo-600/20 border-indigo-500/40"
                  : "bg-gray-800/60 border-gray-700/40 hover:bg-gray-700/60"
              }`}
            >
              <Avatar src={c.friend.avatarUrl} name={c.friend.name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{c.friend.name}</p>
                {c.lastMessageAt && <p className="text-[10px] text-gray-500">{timeLabel(c.lastMessageAt)}</p>}
              </div>
            </button>
          ))}

          {friendsNoConv.length > 0 && (
            <>
              {convs.length > 0 && (
                <p className="text-[10px] text-gray-600 uppercase tracking-wider pt-2 pb-0.5 px-1">Friends</p>
              )}
              {friendsNoConv.map(f => (
                <button
                  key={f.id}
                  onClick={() => openConversation(f)}
                  disabled={!keyReady}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-gray-800/40 border border-gray-700/30 hover:bg-gray-700/50 transition-colors text-left disabled:opacity-50 disabled:cursor-wait"
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

          {circles.filter(c => c.members.length > 0).map(circle => (
            <div key={circle.id}>
              <div className="flex items-center gap-1.5 pt-3 pb-0.5 px-1">
                <div className={`w-2 h-2 rounded-full ${DOT[circle.color] ?? "bg-blue-400"}`} />
                <p className="text-[10px] text-gray-600 uppercase tracking-wider">{circle.label}</p>
              </div>
              {circle.members.map(m => {
                const name = circleName(m.user);
                return (
                  <button
                    key={m.id}
                    onClick={() => openConversation({ id: m.userId, name, avatarUrl: m.user.avatarUrl })}
                    disabled={!keyReady}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl border transition-colors text-left disabled:opacity-50 disabled:cursor-wait ${
                      active?.friend.id === m.userId
                        ? "bg-indigo-600/20 border-indigo-500/40"
                        : "bg-gray-800/30 border-gray-700/20 hover:bg-gray-700/40"
                    }`}
                  >
                    <Avatar src={m.user.avatarUrl} name={name} />
                    <p className="text-sm font-medium text-gray-200 truncate flex-1 min-w-0">{name}</p>
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
        <button onClick={goBack} className="md:hidden p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <Avatar src={active.friend.avatarUrl} name={active.friend.name} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{active.friend.name}</p>
          {!notFriends && !friendKeyMissing && (
            <div className="flex items-center gap-1 text-[10px] text-green-400">
              <Lock className="w-3 h-3" /> End-to-end encrypted
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
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto space-y-2 mb-3 pr-1 min-h-0">
          {msgLoading && <p className="text-center text-xs text-gray-500 py-4">Loading messages…</p>}
          {!msgLoading && messages.length === 0 && (
            <p className="text-center text-xs text-gray-500 py-8">No messages yet. Say hello!</p>
          )}
          {messages.map(m => {
            const isMe = m.senderId === myId;
            return (
              <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                {/* On mobile, tapping a bubble opens the message popup sheet */}
                <div
                  className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-snug cursor-pointer md:cursor-default active:opacity-80 transition-opacity ${
                    m.failed
                      ? "bg-gray-800/40 text-gray-600 border border-gray-700/20 italic"
                      : isMe
                      ? "bg-indigo-600 text-white rounded-br-sm"
                      : "bg-gray-700/80 text-gray-100 rounded-bl-sm"
                  }`}
                  onClick={() => setSelectedMsg(m)}
                >
                  <p className="whitespace-pre-wrap break-words">
                    {m.failed ? "🔒 Encrypted with a previous key" : m.text}
                  </p>
                  <p className={`text-[10px] mt-0.5 ${isMe ? "text-indigo-200" : "text-gray-500"}`}>
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
            onChange={e => setDraft(e.target.value)}
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
    <div className="hidden md:flex flex-1 items-center justify-center text-gray-700">
      <div className="text-center space-y-2">
        <MessageCircle className="w-10 h-10 mx-auto opacity-30" />
        <p className="text-sm">Select a conversation</p>
      </div>
    </div>
  );

  // ── Mobile message popup sheet ─────────────────────────────────────────────
  // Shown on mobile when the user taps a message bubble.
  // It covers the bottom half of the screen and auto-scrolls to the latest message.
  const msgPopup = selectedMsg ? (
    <div
      className="fixed inset-0 z-[60] md:hidden flex flex-col justify-end"
      onClick={() => setSelectedMsg(null)}
    >
      {/* Dim backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Sheet */}
      <div
        className="relative bg-[#161b25] border-t border-gray-700/60 rounded-t-2xl px-4 pt-4 pb-8 max-h-[70vh] flex flex-col gap-3"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle + close */}
        <div className="flex items-center justify-between mb-1">
          <div className="w-10 h-1 rounded-full bg-gray-600 mx-auto" />
          <button
            onClick={() => setSelectedMsg(null)}
            className="absolute right-4 top-4 p-1.5 rounded-full bg-gray-700/60 text-gray-400 hover:text-white hover:bg-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message content */}
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed overflow-y-auto ${
          selectedMsg.failed
            ? "bg-gray-800/60 text-gray-500 italic border border-gray-700/30"
            : selectedMsg.senderId === myId
            ? "bg-indigo-600 text-white"
            : "bg-gray-700/80 text-gray-100"
        }`}>
          <p className="whitespace-pre-wrap break-words">
            {selectedMsg.failed ? "🔒 Encrypted with a previous key" : selectedMsg.text}
          </p>
        </div>

        {/* Timestamp + sender hint */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{selectedMsg.senderId === myId ? "You" : active?.friend.name ?? "Them"}</span>
          <span>{new Date(selectedMsg.createdAt).toLocaleString()}</span>
        </div>

        {/* Recent messages list — shows context from this message to the latest */}
        {messages.length > 1 && (() => {
          const idx = messages.findIndex(m => m.id === selectedMsg.id);
          const after = messages.slice(idx + 1);
          if (after.length === 0) return null;
          return (
            <div className="border-t border-gray-700/40 pt-3">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Later messages</p>
              <div className="flex flex-col gap-1.5 overflow-y-auto max-h-40">
                {after.map(m => {
                  const isMine = m.senderId === myId;
                  return (
                    <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] px-3 py-1.5 rounded-xl text-xs ${
                        m.failed
                          ? "bg-gray-800/40 text-gray-600 italic border border-gray-700/20"
                          : isMine
                          ? "bg-indigo-600/80 text-white"
                          : "bg-gray-700/60 text-gray-200"
                      }`}>
                        <p className="whitespace-pre-wrap break-words">
                          {m.failed ? "🔒 Encrypted with a previous key" : m.text}
                        </p>
                        <p className="text-[9px] mt-0.5 opacity-60">{timeLabel(m.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  ) : null;

  // ── Layout ─────────────────────────────────────────────────────────────────
  // On mobile, when a chat is active show a full-screen fixed overlay so the
  // keyboard resize and header are handled cleanly by the OS.
  const mobileChatOverlay = !showList && active ? (
    <div className="fixed inset-0 z-50 bg-[#0f1117] flex flex-col md:hidden">
      <div className="flex flex-col flex-1 min-h-0 px-4 pt-3 pb-3">
        {chatEl}
      </div>
    </div>
  ) : null;

  return (
    <>
      {mobileChatOverlay}
      {msgPopup}
      {/* Desktop split-pane + mobile list view */}
      <div className="flex gap-3 overflow-hidden" style={{ height: "clamp(320px, 60vh, 520px)" }}>
        {/* Sidebar — always visible on desktop; on mobile only when showList */}
        <div className={`${!showList ? "hidden md:flex" : "flex"} flex-col md:w-48 w-full shrink-0 overflow-hidden`}>
          {sidebarEl}
        </div>
        {/* Divider (desktop only) */}
        <div className="hidden md:block w-px bg-gray-700/40 shrink-0" />
        {/* Chat area — desktop only (mobile uses the overlay above) */}
        <div className="hidden md:flex flex-1 flex-col min-h-0 min-w-0">
          {chatEl}
        </div>
      </div>
    </>
  );
}
