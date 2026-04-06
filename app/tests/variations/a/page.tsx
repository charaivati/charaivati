"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";

const STORAGE_KEY = "charaivati_test_ratings";

// Static emotion → personality type mapping
// 4 types: Seeker (inner peace/wisdom), Connector (relationships/service),
//           Builder (ambition/action), Maker (wealth/enterprise)
const EMOTION_MAP: Record<string, { type: string; tagline: string; color: string }> = {
  Peace: {
    type: "Seeker",
    tagline: "You seek stillness in a noisy world. Charaivati begins with understanding yourself — your values, your rhythms, your quiet purpose.",
    color: "from-sky-500/20 to-teal-500/10 border-sky-500/40",
  },
  Love: {
    type: "Connector",
    tagline: "Connection is your compass. Your journey starts with the people around you — friendships, community, the ones who matter most.",
    color: "from-rose-500/20 to-pink-500/10 border-rose-500/40",
  },
  Growth: {
    type: "Builder",
    tagline: "You're built to push boundaries. Your path is action, ambition, and becoming more — one layer at a time.",
    color: "from-orange-500/20 to-amber-500/10 border-orange-500/40",
  },
  Money: {
    type: "Maker",
    tagline: "Financial clarity is the foundation of freedom. Charaivati helps you build wealth with purpose, not just numbers.",
    color: "from-yellow-500/20 to-amber-500/10 border-yellow-500/40",
  },
  Purpose: {
    type: "Seeker",
    tagline: "You're asking the right questions. Purpose isn't found — it's built, slowly, through self-knowledge and intentional living.",
    color: "from-violet-500/20 to-indigo-500/10 border-violet-500/40",
  },
  "Just exploring": {
    type: "Explorer",
    tagline: "The best journeys start with curiosity. There's no wrong door here — every layer of Charaivati has something for you.",
    color: "from-indigo-500/20 to-blue-500/10 border-indigo-500/40",
  },
};

const EMOTIONS = Object.keys(EMOTION_MAP);

function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [comment, setComment] = useState("");
  const [saved, setSaved] = useState(false);

  function save(r: 1 | -1) {
    setRating(r);
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    const entries = all["a"] ?? [];
    entries.push({ rating: r, comment: "", ts: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...all, a: entries }));
    if (!comment) setSaved(true);
  }

  function saveComment() {
    if (!rating) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    const entries: { rating: number; comment: string; ts: number }[] = all["a"] ?? [];
    if (entries.length > 0) entries[entries.length - 1].comment = comment;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...all, a: entries }));
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
    <div className="fixed bottom-5 right-5 bg-gray-900 border border-white/20 rounded-2xl p-4 w-64 shadow-xl z-50 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-white">Variation A</span>
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
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-indigo-500/50 mb-2"
              />
              <button
                onClick={saveComment}
                className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors"
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

export default function VariationA() {
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  function pick(emotion: string) {
    setSelected(emotion);
    setTimeout(() => setRevealed(true), 80);
  }

  const result = selected ? EMOTION_MAP[selected] : null;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-900/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-lg text-center space-y-10">
        {/* Brand */}
        <div className="space-y-1">
          <p className="text-xs tracking-[0.25em] text-indigo-400 font-medium uppercase">Charaivati</p>
        </div>

        {!revealed ? (
          <>
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-light text-white leading-snug">
                What are you looking for
                <br />
                <span className="font-semibold">today?</span>
              </h1>
              <p className="text-gray-500 text-sm">Pick the one that feels most true right now.</p>
            </div>

            <div className="flex flex-wrap gap-3 justify-center">
              {EMOTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => pick(e)}
                  className={`px-5 py-3 rounded-full border text-sm font-medium transition-all duration-200 ${
                    selected === e
                      ? "bg-indigo-500 border-indigo-400 text-white scale-105"
                      : "bg-white/5 border-white/20 text-gray-300 hover:bg-white/10 hover:border-white/40 hover:text-white"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </>
        ) : (
          result && (
            <div
              className={`rounded-2xl border bg-gradient-to-br p-8 text-left space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ${result.color}`}
            >
              <div>
                <p className="text-xs text-gray-500 mb-1">You chose · {selected}</p>
                <p className="text-white text-lg leading-relaxed">{result.tagline}</p>
              </div>
              <div className="pt-2">
                <Link
                  href="/login"
                  className="inline-block px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors"
                >
                  Begin your journey →
                </Link>
                <button
                  onClick={() => { setSelected(null); setRevealed(false); }}
                  className="ml-4 text-sm text-gray-500 hover:text-gray-300 transition-colors"
                >
                  ← Change
                </button>
              </div>
            </div>
          )
        )}

        <p className="text-xs text-gray-700">
          <Link href="/test" className="hover:text-gray-500 transition-colors">← Back to test dashboard</Link>
        </p>
      </div>

      <FeedbackWidget />
    </div>
  );
}
