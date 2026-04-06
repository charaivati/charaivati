"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "charaivati_test_ratings";

type RatingEntry = { rating: 1 | -1; comment: string; ts: number };
type AllRatings = Record<string, RatingEntry[]>;

const VARIATIONS = [
  {
    id: "a",
    label: "Variation A — Emotion Picker",
    description:
      'One warm question: "What are you looking for today?" with emotion pills. Maps to one of 4 personality types in the background.',
    color: "from-violet-600/20 to-indigo-600/10 border-violet-500/30",
    badge: "bg-violet-500/20 text-violet-300",
  },
  {
    id: "b",
    label: "Variation B — Zero Friction",
    description:
      "No questions asked. Rotating taglines that make the user feel seen. Single CTA: Begin. Purest, most minimalist experience.",
    color: "from-sky-600/20 to-blue-600/10 border-sky-500/30",
    badge: "bg-sky-500/20 text-sky-300",
  },
  {
    id: "c",
    label: "Variation C — Free Text AI",
    description:
      '"What do you want from life?" Open input → AI reads it and responds warmly with a suggested starting point. Highest engagement risk.',
    color: "from-emerald-600/20 to-teal-600/10 border-emerald-500/30",
    badge: "bg-emerald-500/20 text-emerald-300",
  },
  {
    id: "d",
    label: "Variation D — Character Vignettes",
    description:
      "4 real-feeling character cards (Aryan, Priya, Rajan, Meera). User picks the one they relate to. Story-driven, human, zero abstraction.",
    color: "from-amber-600/20 to-orange-600/10 border-amber-500/30",
    badge: "bg-amber-500/20 text-amber-300",
  },
];

function StarBar({ count, total }: { count: number; total: number }) {
  if (total === 0) return <span className="text-gray-600 text-xs">No ratings yet</span>;
  const pct = Math.round((count / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function TestDashboard() {
  const [ratings, setRatings] = useState<AllRatings>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setRatings(JSON.parse(raw));
    } catch {}
  }, []);

  function clearRatings() {
    localStorage.removeItem(STORAGE_KEY);
    setRatings({});
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-12">
      <div className="max-w-3xl mx-auto space-y-10">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-mono bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
              INTERNAL TEST
            </span>
            <span className="text-xs text-gray-500">Not public</span>
          </div>
          <h1 className="text-3xl font-bold text-white mt-3">Landing Page A/B Test</h1>
          <p className="text-gray-400 mt-2 leading-relaxed max-w-xl">
            New users often don't know where to start. These four variations test different ways
            to welcome someone who just wants a{" "}
            <em>quiet, meaningful life</em> — mapping them to one of 4 personality types without
            asking abstract questions.
          </p>
          <p className="text-gray-500 text-sm mt-1">
            Open each variation, imagine you're a first-time visitor, then rate it below.
          </p>
        </div>

        {/* Cards */}
        <div className="space-y-4">
          {VARIATIONS.map((v) => {
            const entries: RatingEntry[] = ratings[v.id] ?? [];
            const ups = entries.filter((e) => e.rating === 1).length;
            const downs = entries.filter((e) => e.rating === -1).length;
            const total = entries.length;
            const lastComment = entries
              .filter((e) => e.comment)
              .slice(-1)[0]?.comment;

            return (
              <div
                key={v.id}
                className={`rounded-2xl border bg-gradient-to-br p-5 ${v.color}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${v.badge}`}
                      >
                        /{v.id.toUpperCase()}
                      </span>
                      <h2 className="font-semibold text-white">{v.label}</h2>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed mt-1">
                      {v.description}
                    </p>
                  </div>
                  <Link
                    href={`/tests/variations/${v.id}`}
                    className="shrink-0 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors"
                  >
                    Open →
                  </Link>
                </div>

                {/* Ratings summary */}
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-400">👍 {ups}</span>
                      <span className="text-red-400">👎 {downs}</span>
                      <span className="text-gray-500 text-xs">({total} rating{total !== 1 ? "s" : ""})</span>
                    </div>
                    {total > 0 && (
                      <div className="flex-1">
                        <StarBar count={ups} total={total} />
                      </div>
                    )}
                  </div>
                  {lastComment && (
                    <p className="text-xs text-gray-500 mt-2 italic">
                      Latest: &ldquo;{lastComment}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <p className="text-xs text-gray-600">Ratings stored in localStorage on this device only.</p>
          <button
            onClick={clearRatings}
            className="text-xs text-gray-600 hover:text-red-400 transition-colors"
          >
            Clear all ratings
          </button>
        </div>
      </div>
    </div>
  );
}
