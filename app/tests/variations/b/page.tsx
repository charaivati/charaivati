"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "charaivati_test_ratings";

const TAGLINES = [
  "You are here for something real.",
  "Every journey starts somewhere.",
  "What matters to you, matters here.",
  "You've always been more than one thing.",
  "Start wherever you are.",
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
    const entries = all["b"] ?? [];
    entries.push({ rating: r, comment: "", ts: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...all, b: entries }));
    if (!comment) setSaved(true);
  }

  function saveComment() {
    if (!rating) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    const entries: { rating: number; comment: string; ts: number }[] = all["b"] ?? [];
    if (entries.length > 0) entries[entries.length - 1].comment = comment;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...all, b: entries }));
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
        <span className="text-sm font-medium text-white">Variation B</span>
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
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-sky-500/50 mb-2"
              />
              <button
                onClick={saveComment}
                className="w-full py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium transition-colors"
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

export default function VariationB() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % TAGLINES.length);
        setVisible(true);
      }, 400);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Very subtle ambient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-950/30 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center space-y-14 max-w-sm">
        {/* Brand mark — minimal */}
        <div>
          <p className="text-xs tracking-[0.3em] text-gray-600 uppercase font-light">Charaivati</p>
        </div>

        {/* Rotating tagline */}
        <div className="h-16 flex items-center justify-center">
          <p
            className="text-2xl sm:text-3xl font-light text-white leading-snug transition-opacity duration-400"
            style={{ opacity: visible ? 1 : 0 }}
          >
            {TAGLINES[index]}
          </p>
        </div>

        {/* Single CTA */}
        <div className="space-y-4">
          <Link
            href="/login"
            className="inline-block px-10 py-4 rounded-full bg-white text-gray-950 font-semibold text-base hover:bg-gray-100 transition-colors shadow-lg"
          >
            Begin
          </Link>
        </div>

        {/* Ghost nav */}
        <p className="text-xs text-gray-800 hover:text-gray-600 transition-colors">
          <Link href="/test">← Test dashboard</Link>
        </p>
      </div>

      <FeedbackWidget />
    </div>
  );
}
