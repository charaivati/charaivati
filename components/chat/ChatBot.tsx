"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, X, Trash2, Send } from "lucide-react";
import CouncilView, { type CouncilResponse, type CouncilPosition, type StatusStep } from "./CouncilView";
import { isCouncilWorthy } from "@/lib/ai/councilTrigger";

interface TierUI {
  label: string;
  responding: string;
  waiting: string;
  cloudFallback: string;
  disclaimer: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  tierUI?: TierUI;
  source?: "local" | "cloud";
  coldStart?: boolean;
  localExpected?: boolean;
  council?: CouncilResponse;
  showCouncilPrompt?: boolean;
  originUserMessage?: string;
}

const NUDGE_KEY = "charaivati.nudge.profile";
const NUDGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface ChatBotProps {
  currentSection?: string;
  isLoggedIn?: boolean;
  userId?: string;
  userStatus?: string;
}

export default function ChatBot({ currentSection = "Self", isLoggedIn = false, userId, userStatus }: ChatBotProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [nudgeVisible, setNudgeVisible] = useState(false);
  const [nudgeExpanded, setNudgeExpanded] = useState(false);
  const [nudgeUsername, setNudgeUsername] = useState("");
  const [nudgePassword, setNudgePassword] = useState("");
  const [nudgeError, setNudgeError] = useState("");
  const [nudgeSaving, setNudgeSaving] = useState(false);
  const [nudgeDone, setNudgeDone] = useState(false);
  const [isCompanionMode, setIsCompanionMode] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const councilAbortRef = useRef<AbortController | null>(null);

  // Derived — true when a streaming council message is in flight
  const councilPending = messages.some((m) => m.council?._pending === true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // URL param path (kept for backwards compat with any bookmarked /chat?mode=companion)
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "companion") {
      setIsCompanionMode(true);
      setOpen(true);
    }
    // In-place trigger: any component on the page can fire this event
    function handleOpenCompanion() {
      setIsCompanionMode(true);
      setOpen(true);
    }
    window.addEventListener("charaivati:open-companion", handleOpenCompanion);
    return () => window.removeEventListener("charaivati:open-companion", handleOpenCompanion);
  }, []);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [open, messages]);

  useEffect(() => {
    if (userStatus !== "guest" || !userId) return;
    try {
      const stored = localStorage.getItem(NUDGE_KEY);
      if (stored) {
        const ts = parseInt(stored, 10);
        if (!isNaN(ts) && Date.now() - ts < NUDGE_TTL_MS) return;
      }
      setNudgeVisible(true);
    } catch {
      // localStorage unavailable — skip nudge
    }
  }, [userId, userStatus]);

  function snoozeNudge() {
    try { localStorage.setItem(NUDGE_KEY, String(Date.now())); } catch {}
    setNudgeVisible(false);
    setNudgeExpanded(false);
  }

  function collapseNudgeForm() {
    setNudgeExpanded(false);
    setNudgeUsername("");
    setNudgePassword("");
    setNudgeError("");
  }

  const nudgeUsernameValid = /^[a-zA-Z0-9_]{3,20}$/.test(nudgeUsername);

  async function saveGuestUpgrade() {
    if (nudgeSaving) return;
    setNudgeError("");
    if (!nudgeUsernameValid) {
      setNudgeError("3–20 chars, letters, numbers, or underscores only.");
      return;
    }
    if (nudgePassword.length < 8) {
      setNudgeError("Password must be at least 8 characters.");
      return;
    }
    setNudgeSaving(true);
    try {
      const res = await fetch("/api/user/guest-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: nudgeUsername, password: nudgePassword }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        // Stamp localStorage so nudge won't reappear even before server status propagates
        try { localStorage.setItem(NUDGE_KEY, String(Date.now())); } catch {}
        setNudgeDone(true);
        setTimeout(() => setNudgeVisible(false), 3000);
        // Refresh server components so layout re-reads DB (userStatus → "lite")
        router.refresh();
      } else {
        setNudgeError(json.error ?? "Something went wrong. Try again.");
      }
    } catch {
      setNudgeError("Network error. Try again.");
    } finally {
      setNudgeSaving(false);
    }
  }

  if (!isLoggedIn) return null;

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function updatePendingCouncil(updater: (c: CouncilResponse) => CouncilResponse) {
    setMessages((prev) => {
      let idx = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].council?._pending) { idx = i; break; }
      }
      if (idx === -1) return prev;
      return [
        ...prev.slice(0, idx),
        { ...prev[idx], council: updater(prev[idx].council!) },
        ...prev.slice(idx + 1),
      ];
    });
  }

  function removePendingCouncil(fallbackContent: string) {
    setMessages((prev) => {
      const withoutPending = prev.filter((m) => !m.council?._pending);
      return [...withoutPending, { role: "assistant", content: fallbackContent }];
    });
  }

  // ─── Council dispatch (streaming) ─────────────────────────────────────────

  async function dispatchCouncil(text: string, trigger: "auto" | "manual", addUserMessage: boolean) {
    if (loading) return;

    const controller = new AbortController();
    councilAbortRef.current = controller;
    setLoading(true);

    const pendingMsg: Message = {
      role: "assistant",
      content: "",
      council: {
        positions: [],
        verdict: "",
        synthesis: "",
        trigger,
        tier: "council",
        _pending: true,
        _statusSteps: [{ step: 1, message: "Sending your question to the Council...", active: true }],
      },
    };

    if (addUserMessage) {
      const userMsg: Message = { role: "user", content: text };
      setMessages((prev) => [...prev, userMsg, pendingMsg]);
    } else {
      setMessages((prev) => [...prev, pendingMsg]);
    }

    try {
      const res = await fetch("/api/council", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, trigger }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error((err.error as string) || `HTTP ${res.status}`);
      }
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line) as Record<string, unknown>;

            if (chunk.type === "status") {
              updatePendingCouncil((c) => ({
                ...c,
                _statusSteps: [
                  ...(c._statusSteps ?? []).map((s) => ({ ...s, active: false })),
                  { step: chunk.step as number, message: chunk.message as string, active: true },
                ],
              }));
            } else if (chunk.type === "position") {
              updatePendingCouncil((c) => ({
                ...c,
                positions: [...c.positions, chunk.data as CouncilPosition],
              }));
            } else if (chunk.type === "verdict") {
              updatePendingCouncil((c) => ({
                ...c,
                verdict: chunk.verdict as string,
                synthesis: chunk.synthesis as string,
                trigger: (chunk.trigger as "auto" | "manual") ?? trigger,
                _fallback: chunk._fallback as boolean | undefined,
                _pending: false,
              }));
            } else if (chunk.type === "aborted") {
              removePendingCouncil("Council dismissed.");
            } else if (chunk.type === "error") {
              removePendingCouncil((chunk.message as string) || "The Council is unavailable right now.");
            }
          } catch {
            // skip malformed NDJSON lines
          }
        }
      }

      // Stream closed without a verdict chunk — clean up any lingering pending state
      setMessages((prev) => {
        if (!prev.some((m) => m.council?._pending)) return prev;
        const withoutPending = prev.filter((m) => !m.council?._pending);
        return [...withoutPending, { role: "assistant", content: "Council session ended unexpectedly." }];
      });
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      removePendingCouncil(isAbort ? "Council dismissed." : "The Council is unavailable right now.");
    } finally {
      setLoading(false);
      councilAbortRef.current = null;
    }
  }

  function cancelCouncil() {
    councilAbortRef.current?.abort();
    // dispatchCouncil catch block handles the UI cleanup via removePendingCouncil
  }

  // ─── Chat dispatch ─────────────────────────────────────────────────────────

  async function dispatchChat(text: string) {
    if (loading) return;
    const userMsg: Message = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          context: { currentSection },
          conversationHistory: messages
            .filter((m) => !m.council)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      setMessages([
        ...next,
        {
          role: "assistant",
          content: data.reply ?? "No response.",
          tierUI: data.tierUI,
          source: data.source,
          coldStart: data.coldStart,
          localExpected: data.localExpected,
          showCouncilPrompt: isCouncilWorthy(text),
          originUserMessage: text,
        },
      ]);
      if (isCompanionMode) {
        fetch("/api/companion/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
          credentials: "include",
        }).catch(() => {});
      }
    } catch {
      setMessages([...next, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  // ─── User actions ──────────────────────────────────────────────────────────

  function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    dispatchChat(text);
  }

  function sendToCouncil() {
    if (loading) return;
    const inputText = input.trim();
    const lastUserContent =
      messages.filter((m) => m.role === "user" && !m.council).slice(-1)[0]?.content ?? "";
    const text = inputText || lastUserContent;
    if (!text) return;
    if (inputText) setInput("");
    dispatchCouncil(text, "manual", !!inputText);
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // ─── Derived values for render ─────────────────────────────────────────────

  const lastUserContent =
    messages.filter((m) => m.role === "user" && !m.council).slice(-1)[0]?.content ?? "";
  const councilTarget = input.trim() || lastUserContent;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Floating bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open Charaivati guide"
          className="fixed bottom-20 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 shadow-lg hover:bg-indigo-500 transition-colors"
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className={`fixed bottom-20 right-6 z-50 flex flex-col rounded-xl shadow-2xl ${isCompanionMode ? "border border-stone-700 bg-stone-900" : "border border-gray-800 bg-gray-950"}`}
          style={{ width: 380, height: 540 }}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-4 py-3 ${isCompanionMode ? "border-b border-stone-700" : "border-b border-gray-800"}`}>
            <span className="text-sm font-semibold text-white">
              {isCompanionMode ? "Check-in with Charaivati" : "Charaivati Guide"}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMessages([])}
                aria-label="Clear chat"
                title="Clear chat"
                className="rounded p-1 text-gray-400 hover:text-gray-200 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="rounded p-1 text-gray-400 hover:text-gray-200 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {nudgeVisible && (
              <div
                className="rounded-xl px-3 py-2.5"
                style={{
                  background: "rgba(251,191,36,0.07)",
                  border: "1px solid rgba(251,191,36,0.2)",
                }}
              >
                {nudgeDone ? (
                  <p className="text-xs text-green-400 font-medium">
                    ✓ Account secured. Welcome, {nudgeUsername}!
                  </p>
                ) : !nudgeExpanded ? (
                  /* ── State 1: Collapsed ── */
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-yellow-400 font-medium leading-snug">
                      Your progress isn&apos;t saved yet.
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setNudgeExpanded(true)}
                        className="text-xs font-medium rounded-lg px-2.5 py-1 transition-colors"
                        style={{
                          background: "rgba(251,191,36,0.12)",
                          border: "1px solid rgba(251,191,36,0.3)",
                          color: "#fbbf24",
                        }}
                      >
                        Secure Account
                      </button>
                      <button
                        onClick={snoozeNudge}
                        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        Later
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── State 2: Expanded form ── */
                  <div className="space-y-2">
                    <p className="text-xs text-yellow-400 font-medium">Secure your account</p>

                    <div>
                      <input
                        type="text"
                        value={nudgeUsername}
                        onChange={(e) => { setNudgeUsername(e.target.value); setNudgeError(""); }}
                        placeholder="Username"
                        maxLength={20}
                        autoComplete="username"
                        className="w-full rounded-lg bg-gray-800 px-2.5 py-1.5 text-xs text-white placeholder-gray-500 outline-none transition-colors"
                        style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(251,191,36,0.4)")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                      />
                      {nudgeUsername.length > 0 && !nudgeUsernameValid && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          3–20 chars, letters, numbers, or _
                        </p>
                      )}
                    </div>

                    <input
                      type="password"
                      value={nudgePassword}
                      onChange={(e) => { setNudgePassword(e.target.value); setNudgeError(""); }}
                      placeholder="Password (8+ chars)"
                      autoComplete="new-password"
                      className="w-full rounded-lg bg-gray-800 px-2.5 py-1.5 text-xs text-white placeholder-gray-500 outline-none transition-colors"
                      style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(251,191,36,0.4)")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                    />

                    {nudgeError && (
                      <p className="text-xs text-red-400">{nudgeError}</p>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={saveGuestUpgrade}
                        disabled={nudgeSaving}
                        className="flex-1 text-xs font-medium rounded-lg py-1.5 disabled:opacity-50 transition-colors"
                        style={{
                          background: "rgba(251,191,36,0.15)",
                          border: "1px solid rgba(251,191,36,0.35)",
                          color: "#fbbf24",
                        }}
                      >
                        {nudgeSaving ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={collapseNudgeForm}
                        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {messages.length === 0 && (
              <p className="text-center text-xs text-gray-500 mt-8">
                {isCompanionMode
                  ? "Let's take a few minutes to check in."
                  : "Ask your guide anything about your goals, drives, or next steps."}
              </p>
            )}

            {messages.map((m, i) => {
              if (m.council) {
                return (
                  <div key={i} className="w-full">
                    <CouncilView
                      {...m.council}
                      onCancel={m.council._pending ? cancelCouncil : undefined}
                    />
                  </div>
                );
              }
              return (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "assistant" ? (
                    <div className="flex flex-col max-w-[80%]">
                      {m.tierUI && (
                        <span className="text-xs text-gray-500 mb-1">{m.tierUI.responding}</span>
                      )}
                      <div className="bg-gray-800 text-gray-100 rounded-2xl rounded-bl-sm px-3 py-2 text-sm leading-relaxed">
                        {m.content}
                      </div>
                      {m.tierUI?.disclaimer && (
                        <span className="text-xs text-gray-500 italic mt-1">{m.tierUI.disclaimer}</span>
                      )}
                      {m.coldStart && (
                        <span className="text-xs text-gray-500 mt-1">
                          Assistant was warming up — responses will be faster now
                        </span>
                      )}
                      {m.source === "cloud" && m.localExpected && (
                        <span className="text-xs text-gray-500 mt-1">Local assistant unavailable</span>
                      )}
                      {m.showCouncilPrompt && m.originUserMessage && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-gray-500">⚖️ The Council can go deeper on this</span>
                          <button
                            onClick={() => dispatchCouncil(m.originUserMessage!, "manual", false)}
                            disabled={loading}
                            className="text-xs text-gray-500 border border-gray-700 rounded px-1.5 py-0.5 hover:text-gray-300 hover:border-gray-600 disabled:opacity-40 transition-colors"
                          >
                            Ask the Council
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed bg-indigo-600 text-white rounded-br-sm">
                      {m.content}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Typing indicator — only for non-council loading */}
            {loading && !councilPending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-gray-800 px-4 py-3">
                  <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                  <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                  <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-800 flex flex-col">
            <div className="px-3 pt-3 pb-1.5 flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={isCompanionMode ? "What's on your mind?" : "Ask your guide…"}
                rows={1}
                className="flex-1 resize-none rounded-lg bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-indigo-500 max-h-24 overflow-y-auto"
                style={{ lineHeight: "1.5" }}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                aria-label="Send message"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-500 transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <div className="px-3 pb-2.5">
              <button
                onClick={sendToCouncil}
                disabled={loading || !councilTarget}
                title={!councilTarget ? "Ask a question first, then consult the Council" : ""}
                className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-40 transition-colors"
              >
                ⚖️ Ask the Council
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
