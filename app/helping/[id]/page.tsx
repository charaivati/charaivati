"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { X, Heart, Users } from "lucide-react";
import InitiativePostsBlock from "@/components/initiative/InitiativePostsBlock";

type HelpingAction = { id: string; title: string; order: number };
type HelpingObjective = { id: string; title: string; order: number; actions: HelpingAction[] };
type HelpingMetric = { id: string; label: string; targetNumber: number; currentNumber: number; unit: string | null };

type Initiative = {
  id: string;
  pageId: string;
  cause: string | null;
  targetGroup: string | null;
  location: string | null;
  awarenessText: string | null;
  acceptDonations: boolean;
  donationMessage: string | null;
  objectives: HelpingObjective[];
  metrics: HelpingMetric[];
  page: {
    title: string;
    owner: { name: string | null; avatarUrl: string | null } | null;
  };
};

export default function HelpingInitiativePublicPage() {
  const { id } = useParams<{ id: string }>();
  const [initiative, setInitiative] = useState<Initiative | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDonate, setShowDonate] = useState(false);
  const [joinToast, setJoinToast] = useState(false);

  useEffect(() => {
    fetch(`/api/helping-initiative/by-page/${id}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setInitiative(d.initiative); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  function handleJoin() {
    setJoinToast(true);
    setTimeout(() => setJoinToast(false), 3000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    );
  }

  if (!initiative) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-red-400 text-sm">Initiative not found.</p>
      </div>
    );
  }

  const { page, cause, targetGroup, location, awarenessText, acceptDonations, donationMessage, objectives, metrics } = initiative;

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Join toast */}
      {joinToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-teal-700 text-white text-sm px-5 py-2.5 rounded-full shadow-lg">
          Joined! ✓
        </div>
      )}

      {/* Donate modal */}
      {showDonate && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowDonate(false)}>
          <div
            className="relative w-full max-w-md bg-gray-900 rounded-2xl border border-gray-700 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setShowDonate(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold text-teal-300">Support this Initiative</h3>
            <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
              {donationMessage || "No donation details provided yet."}
            </p>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-10">

        {/* ── Above the fold ── */}
        <div className="space-y-5">

          {/* Title + creator */}
          <div>
            <h1 className="text-[26px] font-bold text-white leading-tight">{page.title}</h1>
            {page.owner?.name && (
              <p className="text-sm text-gray-500 mt-1">by {page.owner.name}</p>
            )}
          </div>

          {/* Cause chips */}
          <div className="flex flex-wrap gap-2">
            {cause && (
              <span className="px-3 py-1 rounded-full text-sm bg-teal-900/60 border border-teal-700/50 text-teal-200">
                {cause}
              </span>
            )}
            {targetGroup && (
              <span className="px-3 py-1 rounded-full text-sm bg-gray-800 border border-gray-700 text-gray-300">
                👥 {targetGroup}
              </span>
            )}
            {location && (
              <span className="px-3 py-1 rounded-full text-sm bg-gray-800 border border-gray-700 text-gray-300">
                📍 {location}
              </span>
            )}
          </div>

          {/* Impact metrics */}
          {metrics.length > 0 && (
            <div className="space-y-3">
              {metrics.map((m) => {
                const pct = m.targetNumber > 0 ? Math.min(100, (m.currentNumber / m.targetNumber) * 100) : 0;
                return (
                  <div key={m.id} className="p-4 rounded-xl bg-gray-900 border border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white">{m.label}</span>
                      <span className="text-sm font-bold text-teal-300">
                        {m.currentNumber.toLocaleString()}
                        {m.targetNumber > 0 && (
                          <span className="font-normal text-gray-500"> / {m.targetNumber.toLocaleString()}{m.unit ? ` ${m.unit}` : ""}</span>
                        )}
                      </span>
                    </div>
                    {m.targetNumber > 0 && (
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* CTA buttons */}
          <div className="flex gap-3">
            {acceptDonations && (
              <button
                onClick={() => setShowDonate(true)}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-medium transition-all"
              >
                <Heart className="w-4 h-4" />
                Donate / Support
              </button>
            )}
            <button
              onClick={handleJoin}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-teal-600 text-teal-300 hover:bg-teal-900/30 font-medium transition-all"
            >
              <Users className="w-4 h-4" />
              Join / Follow
            </button>
          </div>
        </div>

        {/* ── Below the fold ── */}

        {/* Objectives */}
        {objectives.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[17px] font-bold text-teal-300 border-b border-gray-800 pb-2">Objectives</h2>
            {objectives.map((obj) => (
              <div key={obj.id} className="p-4 rounded-xl bg-gray-900 border border-gray-800">
                <p className="font-medium text-white mb-2">{obj.title}</p>
                {obj.actions.length > 0 && (
                  <ul className="space-y-1.5 pl-2">
                    {obj.actions.map((action) => (
                      <li key={action.id} className="flex items-center gap-2 text-sm text-gray-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0" />
                        {action.title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Awareness */}
        {awarenessText && (
          <section className="space-y-3">
            <h2 className="text-[17px] font-bold text-teal-300 border-b border-gray-800 pb-2">Why This Matters</h2>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{awarenessText}</p>
          </section>
        )}

        {/* Posts feed */}
        <section>
          <InitiativePostsBlock
            pageId={initiative.pageId}
            isCreator={false}
            accentColor="#0d9488"
            theme="dark"
          />
        </section>

      </div>
    </div>
  );
}
