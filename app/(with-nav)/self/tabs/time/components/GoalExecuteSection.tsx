'use client';

import { useEffect, useRef, useState } from 'react';
import { ExecuteBlock } from './ExecuteBlock';
import type { AiGoalWithPlan } from './ExecuteBlock';
import type { ExecutionPlan } from '@/lib/site/executionPlanTypes';

// ─── Archetype icons ──────────────────────────────────────────────────────────

export const ARCHETYPE_ICON: Record<string, string> = {
  LEARN:   '📚',
  BUILD:   '🏗️',
  EXECUTE: '⚡',
  CONNECT: '🤝',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActiveGoal  = AiGoalWithPlan & { updatedAt: string };
type PendingGoal = { id: string; title: string; archetype: string; updatedAt: string };

// ─── Hook: fetch all active goals (with or without execution plans) ──────────

export function useActiveGoals() {
  const [goals, setGoals]          = useState<ActiveGoal[]>([]);
  const [pendingGoals, setPending] = useState<PendingGoal[]>([]);
  const [loading, setLoading]      = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/self/goals', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const all    = (data.goals ?? []) as any[];
        const byDate = (a: { updatedAt: string }, b: { updatedAt: string }) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        const active = all.filter(g => g.status === 'ACTIVE' && g.executionPlan) as ActiveGoal[];
        const noPlan = all.filter(g => g.status === 'ACTIVE' && !g.executionPlan) as PendingGoal[];
        setGoals(active.sort(byDate));
        setPending(noPlan.sort(byDate));
      })
      .catch(() => { setGoals([]); setPending([]); })
      .finally(() => setLoading(false));
  }, []);

  return { goals, setGoals, pendingGoals, loading };
}

// ─── Goals-at-a-glance strip ─────────────────────────────────────────────────

function GoalsAtAGlanceStrip({
  goals, expandedId, pinnedId, onSelect,
}: {
  goals: ActiveGoal[];
  expandedId: string | null;
  pinnedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (goals.length === 0) return null;
  return (
    <div className="flex gap-2 flex-wrap px-5 pt-4 pb-1">
      {goals.map(g => {
        const isExpanded = g.id === expandedId;
        const isPinned   = g.id === pinnedId;
        const phase      = g.currentPhaseIndex + 1;
        const total      = g.executionPlan.phases.length;
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onSelect(g.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              isExpanded
                ? 'bg-indigo-600/20 border border-indigo-500/50 text-indigo-300'
                : 'bg-gray-800/60 border border-gray-700/50 text-gray-400 hover:text-gray-200 hover:border-gray-600'
            }`}
          >
            <span>{ARCHETYPE_ICON[g.archetype] ?? '🎯'}</span>
            <span className="max-w-[120px] truncate">{g.title}</span>
            {isPinned && <span className="text-yellow-400">★</span>}
            <span className={`text-[10px] tabular-nums ${isExpanded ? 'text-indigo-400' : 'text-gray-600'}`}>
              {phase}/{total}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Collapsible goal wrapper ─────────────────────────────────────────────────

function CollapsibleGoalBlock({
  goal, expanded, pinned, showFocus,
  onToggle, onPin, onFocus, onPlanUpdate,
}: {
  goal: ActiveGoal;
  expanded: boolean;
  pinned: boolean;
  showFocus: boolean;
  onToggle: () => void;
  onPin: () => void;
  onFocus: () => void;
  onPlanUpdate: (plan: ExecutionPlan) => void;
}) {
  const phase      = goal.currentPhaseIndex + 1;
  const total      = goal.executionPlan.phases.length;
  const nextAction = goal.executionPlan.nextAction;

  return (
    <div className="border-b border-gray-800/60 last:border-b-0">
      {/* ── Header (always visible) ── */}
      <div className="flex items-start justify-between gap-3 px-5 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm">{ARCHETYPE_ICON[goal.archetype] ?? '🎯'}</span>
            <span className="text-sm font-semibold text-white truncate">{goal.title}</span>
            <span className="text-[10px] text-gray-500 bg-gray-800/80 px-1.5 py-0.5 rounded-full">
              Phase {phase}/{total}
            </span>
            {goal.supportingArchetypes.slice(0, 3).map(a => (
              <span key={a} className="text-[10px] text-gray-600" title={a}>
                {ARCHETYPE_ICON[a] ?? ''}
              </span>
            ))}
          </div>
          {!expanded && (
            <p className="text-xs text-gray-500 mt-1 truncate">→ {nextAction.text}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {showFocus && (
            <button type="button" onClick={onFocus}
              className="text-[10px] px-2 py-1 rounded-lg bg-gray-800/60 text-gray-500
                hover:text-indigo-300 hover:bg-indigo-950/40 transition-colors">
              Focus
            </button>
          )}
          <button type="button" onClick={onPin}
            title={pinned ? 'Unpin' : 'Pin as default expanded'}
            className={`p-1.5 rounded-lg transition-colors text-sm ${
              pinned ? 'text-yellow-400 hover:text-yellow-300' : 'text-gray-600 hover:text-gray-300'
            }`}>
            📌
          </button>
          <button type="button" onClick={onToggle}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 transition-colors text-xs">
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* ── Expanded: full ExecuteBlock ── */}
      {expanded && (
        <div className="border-t border-gray-800/60">
          <ExecuteBlock goal={goal} onPlanUpdate={onPlanUpdate} />
        </div>
      )}
    </div>
  );
}

// ─── localStorage keys ────────────────────────────────────────────────────────

const LS_EXPANDED = 'charaivati.time.expandedGoalId';
const LS_PINNED   = 'charaivati.time.pinnedGoalId';

// ─── GoalExecuteSection ───────────────────────────────────────────────────────
// Self-contained: fetches goals, manages expand/pin state, renders blocks.
// Optionally accepts focusId (from URL) and onFocusChange (to update URL).

export type GoalExecuteSectionProps = {
  goalId?:        string;             // scroll-to + expand on load
  focusId?:       string;             // focus mode filter
  onFocusChange?: (id: string | null) => void;  // update URL; omit to hide Focus button
};

export function GoalExecuteSection({ goalId, focusId, onFocusChange }: GoalExecuteSectionProps) {
  const { goals, setGoals, pendingGoals, loading } = useActiveGoals();

  const [expandedId, setExpandedId] = useState<string | null>(() => {
    try { return localStorage.getItem(LS_EXPANDED); } catch { return null; }
  });
  const [pinnedId, setPinnedId] = useState<string | null>(() => {
    try { return localStorage.getItem(LS_PINNED); } catch { return null; }
  });

  const goalRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Resolve default expanded goal after load
  useEffect(() => {
    if (goals.length === 0) return;
    if (goalId && goals.some(g => g.id === goalId)) { setExpandedId(goalId); return; }
    if (expandedId && goals.some(g => g.id === expandedId)) return;
    if (pinnedId  && goals.some(g => g.id === pinnedId))  { setExpandedId(pinnedId); return; }
    setExpandedId(goals[0].id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, goalId]);

  // Scroll to goalId on load
  useEffect(() => {
    if (!goalId || goals.length === 0) return;
    const ref = goalRefs.current[goalId];
    if (ref) setTimeout(() => ref.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
  }, [goalId, goals]);

  // Persist expandedId
  useEffect(() => {
    try {
      if (expandedId) localStorage.setItem(LS_EXPANDED, expandedId);
      else            localStorage.removeItem(LS_EXPANDED);
    } catch {}
  }, [expandedId]);

  function handleToggle(id: string) {
    setExpandedId(prev => prev === id ? null : id);
  }

  function handlePin(id: string) {
    const next = pinnedId === id ? null : id;
    setPinnedId(next);
    try {
      if (next) localStorage.setItem(LS_PINNED, next);
      else      localStorage.removeItem(LS_PINNED);
    } catch {}
    if (next) setExpandedId(next);
  }

  function handleSelectFromStrip(id: string) {
    setExpandedId(prev => prev === id ? null : id);
    const ref = goalRefs.current[id];
    if (ref) setTimeout(() => ref.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  function handlePlanUpdate(id: string, plan: ExecutionPlan) {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, executionPlan: plan } : g));
  }

  const focusGoal   = focusId ? goals.find(g => g.id === focusId) : null;
  const goalsToShow = focusId ? (focusGoal ? [focusGoal] : []) : goals;

  if (loading) {
    return (
      <div className="px-5 py-8 text-center space-y-3">
        <div className="w-5 h-5 rounded-full border-2 border-indigo-500/40 border-t-indigo-500 animate-spin mx-auto" />
        <p className="text-sm text-gray-500">Loading your goals…</p>
      </div>
    );
  }

  if (goals.length === 0 && pendingGoals.length === 0) {
    return null; // Nothing to show — let caller render empty state if needed
  }

  return (
    <div>
      {/* Goals-at-a-glance strip */}
      {goals.length > 0 && !focusId && (
        <GoalsAtAGlanceStrip
          goals={goals}
          expandedId={expandedId}
          pinnedId={pinnedId}
          onSelect={handleSelectFromStrip}
        />
      )}

      {/* Execute blocks */}
      {goalsToShow.length > 0 && (
        <div className="divide-y divide-gray-800/40">
          {goalsToShow.map(g => (
            <div key={g.id} ref={el => { goalRefs.current[g.id] = el; }}>
              <CollapsibleGoalBlock
                goal={g}
                expanded={expandedId === g.id}
                pinned={pinnedId === g.id}
                showFocus={!!onFocusChange}
                onToggle={() => handleToggle(g.id)}
                onPin={() => handlePin(g.id)}
                onFocus={() => onFocusChange?.(focusId ? null : g.id)}
                onPlanUpdate={(plan) => handlePlanUpdate(g.id, plan)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Goals whose plans are still generating */}
      {!focusId && pendingGoals.length > 0 && (
        <div className="px-5 py-2 space-y-2">
          {pendingGoals.map(g => (
            <div key={g.id} className="flex items-center gap-3 py-2">
              <div className="w-4 h-4 rounded-full border-2 border-indigo-500/40 border-t-indigo-500 animate-spin shrink-0" />
              <div>
                <p className="text-sm text-white font-medium">{g.title}</p>
                <p className="text-xs text-gray-500">Execution plan generating — refresh in a moment.</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
