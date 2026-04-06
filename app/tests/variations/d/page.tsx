"use client";
import React, { useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "charaivati_test_ratings";

const CHARACTERS = [
  {
    id: "aryan",
    name: "Aryan, 28",
    quote: "I just want a quiet, meaningful life. Good health, close friends, a sense of purpose.",
    emoji: "🌿",
    color: "from-sky-500/15 to-teal-500/5 border-sky-500/30 hover:border-sky-400/60",
    activeColor: "from-sky-500/25 to-teal-500/15 border-sky-400",
    welcome:
      "A quiet, meaningful life is one of the most ambitious things you can want — and one of the hardest. Charaivati starts with your Self layer: health, identity, and the relationships that ground you. That's your home base.",
    cta: "Start with Self →",
  },
  {
    id: "priya",
    name: "Priya, 24",
    quote: "I'm building a startup. I need focus, the right network, and to stop wasting time.",
    emoji: "⚡",
    color: "from-orange-500/15 to-amber-500/5 border-orange-500/30 hover:border-orange-400/60",
    activeColor: "from-orange-500/25 to-amber-500/15 border-orange-400",
    welcome:
      "You're already moving — you just need the system to match your pace. Charaivati's Self and Society layers help you set goals with clarity, build the right circles, and cut the noise. Let's make your time count.",
    cta: "Build your system →",
  },
  {
    id: "rajan",
    name: "Rajan, 45",
    quote: "I want to give back. Teach, mentor, leave something behind that matters.",
    emoji: "🕯️",
    color: "from-violet-500/15 to-purple-500/5 border-violet-500/30 hover:border-violet-400/60",
    activeColor: "from-violet-500/25 to-purple-500/15 border-violet-400",
    welcome:
      "The impulse to leave something behind is one of the deepest human drives. Charaivati's Society and State layers are built for people like you — those who want to connect, contribute, and create real impact in their community.",
    cta: "Explore your impact →",
  },
  {
    id: "meera",
    name: "Meera, 31",
    quote: "I want financial freedom. Then I'll figure out the rest.",
    emoji: "🪙",
    color: "from-yellow-500/15 to-amber-500/5 border-yellow-500/30 hover:border-yellow-400/60",
    activeColor: "from-yellow-500/25 to-amber-500/15 border-yellow-400",
    welcome:
      "Financial freedom is a worthy first chapter — and it's more achievable when it's tied to something bigger. Charaivati helps you build toward it with clear goals, intentional skills, and a vision of what 'the rest' actually looks like.",
    cta: "Set your first goal →",
  },
];

function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [comment, setComment] = useState("");
  const [saved, setSaved] = useState(false);

  function save(r: 1 | -1) {
    setRating(r);
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    const entries = all["d"] ?? [];
    entries.push({ rating: r, comment: "", ts: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...all, d: entries }));
    if (!comment) setSaved(true);
  }

  function saveComment() {
    if (!rating) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    const entries: { rating: number; comment: string; ts: number }[] = all["d"] ?? [];
    if (entries.length > 0) entries[entries.length - 1].comment = comment;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...all, d: entries }));
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
        <span className="text-sm font-medium text-white">Variation D</span>
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
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-amber-500/50 mb-2"
              />
              <button
                onClick={saveComment}
                className="w-full py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium transition-colors"
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

export default function VariationD() {
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  function pick(id: string) {
    setSelected(id);
    setTimeout(() => setRevealed(true), 80);
  }

  const character = CHARACTERS.find((c) => c.id === selected);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Ambient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-amber-950/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-2xl space-y-10">
        {/* Brand */}
        <div className="text-center">
          <p className="text-xs tracking-[0.25em] text-amber-400/70 font-medium uppercase">Charaivati</p>
        </div>

        {!revealed ? (
          <>
            <div className="text-center space-y-2">
              <h1 className="text-3xl sm:text-4xl font-light text-white">
                Who do you
                <span className="font-semibold"> relate to most?</span>
              </h1>
              <p className="text-gray-500 text-sm">Pick the person whose story feels closest to yours.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CHARACTERS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => pick(c.id)}
                  className={`text-left p-5 rounded-2xl border bg-gradient-to-br transition-all duration-200 ${
                    selected === c.id ? c.activeColor : c.color
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">{c.emoji}</span>
                    <div>
                      <p className="font-semibold text-white text-sm mb-1">{c.name}</p>
                      <p className="text-gray-400 text-sm leading-relaxed">&ldquo;{c.quote}&rdquo;</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          character && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
              <div className="text-center space-y-1">
                <span className="text-4xl">{character.emoji}</span>
                <p className="text-gray-500 text-sm mt-2">You chose · {character.name}</p>
              </div>

              <div
                className={`rounded-2xl border bg-gradient-to-br p-7 space-y-5 ${character.activeColor}`}
              >
                <p className="text-white text-lg leading-relaxed">{character.welcome}</p>
                <div className="flex items-center gap-4">
                  <Link
                    href="/login"
                    className="inline-block px-6 py-3 rounded-xl bg-white text-gray-950 font-semibold text-sm hover:bg-gray-100 transition-colors"
                  >
                    {character.cta}
                  </Link>
                  <button
                    onClick={() => { setSelected(null); setRevealed(false); }}
                    className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    ← Back
                  </button>
                </div>
              </div>
            </div>
          )
        )}

        <p className="text-center text-xs text-gray-800 hover:text-gray-600 transition-colors">
          <Link href="/test">← Test dashboard</Link>
        </p>
      </div>

      <FeedbackWidget />
    </div>
  );
}
