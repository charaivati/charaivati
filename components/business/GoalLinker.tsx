"use client";
// components/business/GoalLinker.tsx
// BIZDOC-5: Link / de-link a business idea to the user's AiGoal records.
// Guests see nothing — goals require a logged-in account.

import React, { useCallback, useEffect, useState } from "react";

interface GoalItem {
  id: string;
  title: string;
  archetype: string;
  status: string;
}

interface Props {
  ideaId: string;
  isGuest: boolean;
}

export default function GoalLinker({ ideaId, isGuest }: Props) {
  const [allGoals, setAllGoals] = useState<GoalItem[]>([]);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const [toggling, setToggling] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [goalsRes, linkedRes] = await Promise.all([
        fetch("/api/self/goals", { credentials: "include" }),
        fetch(`/api/business/idea/goals?ideaId=${ideaId}`, { credentials: "include" }),
      ]);
      if (goalsRes.ok) {
        const j = await goalsRes.json();
        setAllGoals(j.goals ?? []);
      }
      if (linkedRes.ok) {
        const j = await linkedRes.json();
        setLinkedIds(new Set((j.goals ?? []).map((g: GoalItem) => g.id)));
      }
    } catch {
      // silent — non-blocking
    } finally {
      setLoading(false);
    }
  }, [ideaId]);

  useEffect(() => {
    if (!isGuest) load();
    else setLoading(false);
  }, [isGuest, load]);

  if (isGuest) return null;

  async function toggle(goalId: string) {
    if (toggling) return;
    setToggling(goalId);
    const isLinked = linkedIds.has(goalId);

    // Optimistic update
    setLinkedIds((prev) => {
      const next = new Set(prev);
      isLinked ? next.delete(goalId) : next.add(goalId);
      return next;
    });

    try {
      const res = await fetch("/api/business/idea/goals", {
        method: isLinked ? "DELETE" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId, goalId }),
      });
      if (!res.ok) throw new Error("request failed");
    } catch {
      // Revert on error
      setLinkedIds((prev) => {
        const next = new Set(prev);
        isLinked ? next.add(goalId) : next.delete(goalId);
        return next;
      });
    } finally {
      setToggling(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-slate-800/40 border border-slate-700/40 p-4 space-y-2 animate-pulse">
        <div className="h-4 w-32 bg-slate-700/60 rounded" />
        {[0, 1].map((i) => <div key={i} className="h-10 bg-slate-700/40 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-slate-800/40 border border-slate-700/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          Link to a Goal
        </span>
        {linkedIds.size > 0 && (
          <span className="text-xs text-indigo-400">{linkedIds.size} linked</span>
        )}
      </div>

      {allGoals.length === 0 ? (
        <p className="text-xs text-slate-500 italic">
          No goals yet.{" "}
          <a href="/self" className="text-indigo-400 underline">
            Add goals in Self
          </a>{" "}
          to connect this idea to your bigger picture.
        </p>
      ) : (
        <div className="space-y-2">
          {allGoals.map((goal) => {
            const linked = linkedIds.has(goal.id);
            const busy = toggling === goal.id;
            return (
              <button
                key={goal.id}
                onClick={() => toggle(goal.id)}
                disabled={!!toggling}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition ${
                  linked
                    ? "bg-indigo-900/30 border-indigo-700/50"
                    : "bg-slate-800/40 border-slate-700/30 hover:border-slate-600"
                } ${busy ? "opacity-50" : ""}`}
              >
                <span
                  className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition ${
                    linked ? "bg-indigo-500 border-indigo-500" : "border-slate-500"
                  }`}
                >
                  {linked && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{goal.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 capitalize">{goal.archetype.toLowerCase()}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
