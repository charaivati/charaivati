"use client";

import React, { useEffect, useRef, useState } from "react";
import ResultsReport from "@/components/business/ResultsReport";
import StartScreenBatch from "@/components/business/StartScreenBatch";
import LiveScoreDashboard from "@/components/business/LiveScoreDashboard";
import MarketSizingPanel, { type MarketSizingData } from "@/components/business/MarketSizingPanel";
import ValidationTasks from "@/components/business/ValidationTasks";
import GoalLinker from "@/components/business/GoalLinker";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Provisional {
  scores: Record<string, number>;
  provenance: Record<string, "local_estimate" | "senior_reviewed">;
  assessorReasons: Record<string, string>;
  overallScore: number;
}

interface TurnResponse {
  question: string;
  questionKey: string;
  dim: string;
  done: boolean;
  provisional: Provisional;
  tier: string;
  turnNum: number;
  reaction?: string | null;
  marketSizingPending?: boolean;
}

interface FinalResult {
  scores: Record<string, number>;
  overallScore: number;
  report: { verdict: string; nextSteps: string[]; rating: number };
  tier: "senior" | "local";
  dimProvenance: Record<string, "local_estimate" | "senior_reviewed">;
}

interface ConvTurn {
  role: "user" | "assistant" | "reaction";
  content: string;
  tier?: string;
  dim?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

const SESSION_KEY = "biz_idea_id";

export default function IdeaPage() {
  // Idea creation state
  const [ideaId, setIdeaId] = useState<string | null>(null);
  const [ideaTitle, setIdeaTitle] = useState("");
  const [ideaDescription, setIdeaDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>(undefined);
  const [isGuest, setIsGuest] = useState(false);

  // Interview state
  const [conversation, setConversation] = useState<ConvTurn[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [currentDim, setCurrentDim] = useState<string>("");
  const [userInput, setUserInput] = useState("");
  const [interviewing, setInterviewing] = useState(false);
  const [interviewDone, setInterviewDone] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  // Market sizing (BIZDOC-4)
  const [marketSizing, setMarketSizing] = useState<MarketSizingData | null>(null);
  const [marketSizingPending, setMarketSizingPending] = useState(false);

  // On mount: restore market sizing (and idea meta) from DB if a prior session exists.
  // This makes persisted slider adjustments survive page refreshes.
  useEffect(() => {
    try {
      const storedId = sessionStorage.getItem(SESSION_KEY);
      if (!storedId) return;
      fetch(`/api/business/idea?ideaId=${storedId}`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((idea) => {
          if (!idea || idea.error) {
            sessionStorage.removeItem(SESSION_KEY);
            return;
          }
          setIdeaId(idea.id);
          setIdeaTitle(idea.title ?? "");
          setIdeaDescription(idea.description ?? "");
          setIsGuest(!idea.userId);
          if (idea.marketSizing) {
            setMarketSizing(idea.marketSizing as MarketSizingData);
          }
          if ((idea.interviewState as any)?.done) {
            setInterviewDone(true);
          }
        })
        .catch(() => {});
    } catch {
      // sessionStorage unavailable (SSR or private browsing edge case)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sidebar / results
  const [provisional, setProvisional] = useState<Provisional>({
    scores: {},
    provenance: {},
    assessorReasons: {},
    overallScore: 0,
  });
  const [finalResult, setFinalResult] = useState<FinalResult | null>(null);

  const convEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    convEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  // Poll for market sizing after it's triggered in the background
  useEffect(() => {
    if (!marketSizingPending || marketSizing || !ideaId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/business/idea?ideaId=${ideaId}`);
        const data = await res.json();
        if (data.marketSizing) {
          setMarketSizing(data.marketSizing as MarketSizingData);
          setMarketSizingPending(false);
        }
      } catch {
        // silent — keep polling
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [marketSizingPending, marketSizing, ideaId]);

  // ── Create idea + start interview ────────────────────────────────────────

  async function handleStart(
    title: string,
    description: string,
    email: string,
    phone: string
  ) {
    setCreating(true);
    setCreateError(undefined);
    try {
      const res = await fetch("/api/business/idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, userEmail: email, userPhone: phone }),
      });
      if (!res.ok) throw new Error("Failed to create idea");
      const idea = await res.json();
      setIdeaId(idea.id);
      setIdeaTitle(title);
      setIdeaDescription(description);
      setIsGuest(!idea.userId);
      try { sessionStorage.setItem(SESSION_KEY, idea.id); } catch {}
      await startInterview(idea.id);
    } catch (e) {
      console.error(e);
      setCreateError("Failed to start. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function startInterview(id: string) {
    setInterviewing(true);
    try {
      const res = await fetch("/api/business/idea/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId: id, userMessage: null }),
      });
      const data: TurnResponse = await res.json();
      if (!data.question) throw new Error((data as any).error ?? "Interview start failed");
      setCurrentQuestion(data.question);
      setCurrentDim(data.dim);
      setConversation([{ role: "assistant", content: data.question, dim: data.dim }]);
      if (data.provisional) setProvisional(data.provisional);
    } catch (e) {
      console.error("Interview start failed:", e);
    } finally {
      setInterviewing(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  // ── Submit user answer ───────────────────────────────────────────────────

  async function handleAnswer() {
    if (!ideaId || !userInput.trim() || interviewing) return;
    const answer = userInput.trim();
    setUserInput("");
    setInterviewing(true);

    setConversation((prev) => [...prev, { role: "user", content: answer }]);

    try {
      const res = await fetch("/api/business/idea/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId, userMessage: answer }),
      });
      const data: TurnResponse = await res.json();
      if (!res.ok) throw new Error((data as any).error ?? "Interview turn error");

      if (data.provisional) setProvisional(data.provisional);

      // BIZDOC-4: track market sizing state
      if (data.marketSizingPending && !marketSizing) {
        setMarketSizingPending(true);
      }

      // Build next conversation entries
      const nextTurns: ConvTurn[] = [];

      // Reaction bubble — one honest sentence from the interviewer
      if (data.reaction) {
        nextTurns.push({ role: "reaction", content: data.reaction });
      }

      if (data.done) {
        setInterviewDone(true);
        nextTurns.push({
          role: "assistant",
          content: "You've answered all the questions. Ready to get your evaluation?",
          tier: data.tier,
        });
      } else {
        setCurrentQuestion(data.question);
        setCurrentDim(data.dim);
        nextTurns.push({ role: "assistant", content: data.question, tier: data.tier, dim: data.dim });
        setTimeout(() => inputRef.current?.focus(), 100);
      }

      setConversation((prev) => [...prev, ...nextTurns]);
    } catch (e) {
      console.error("Interview turn failed:", e);
      setConversation((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong. Please try submitting your answer again.",
        },
      ]);
    } finally {
      setInterviewing(false);
    }
  }

  // ── Finalize ─────────────────────────────────────────────────────────────

  async function handleFinalize() {
    if (!ideaId || finalizing) return;
    setFinalizing(true);
    try {
      const res = await fetch("/api/business/idea/interview/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId }),
      });
      const data: FinalResult = await res.json();
      setFinalResult(data);
    } catch (e) {
      console.error("Finalize failed:", e);
    } finally {
      setFinalizing(false);
    }
  }

  // ── Keyboard shortcut ────────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAnswer();
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (!ideaId) {
    return (
      <StartScreenBatch
        onStart={handleStart}
        loading={creating}
        error={createError}
      />
    );
  }

  if (finalResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <ResultsReport
            title={ideaTitle}
            description={ideaDescription}
            scores={finalResult.scores}
            overallScore={finalResult.overallScore}
            report={finalResult.report}
            ideaId={ideaId}
            tier={finalResult.tier}
            dimProvenance={finalResult.dimProvenance}
          />
          <GoalLinker ideaId={ideaId} isGuest={isGuest} />
        </div>
      </div>
    );
  }

  const answeredCount = conversation.filter((t) => t.role === "user").length;
  const scoreValues = Object.values(provisional.scores ?? {});
  const overallPct = scoreValues.length
    ? Math.round(((provisional.overallScore + 2) / 4) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Conversation panel ── */}
        <div className="lg:col-span-2 flex flex-col">
          {/* Nav */}
          <div className="flex gap-2 mb-5 flex-wrap">
            <a
              href="/self?tab=earn"
              className="px-3 py-1.5 rounded-lg text-xs bg-slate-800/70 hover:bg-slate-700/70 text-slate-300 hover:text-white border border-slate-700 transition"
            >
              ← Back to Earn Tab
            </a>
          </div>

          <div className="mb-4">
            <h1 className="text-2xl font-bold text-white">
              {ideaTitle}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Turn-by-turn evaluation · {answeredCount} answered
            </p>
          </div>

          {/* Conversation bubbles */}
          <div className="flex flex-col gap-3 mb-4 flex-1 overflow-y-auto max-h-[60vh] pr-1">
            {conversation.map((turn, i) => {
              if (turn.role === "reaction") {
                return (
                  <div key={i} className="flex justify-start pl-2">
                    <p className="text-xs text-slate-400 italic max-w-[80%] leading-relaxed">
                      {turn.content}
                    </p>
                  </div>
                );
              }
              return (
                <div
                  key={i}
                  className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      turn.role === "user"
                        ? "bg-purple-600 text-white rounded-br-sm"
                        : "bg-slate-800 text-slate-200 rounded-bl-sm border border-slate-700"
                    }`}
                  >
                    {turn.content}
                    {turn.tier === "senior" && (
                      <span className="block mt-1 text-xs text-indigo-300 opacity-70">
                        ✦ senior reviewed
                      </span>
                    )}
                    {turn.tier === "cloud-degraded" && (
                      <span className="block mt-1 text-xs text-yellow-400 opacity-70">
                        Quick evaluation — senior review unavailable
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {interviewing && (
              <div className="flex justify-start">
                <div className="bg-slate-800 border border-slate-700 px-4 py-3 rounded-2xl rounded-bl-sm">
                  <span className="flex gap-1">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${d * 0.15}s` }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={convEndRef} />
          </div>

          {/* Input area */}
          {!interviewDone && !interviewing && (
            <div className="mt-auto">
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
                <textarea
                  ref={inputRef}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Your answer… (Enter to submit, Shift+Enter for new line)"
                  rows={3}
                  className="w-full p-4 bg-transparent text-white text-sm placeholder-slate-500 resize-none focus:outline-none"
                />
                <div className="flex justify-end px-3 pb-3">
                  <button
                    onClick={handleAnswer}
                    disabled={!userInput.trim()}
                    className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-medium transition"
                  >
                    Send →
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-600 mt-2 text-center">
                Be honest — vague answers get honest ratings.
              </p>
            </div>
          )}

          {/* Finalize button */}
          {interviewDone && !finalizing && (
            <div className="mt-4">
              <button
                onClick={handleFinalize}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl transition text-base"
              >
                Get My Evaluation Results →
              </button>
            </div>
          )}
          {finalizing && (
            <div className="mt-4 text-center text-slate-400 text-sm animate-pulse">
              Compiling your evaluation with senior review…
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="lg:col-span-1 space-y-4">
          <LiveScoreDashboard
            scores={provisional.scores}
            overallScore={provisional.overallScore}
            report={null}
            answeredCount={answeredCount}
            totalQuestions={12}
            provenance={provisional.provenance}
          />

          {/* Market sizing — shown once cloud model returns it */}
          {marketSizing && (
            <MarketSizingPanel
              sizing={marketSizing}
              ideaId={ideaId}
              isGuest={isGuest}
            />
          )}

          {/* Pending indicator while background market-sizing runs */}
          {marketSizingPending && !marketSizing && (
            <div className="rounded-2xl bg-indigo-950/40 border border-indigo-800/30 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                <span className="text-sm text-indigo-300">Sizing the market…</span>
              </div>
              <p className="text-xs text-slate-500">
                Estimating TAM/SAM/SOM for your idea. This takes 15–30 seconds.
              </p>
            </div>
          )}

          {/* Validation tasks — appears once market sizing generates todos */}
          {(marketSizing || marketSizingPending) && ideaId && (
            <div className="rounded-2xl bg-slate-800/40 border border-slate-700/40 p-4">
              <ValidationTasks
                ideaId={ideaId}
                isGuest={isGuest}
                guestSizing={marketSizing}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
