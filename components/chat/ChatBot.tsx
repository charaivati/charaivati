"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, X, Trash2, Send, Paperclip, FileText } from "lucide-react";
import CouncilView, { type CouncilResponse, type CouncilPosition, type StatusStep } from "./CouncilView";
import ProposalCard from "./ProposalCard";
import { isCouncilWorthy } from "@/lib/ai/councilTrigger";
import type { ProfileProposal } from "@/lib/companion/profileSync";

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
  proposal?: ProfileProposal;
  proposalStatus?: "pending" | "accepted" | "dismissed";
  attachedDocName?: string;
}

interface AttachedDoc {
  name: string;
  text: string;
  charCount: number;
  truncated: boolean;
  needsOcr: boolean;
  ocrPagesUsed: number;
  warnings: string[];
}

const NUDGE_KEY = "charaivati.nudge.profile";
const NUDGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DISMISSED_PROPOSALS_KEY = "charaivati.dismissed_proposals";
const MAX_DISMISSED_PROPOSALS = 50;

function getDismissedProposals(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_PROPOSALS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function addDismissedProposal(id: string) {
  try {
    const current = getDismissedProposals();
    const next = [...current.filter((x) => x !== id), id].slice(-MAX_DISMISSED_PROPOSALS);
    localStorage.setItem(DISMISSED_PROPOSALS_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — proposal may repeat; non-critical
  }
}

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
  const [attachedDoc, setAttachedDoc] = useState<AttachedDoc | null>(null);
  const [docUploading, setDocUploading] = useState(false);
  const [docError, setDocError] = useState("");
  const [proposalLoading, setProposalLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const councilAbortRef = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  // ─── Companion nudge red-dot state ────────────────────────────────────────
  // nudgePendingRef mirrors the state value so event-listener closures (captured
  // at mount) can always read the current value without stale-closure issues.
  const [nudgePending, setNudgePending] = useState(false);
  const nudgePendingRef      = useRef(false);
  const nudgeAcknowledgedRef = useRef(false);  // single-fire guard per pending window
  const companionOpenedRef   = useRef(false);  // true once companion has been activated
  const openedFromNudgeRef   = useRef(false);  // true when companion opened because nudge was pending
  const greetingSeededRef    = useRef(false);  // true once the waiting greeting has been injected

  // Derived — true when a streaming council message is in flight
  const councilPending = messages.some((m) => m.council?._pending === true);

  // ─── Acknowledge helper ────────────────────────────────────────────────────
  // Uses refs only — safe to call from event-listener closures defined at mount.
  // Strict guard: no-op if nudge is not currently pending or already acknowledged.
  function acknowledgeNudge() {
    if (!nudgePendingRef.current || nudgeAcknowledgedRef.current) return;
    nudgeAcknowledgedRef.current = true;
    nudgePendingRef.current = false;
    setNudgePending(false);
    fetch("/api/companion/nudge", { method: "POST", credentials: "include" }).catch(() => {});
  }

  // ─── Unified open-companion entry point ───────────────────────────────────
  // fromNudge = true  → seeds the waiting greeting (bubble + banner)
  // fromNudge = false → companion mode only, no greeting (bookmarked URL)
  function openCompanion(fromNudge: boolean) {
    if (fromNudge) openedFromNudgeRef.current = true;
    companionOpenedRef.current = true;
    setIsCompanionMode(true);
    setOpen(true);
    acknowledgeNudge();
  }

  // ─── Companion mode + nudge-acknowledged event listener ───────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    // URL param path (backwards compat — no nudge greeting for direct URL access)
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "companion") {
      openCompanion(false);
    }
    // Banner fires this — always implies a nudge was pending
    function handleOpenCompanion() { openCompanion(true); }
    // Banner dismiss button fires this to clear the dot without opening the widget
    function handleNudgeAcknowledged() { acknowledgeNudge(); }
    window.addEventListener("charaivati:open-companion", handleOpenCompanion);
    window.addEventListener("charaivati:nudge-acknowledged", handleNudgeAcknowledged);
    return () => {
      window.removeEventListener("charaivati:open-companion", handleOpenCompanion);
      window.removeEventListener("charaivati:nudge-acknowledged", handleNudgeAcknowledged);
    };
  }, []);

  // ─── Seed the waiting greeting on first companion open from a nudge ───────
  useEffect(() => {
    if (!open || !isCompanionMode || !openedFromNudgeRef.current || greetingSeededRef.current) return;
    setMessages(prev => {
      if (prev.length > 0) return prev; // ongoing conversation — never inject mid-thread
      greetingSeededRef.current = true;
      return [{ role: "assistant" as const, content: "Hey — got a few minutes to catch up? If now's not a good time, just close this and we'll talk again later." }];
    });
  }, [open, isCompanionMode]);

  useEffect(() => {
    if (open) {
      const el = messagesRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [open, messages]);

  // ─── Lock background scroll while the panel is open ──────────────────────
  // overflow:hidden on body alone doesn't stop touch-scroll on iOS/Android;
  // pin body in place with position:fixed AND hard-block any touchmove that
  // starts outside the panel — real mobile browsers still let the page pan
  // behind a fixed overlay with just the CSS trick.
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const { style } = document.body;
    const prev = { overflow: style.overflow, position: style.position, top: style.top, width: style.width };
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    style.overflow = "hidden";
    style.position = "fixed";
    style.top = `-${scrollY}px`;
    style.width = "100%";

    function blockBackgroundTouch(e: TouchEvent) {
      if (!panelRef.current?.contains(e.target as Node)) e.preventDefault();
    }
    document.addEventListener("touchmove", blockBackgroundTouch, { passive: false });

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      style.overflow = prev.overflow;
      style.position = prev.position;
      style.top = prev.top;
      style.width = prev.width;
      window.scrollTo(0, scrollY);
      document.removeEventListener("touchmove", blockBackgroundTouch);
    };
  }, [open]);

  // ─── Keyboard-aware panel positioning (mobile) ────────────────────────────
  // Mobile: near-full-screen with a small top gap, bottom rides above the
  // keyboard. Desktop (sm:+): the original small bottom-right box, unchanged.
  // Compare visualViewport.height against a baseline taken when the panel
  // opens (not window.innerHeight, which itself shifts as mobile browser
  // chrome show/hides) so the panel only resizes for the real keyboard.
  const [panelStyle, setPanelStyle] = useState<{ top?: number; bottom: number; height?: number }>({ bottom: 80, height: 540 });
  useEffect(() => {
    if (!open || typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const baseline = vv.height;
    function update() {
      const keyboardGap = Math.max(0, baseline - vv.height);
      const isMobile = window.innerWidth < 640; // tailwind sm breakpoint
      if (isMobile) {
        // 64 = mobile bottom nav (56px) + small gap, so the panel clears it
        setPanelStyle({ top: 8, bottom: (keyboardGap > 0 ? 8 : 64) + keyboardGap, height: undefined });
      } else {
        const bottom = 80 + keyboardGap;
        const height = Math.min(540, Math.max(280, vv.height - bottom - 16));
        setPanelStyle({ bottom, height });
      }
    }
    vv.addEventListener("resize", update);
    update();
    return () => vv.removeEventListener("resize", update);
  }, [open]);

  // ─── Guest account-upgrade nudge (existing, unchanged) ────────────────────
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

  // ─── Companion nudge check (read-only GET, non-guest logged-in users) ─────
  useEffect(() => {
    if (!isLoggedIn || !userId || userStatus === "guest") return;
    fetch("/api/companion/nudge", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.nudgeDue) return;
        // Reset for this new pending window
        nudgeAcknowledgedRef.current = false;
        nudgePendingRef.current = true;
        if (companionOpenedRef.current) {
          // Companion was already opened before fetch completed — acknowledge immediately
          acknowledgeNudge();
        } else {
          setNudgePending(true);
        }
      })
      .catch(() => {});
  }, [isLoggedIn, userId, userStatus]);

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

  // ─── Document attachment ────────────────────────────────────────────────────

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setDocError("");
    setDocUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/documents/parse", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setDocError(data.error ?? "Could not read this file.");
        return;
      }
      setAttachedDoc({
        name: data.fileName,
        text: data.text,
        charCount: data.charCount,
        truncated: data.truncated,
        needsOcr: data.needsOcr,
        ocrPagesUsed: data.ocrPagesUsed,
        warnings: data.warnings ?? [],
      });
    } catch {
      setDocError("Upload failed. Please try again.");
    } finally {
      setDocUploading(false);
    }
  }

  function removeAttachedDoc() {
    setAttachedDoc(null);
    setDocError("");
  }

  // ─── Chat dispatch ─────────────────────────────────────────────────────────

  async function dispatchChat(text: string) {
    if (loading) return;
    const userMsg: Message = { role: "user", content: text, attachedDocName: attachedDoc?.name };
    const next = [...messages, userMsg];
    const docToSend = attachedDoc;
    setMessages(next);
    setInput("");
    setAttachedDoc(null);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          context: { currentSection, dismissedProposals: getDismissedProposals() },
          conversationHistory: messages
            .filter((m) => !m.council)
            .map((m) => ({ role: m.role, content: m.content })),
          attachedDocument: docToSend ? { name: docToSend.name, text: docToSend.text } : undefined,
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
          proposal: data.proposal,
          proposalStatus: data.proposal ? "pending" : undefined,
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

  // ─── Profile proposal actions ─────────────────────────────────────────────

  function setMessageProposalStatus(messageIndex: number, status: "accepted" | "dismissed") {
    setMessages((prev) =>
      prev.map((m, i) => (i === messageIndex ? { ...m, proposalStatus: status } : m))
    );
  }

  async function acceptProposal(messageIndex: number, proposal: ProfileProposal) {
    if (proposalLoading) return;
    setProposalLoading(true);
    try {
      const res = await fetch("/api/self/profile-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setMessageProposalStatus(messageIndex, "accepted");
        window.dispatchEvent(new CustomEvent("charaivati:profile-updated", { detail: data.profile }));
      } else {
        setMessageProposalStatus(messageIndex, "dismissed");
      }
    } catch {
      setMessageProposalStatus(messageIndex, "dismissed");
    } finally {
      setProposalLoading(false);
    }
  }

  function dismissProposal(messageIndex: number, proposal: ProfileProposal) {
    addDismissedProposal(proposal.id);
    setMessageProposalStatus(messageIndex, "dismissed");
  }

  // ─── User actions ──────────────────────────────────────────────────────────

  function sendMessage() {
    const text = input.trim();
    if (loading) return;
    if (!text && !attachedDoc) return;
    dispatchChat(text || `Take a look at this document: ${attachedDoc?.name}`);
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
          onClick={() => nudgePendingRef.current ? openCompanion(true) : setOpen(true)}
          aria-label="Open Charaivati guide"
          className="fixed bottom-20 right-6 z-[110] flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 shadow-lg hover:bg-indigo-500 transition-colors"
        >
          <MessageCircle className="h-6 w-6 text-white" />
          {nudgePending && (
            <span
              aria-label="New message from guide"
              style={{
                position: "absolute",
                top: 2,
                right: 2,
                width: 11,
                height: 11,
                borderRadius: "50%",
                background: "#ef4444",
                border: "2px solid #4f46e5",
                display: "block",
                pointerEvents: "none",
              }}
            />
          )}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          ref={panelRef}
          className="fixed inset-x-2 sm:inset-x-auto sm:right-6 sm:w-[380px] z-[110] flex flex-col rounded-xl border border-gray-800 bg-gray-950 shadow-2xl"
          style={{ top: panelStyle.top, bottom: panelStyle.bottom, height: panelStyle.height }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
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
          <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
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
                      {m.proposal && (
                        <ProposalCard
                          proposal={m.proposal}
                          status={m.proposalStatus ?? "pending"}
                          loading={proposalLoading}
                          onAccept={() => acceptProposal(i, m.proposal!)}
                          onDismiss={() => dismissProposal(i, m.proposal!)}
                        />
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
                    <div className="flex flex-col items-end max-w-[80%]">
                      {m.attachedDocName && (
                        <div className="flex items-center gap-1 text-xs text-indigo-200 mb-1">
                          <FileText className="h-3 w-3" />
                          {m.attachedDocName}
                        </div>
                      )}
                      <div className="rounded-2xl px-3 py-2 text-sm leading-relaxed bg-indigo-600 text-white rounded-br-sm">
                        {m.content}
                      </div>
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
            {(attachedDoc || docUploading || docError) && (
              <div className="px-3 pt-2.5">
                {docUploading && (
                  <div className="flex items-center gap-2 text-xs text-gray-400 rounded-lg bg-gray-800 px-2.5 py-1.5">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    Reading document…
                  </div>
                )}
                {!docUploading && attachedDoc && (
                  <div className="flex items-center gap-2 text-xs text-gray-300 rounded-lg bg-gray-800 px-2.5 py-1.5">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                    <span className="truncate flex-1">{attachedDoc.name}</span>
                    <span className="text-gray-500 shrink-0">{attachedDoc.charCount.toLocaleString()} chars</span>
                    <button
                      onClick={removeAttachedDoc}
                      aria-label="Remove attachment"
                      className="text-gray-500 hover:text-gray-300 shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {!docUploading && attachedDoc?.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-yellow-500 mt-1">{w}</p>
                ))}
                {docError && <p className="text-xs text-red-400 mt-1">{docError}</p>}
              </div>
            )}
            <div className="px-3 pt-3 pb-1.5 flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={handleFileSelected}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={docUploading || loading}
                aria-label="Attach a document"
                title="Attach a PDF or Word document"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 disabled:opacity-40 transition-colors"
              >
                <Paperclip className="h-4 w-4" />
              </button>
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
                disabled={loading || (!input.trim() && !attachedDoc)}
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
