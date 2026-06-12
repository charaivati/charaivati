"use client";

// Listener (Saathi) chat surface for /listen (CONSULT-2). Slim by design:
// no council, no tiers, no nudges, no document attach — bubbles, a rotating
// "listening" indicator, the mind-map sheet, steer chips, proposal cards, and
// the crisis helpline banner. Bubble styling copied from ChatBot.tsx.

import React, { useEffect, useRef, useState } from "react";
import { Map as MapIcon, Send } from "lucide-react";
import type { ProfileProposal } from "@/lib/companion/profileSync";
import type { ConsultInsights } from "@/lib/listener/insights";
import { isMapRequest } from "@/lib/ai/mapTrigger";
import ProposalCard, { getDismissedProposals, addDismissedProposal } from "@/components/chat/ProposalCard";
import PersonaProposalCard, { type PersonaProposal } from "@/components/chat/PersonaProposalCard";
import MindMap, { type MapNodeKey } from "./MindMap";

type ChatMsg =
  | { kind: "user"; content: string }
  | {
      kind: "assistant";
      content: string;
      proposal?: ProfileProposal;
      proposalStatus?: "pending" | "accepted" | "dismissed";
      personaProposal?: PersonaProposal;
      personaProposalStatus?: "pending" | "accepted" | "dismissed";
    }
  | { kind: "chip"; label: string };

const STATUS_LINES = [
  "Listening…",
  "Thinking about what you said…",
  "Taking that in…",
  "Finding the right words…",
];

const NODE_CHIP_LABELS: Record<MapNodeKey, string> = {
  drive: "Drive",
  goal: "Goal",
  skills: "Skills",
  health: "Health",
  environment: "Environment",
  time: "Time",
  funds: "Funds",
  network: "Network",
  energy: "Energy",
};

export default function ListenChat() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState(false);
  const [stage, setStage] = useState(0);
  const [crisis, setCrisis] = useState(false);
  const [insights, setInsights] = useState<ConsultInsights | null>(null);
  const [personalityTopDrive, setPersonalityTopDrive] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Guest-first bootstrap + hydration ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let res = await fetch("/api/listen", { credentials: "include" });
        if (res.status === 401) {
          const g = await fetch("/api/user/guest", { method: "POST", credentials: "include" });
          if (!g.ok) throw new Error("guest_failed");
          res = await fetch("/api/listen", { credentials: "include" });
        }
        const data = await res.json();
        if (cancelled) return;
        if (data?.ok) {
          setStage(data.consultStage ?? 0);
          setInsights(data.insights ?? null);
          setCrisis(data.crisis === true);
          setPersonalityTopDrive(data.personalityTopDrive ?? null);
          setMessages(
            (Array.isArray(data.messages) ? data.messages : []).map((m: { role: string; content: string }) =>
              m.role === "user" ? { kind: "user" as const, content: m.content } : { kind: "assistant" as const, content: m.content }
            )
          );
        }
      } catch {
        if (!cancelled) setBootError(true);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Rotating contextual status lines while waiting (not three dots).
  useEffect(() => {
    if (!loading) return;
    setStatusIdx(0);
    const id = setInterval(() => setStatusIdx((i) => (i + 1) % STATUS_LINES.length), 1500);
    return () => clearInterval(id);
  }, [loading]);

  async function refreshInsights() {
    try {
      const res = await fetch("/api/listen", { credentials: "include" });
      const data = await res.json();
      if (data?.ok) {
        setInsights(data.insights ?? null);
        setStage(data.consultStage ?? 0);
        setCrisis((c) => c || data.crisis === true);
        setPersonalityTopDrive(data.personalityTopDrive ?? null);
      }
    } catch {
      // map shows the last known state — non-critical
    }
  }

  function openMap() {
    setMapOpen(true);
    refreshInsights();
  }

  async function post(body: { message: string; steer?: MapNodeKey; correction?: boolean }) {
    setLoading(true);
    try {
      const res = await fetch("/api/listen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...body, dismissedProposals: getDismissedProposals() }),
      });
      const data = await res.json();
      if (data?.reply) {
        setMessages((prev) => [
          ...prev,
          {
            kind: "assistant",
            content: data.reply,
            proposal: data.proposal,
            proposalStatus: data.proposal ? "pending" : undefined,
            personaProposal: data.personaProposal,
            personaProposalStatus: data.personaProposal ? "pending" : undefined,
          },
        ]);
      }
      if (typeof data?.consultStage === "number") setStage(data.consultStage);
      if (data?.crisis === true) setCrisis(true);
    } catch {
      setMessages((prev) => [
        ...prev,
        { kind: "assistant", content: "I'm having trouble connecting right now. Please try again in a moment." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function send() {
    const text = input.trim();
    if (!text || loading || booting) return;
    if (isMapRequest(text)) {
      setInput("");
      openMap();
      return;
    }
    setInput("");
    setMessages((prev) => [...prev, { kind: "user", content: text }]);
    post({ message: text });
  }

  function steer(node: MapNodeKey, correction?: boolean) {
    if (loading) return;
    setMapOpen(false);
    setMessages((prev) => [
      ...prev,
      { kind: "chip", label: correction ? `You flagged: ${NODE_CHIP_LABELS[node]} — not quite right` : `You chose: ${NODE_CHIP_LABELS[node]}` },
    ]);
    post({ message: "", steer: node, correction });
  }

  // ── Proposal actions — same contract as ChatBot ─────────────────────────────
  function setProposalStatus(index: number, status: "accepted" | "dismissed") {
    setMessages((prev) => prev.map((m, i) => (i === index && m.kind === "assistant" ? { ...m, proposalStatus: status } : m)));
  }

  async function acceptProposal(index: number, proposal: ProfileProposal) {
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
        setProposalStatus(index, "accepted");
        window.dispatchEvent(new CustomEvent("charaivati:profile-updated", { detail: data.profile }));
      } else {
        setProposalStatus(index, "dismissed");
      }
    } catch {
      setProposalStatus(index, "dismissed");
    } finally {
      setProposalLoading(false);
    }
  }

  function dismissProposal(index: number, proposal: ProfileProposal) {
    addDismissedProposal(proposal.id);
    setProposalStatus(index, "dismissed");
  }

  // ── Persona proposal actions (PERSONA-1, admin-only) ────────────────────────
  function setPersonaProposalStatus(index: number, status: "accepted" | "dismissed") {
    setMessages((prev) => prev.map((m, i) => (i === index && m.kind === "assistant" ? { ...m, personaProposalStatus: status } : m)));
  }

  async function acceptPersonaProposal(index: number, proposal: PersonaProposal) {
    if (proposalLoading) return;
    setProposalLoading(true);
    try {
      const res = await fetch("/api/listen/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept", proposal }),
        credentials: "include",
      });
      const data = await res.json();
      setPersonaProposalStatus(index, res.ok && data.ok ? "accepted" : "dismissed");
    } catch {
      setPersonaProposalStatus(index, "dismissed");
    } finally {
      setProposalLoading(false);
    }
  }

  function dismissPersonaProposal(index: number) {
    setPersonaProposalStatus(index, "dismissed");
  }

  return (
    <div className="flex flex-col h-dvh max-w-lg mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-900">
        <h1 className="text-sm font-medium text-gray-300">Saathi</h1>
        <button
          onClick={openMap}
          aria-label="Open your map"
          className="text-gray-500 hover:text-gray-300 p-1.5 rounded-lg border border-gray-800 transition-colors"
        >
          <MapIcon className="h-4 w-4" />
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {booting ? (
          <div className="space-y-3 animate-pulse mt-6">
            <div className="h-10 w-3/5 rounded-2xl bg-gray-900" />
            <div className="h-10 w-2/5 rounded-2xl bg-gray-900 ml-auto" />
            <div className="h-10 w-1/2 rounded-2xl bg-gray-900" />
          </div>
        ) : (
          <>
            {messages.length === 0 && (
              <div className="text-center mt-16 px-6">
                <p className="text-xl text-gray-200 font-light">What&apos;s on your mind?</p>
                <p className="text-xs text-gray-500 mt-3">Type in any language you like — I&apos;ll follow you.</p>
                {bootError && <p className="text-xs text-red-400 mt-4">Couldn&apos;t connect. Check your network and reload.</p>}
              </div>
            )}

            {messages.map((m, i) => {
              if (m.kind === "chip") {
                return (
                  <div key={i} className="flex justify-center">
                    <span className="text-[11px] text-indigo-300/80 border border-indigo-800/40 rounded-full px-2.5 py-0.5">{m.label}</span>
                  </div>
                );
              }
              return (
                <div key={i} className={`flex ${m.kind === "user" ? "justify-end" : "justify-start"}`}>
                  {m.kind === "assistant" ? (
                    <div className="flex flex-col max-w-[80%]">
                      <div className="bg-gray-800 text-gray-100 rounded-2xl rounded-bl-sm px-3 py-2 text-sm leading-relaxed">{m.content}</div>
                      {m.proposal && (
                        <ProposalCard
                          proposal={m.proposal}
                          status={m.proposalStatus ?? "pending"}
                          loading={proposalLoading}
                          onAccept={() => acceptProposal(i, m.proposal!)}
                          onDismiss={() => dismissProposal(i, m.proposal!)}
                        />
                      )}
                      {m.personaProposal && (
                        <PersonaProposalCard
                          proposal={m.personaProposal}
                          status={m.personaProposalStatus ?? "pending"}
                          loading={proposalLoading}
                          onAccept={() => acceptPersonaProposal(i, m.personaProposal!)}
                          onDismiss={() => dismissPersonaProposal(i)}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl px-3 py-2 text-sm leading-relaxed bg-indigo-600 text-white rounded-br-sm max-w-[80%]">
                      {m.content}
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-gray-800 px-4 py-2.5">
                  <span className="text-xs text-gray-400 italic">{STATUS_LINES[statusIdx]}</span>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Crisis helpline banner — persistent once crisis mode is on. Rendered by
          the UI, not the model: model output is not a reliable channel for
          emergency numbers. */}
      {crisis && (
        <div className="mx-4 mb-2 rounded-xl border border-rose-800/50 bg-rose-950/40 px-3 py-2.5">
          <p className="text-xs text-rose-200 leading-relaxed">
            If things feel heavy, you don&apos;t have to carry it alone. Free helplines, any time:{" "}
            <a href="tel:14416" className="font-medium underline underline-offset-2">
              Tele-MANAS 14416
            </a>{" "}
            ·{" "}
            <a href="tel:18005990019" className="font-medium underline underline-offset-2">
              KIRAN 1800-599-0019
            </a>
          </p>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-900 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Say anything…"
            className="flex-1 resize-none rounded-xl bg-gray-900 border border-gray-800 px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-700"
          />
          <button
            onClick={send}
            disabled={loading || booting || !input.trim()}
            aria-label="Send"
            className="rounded-xl bg-indigo-600 disabled:opacity-40 text-white p-2.5 transition-opacity"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      <MindMap open={mapOpen} onClose={() => setMapOpen(false)} insights={insights} stage={stage} onSteer={steer} personalityTopDrive={personalityTopDrive} />
    </div>
  );
}
