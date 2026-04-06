"use client";
import React, { useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "charaivati_test_ratings";

function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [comment, setComment] = useState("");
  const [saved, setSaved] = useState(false);

  function save(r: 1 | -1) {
    setRating(r);
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    const entries = all["c"] ?? [];
    entries.push({ rating: r, comment: "", ts: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...all, c: entries }));
    if (!comment) setSaved(true);
  }

  function saveComment() {
    if (!rating) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    const entries: { rating: number; comment: string; ts: number }[] = all["c"] ?? [];
    if (entries.length > 0) entries[entries.length - 1].comment = comment;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...all, c: entries }));
    setSaved(true);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm px-3 py-2 rounded-full backdrop-blur-sm transition-colors z-50"
      >
        Rate this page
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 bg-gray-900 border border-white/20 rounded-2xl p-4 w-64 shadow-xl z-50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-white">Variation C</span>
        <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white text-xs">✕</button>
      </div>
      {saved ? (
        <p className="text-emerald-400 text-sm text-center py-2">Thanks for the feedback!</p>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-3">How did this feel?</p>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => save(1)}
              className={`flex-1 py-2 rounded-lg text-lg transition-all ${rating === 1 ? "bg-emerald-500/30 border border-emerald-500" : "bg-white/5 hover:bg-white/10 border border-white/10"}`}
            >
              👍
            </button>
            <button
              onClick={() => save(-1)}
              className={`flex-1 py-2 rounded-lg text-lg transition-all ${rating === -1 ? "bg-red-500/30 border border-red-500" : "bg-white/5 hover:bg-white/10 border border-white/10"}`}
            >
              👎
            </button>
          </div>
          {rating !== null && (
            <>
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="One-line thought... (optional)"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-emerald-500/50 mb-2"
              />
              <button
                onClick={saveComment}
                className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors"
              >
                Submit
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

type Phase = "idle" | "loading" | "done" | "error";

export default function VariationC() {
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [response, setResponse] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || phase === "loading") return;
    setPhase("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/tests/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input.trim() }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Request failed");
      }

      const data = await res.json();
      setResponse(data.response ?? "");
      setPhase("done");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong");
      setPhase("error");
    }
  }

  function reset() {
    setInput("");
    setPhase("idle");
    setResponse("");
    setErrorMsg("");
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Ambient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-950/30 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-lg space-y-10">
        {/* Brand */}
        <div className="text-center">
          <p className="text-xs tracking-[0.25em] text-emerald-400/70 font-medium uppercase">Charaivati</p>
        </div>

        {phase === "idle" || phase === "loading" || phase === "error" ? (
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h1 className="text-3xl sm:text-4xl font-light text-white">
                What do you want
                <br />
                <span className="font-semibold">from life?</span>
              </h1>
              <p className="text-gray-500 text-sm">Write anything. There&apos;s no wrong answer.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="I want to feel less lost. I want to build something meaningful. I want my family to be proud…"
                rows={4}
                className="w-full bg-white/5 border border-white/15 rounded-2xl px-5 py-4 text-white placeholder-gray-600 text-sm leading-relaxed outline-none focus:border-emerald-500/50 resize-none transition-colors"
                disabled={phase === "loading"}
              />

              {phase === "error" && (
                <p className="text-red-400 text-xs text-center">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={!input.trim() || phase === "loading"}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                {phase === "loading" ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Thinking…
                  </>
                ) : (
                  "Send →"
                )}
              </button>
            </form>
          </div>
        ) : (
          /* done */
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">You said</p>
              <p className="text-gray-400 text-sm italic leading-relaxed max-w-sm mx-auto">
                &ldquo;{input}&rdquo;
              </p>
            </div>

            <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 rounded-2xl p-6">
              <p className="text-white text-base leading-relaxed">{response}</p>
            </div>

            <div className="text-center space-y-3">
              <Link
                href="/login"
                className="inline-block px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors"
              >
                Begin my journey →
              </Link>
              <div>
                <button
                  onClick={reset}
                  className="text-sm text-gray-600 hover:text-gray-400 transition-colors"
                >
                  ← Try a different answer
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-800 hover:text-gray-600 transition-colors">
          <Link href="/test">← Test dashboard</Link>
        </p>
      </div>

      <FeedbackWidget />
    </div>
  );
}
