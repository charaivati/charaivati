'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, Trash2, RefreshCw } from 'lucide-react';
import { SectionCard } from '@/components/self/shared';
import { useProfile } from '@/lib/ProfileContext';
import { ExecuteBlock } from './ExecuteBlock';
import type { AiGoalWithPlan } from './ExecuteBlock';
import type { ExecutionPlan } from '@/lib/site/executionPlanTypes';

export const ARCHETYPE_ICON: Record<string, string> = {
  LEARN: '📚', BUILD: '🏗️', EXECUTE: '⚡', CONNECT: '🤝',
};

export type ActiveGoal  = AiGoalWithPlan & { updatedAt: string };
type PendingGoal = { id: string; title: string; archetype: string; updatedAt: string };

export function useActiveGoals() {
  const [goals, setGoals]          = useState<ActiveGoal[]>([]);
  const [pendingGoals, setPending] = useState<PendingGoal[]>([]);
  const [loading, setLoading]      = useState(true);
  const [fetchError, setError]     = useState(false);

  function load() {
    setLoading(true); setError(false);
    fetch('/api/self/goals', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(data => {
        const all    = (data.goals ?? []) as any[];
        const byDate = (a: { updatedAt: string }, b: { updatedAt: string }) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        setGoals(all.filter(g => g.status === 'ACTIVE' && g.executionPlan).sort(byDate) as ActiveGoal[]);
        setPending(all.filter(g => g.status === 'ACTIVE' && !g.executionPlan).sort(byDate) as PendingGoal[]);
      })
      .catch(() => { setGoals([]); setPending([]); setError(true); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { goals, setGoals, pendingGoals, setPending, loading, fetchError, retry: load };
}

const LS_SELECTED      = 'charaivati.time.expandedGoalId';
const POLL_INTERVAL_MS = 5_000;
const POLL_MAX         = 12;

const DRIVE_TO_ARCHETYPE: Record<string, string> = {
  learning: 'LEARN', building: 'BUILD', doing: 'EXECUTE', helping: 'CONNECT',
};

export type GoalExecuteSectionProps = {
  goalId?: string;
  focusId?: string;
  onFocusChange?: (id: string | null) => void;
  /** Reactive drives from useSelfState — takes precedence over the static profile snapshot */
  activeDrives?: string[];
  /** Profile goals from useSelfState — shown for guests who have no AI goals yet */
  profileGoals?: { id: string; statement: string; driveId: string }[];
};

export function GoalExecuteSection({ goalId, activeDrives: drivesProp, profileGoals }: GoalExecuteSectionProps) {
  const { goals, setGoals, pendingGoals, setPending, loading, fetchError, retry } = useActiveGoals();
  const { profile } = useProfile();

  // Prefer reactive drivesProp (from useSelfState); fall back to server profile for standalone use (TimeTab)
  const activeDrives: string[] = useMemo(() => {
    if (drivesProp && drivesProp.length > 0) return drivesProp;
    if (!profile) return [];
    if (Array.isArray(profile.drives) && profile.drives.length > 0) return profile.drives;
    if (typeof profile.drive === 'string' && profile.drive) return [profile.drive];
    return [];
  }, [drivesProp, profile]);

  const sectionRef = useRef<HTMLDivElement>(null);
  const retryRef   = useRef(retry);
  useEffect(() => { retryRef.current = retry; });

  // Re-fetch when a new goal is created anywhere (e.g. from GoalsExpanded portal)
  useEffect(() => {
    const handler = () => { pollCountRef.current = 0; retryRef.current(); };
    window.addEventListener('charaivati:goalCreated', handler);
    return () => window.removeEventListener('charaivati:goalCreated', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [open, setOpen]                   = useState(true);
  const [selectedId, setSelectedId]       = useState<string | null>(() => {
    try { return localStorage.getItem(LS_SELECTED); } catch { return null; }
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]           = useState(false);

  // After goal creation, GoalCreationFlow stores the new goalId in localStorage.
  // On first load, read it, auto-select that goal, and scroll this section into view.
  useEffect(() => {
    try {
      const newId = localStorage.getItem('charaivati.scrollToGoal');
      if (!newId) return;
      localStorage.removeItem('charaivati.scrollToGoal');
      setSelectedId(newId);
      setOpen(true);
      setTimeout(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // All goals unified, filtered to selected drives only
  const allGoals = useMemo(() => {
    const activeArchetypes = activeDrives && activeDrives.length > 0
      ? new Set(activeDrives.map(d => DRIVE_TO_ARCHETYPE[d]).filter(Boolean))
      : null;
    return [...goals.map(g => ({ ...g, hasPlan: true as const })),
            ...pendingGoals.map(g => ({ ...g, hasPlan: false as const }))]
      .filter(g => !activeArchetypes || activeArchetypes.has(g.archetype))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [goals, pendingGoals, activeDrives]);

  // Polling
  const pollCountRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPartial   = goals.some(g => (g.executionPlan as { _partial?: boolean })?._partial === true);

  useEffect(() => {
    const needsPoll = pendingGoals.length > 0 || hasPartial;
    if (!needsPoll) { pollCountRef.current = 0; if (pollTimerRef.current) clearTimeout(pollTimerRef.current); return; }
    if (pollCountRef.current >= POLL_MAX) return;
    pollTimerRef.current = setTimeout(() => { pollCountRef.current += 1; retry(); }, POLL_INTERVAL_MS);
    return () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingGoals.length, hasPartial, pendingGoals.map(g => g.id).join(',')]);

  const pollExhausted = pollCountRef.current >= POLL_MAX && pendingGoals.length > 0;

  const [regenerating, setRegenerating] = useState<Record<string, boolean>>({});
  async function handleRegenerate(id: string) {
    setRegenerating(p => ({ ...p, [id]: true }));
    try {
      await fetch('/api/goal-ai/execution-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ goalId: id, step: 'skeleton' }) });
      pollCountRef.current = 0; retry();
      void fetch('/api/goal-ai/execution-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ goalId: id, step: 'tasks' }) })
        .catch(e => console.error('[GoalExecuteSection] tasks failed', e));
    } catch (e) { console.error('[GoalExecuteSection] regenerate failed', e); }
    setRegenerating(p => ({ ...p, [id]: false }));
  }

  // Auto-select: clear when drive filter empties the list, otherwise pick goalId → persisted → newest
  useEffect(() => {
    if (allGoals.length === 0) { setSelectedId(null); return; } // clear stale selection on drive change
    if (goalId && allGoals.some(g => g.id === goalId))         { setSelectedId(goalId); return; }
    if (selectedId && allGoals.some(g => g.id === selectedId)) return;
    setSelectedId(allGoals[0].id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allGoals.map(g => g.id).join(','), goalId]);

  useEffect(() => { try { if (selectedId) localStorage.setItem(LS_SELECTED, selectedId); } catch {} }, [selectedId]);

  // All lookups are constrained to the filtered allGoals — prevents stale goals from showing
  // when a drive is unselected (avoids the goal rendering via unfiltered `goals` array)
  const filteredIds     = new Set(allGoals.map(g => g.id));
  const selectedGoal    = (selectedId && filteredIds.has(selectedId)) ? (goals.find(g => g.id === selectedId) ?? null) : null;
  const selectedPending = (!selectedGoal && selectedId && filteredIds.has(selectedId)) ? (pendingGoals.find(g => g.id === selectedId) ?? null) : null;
  const displayGoal     = selectedGoal ?? (!selectedPending ? (goals.find(g => filteredIds.has(g.id)) ?? null) : null);

  function handlePlanUpdate(plan: ExecutionPlan) {
    const id = (displayGoal ?? selectedGoal)?.id; if (!id) return;
    setGoals(prev => prev.map(g => g.id === id ? { ...g, executionPlan: plan } : g));
  }

  async function handleArchive() {
    const id = selectedId ?? displayGoal?.id; if (!id) return;
    setDeleting(true);
    try {
      await fetch(`/api/self/goals/${id}`, { method: 'DELETE', credentials: 'include' });
      setGoals(p => p.filter(g => g.id !== id));
      setPending(p => p.filter(g => g.id !== id));
      const next = [...goals, ...pendingGoals].filter(g => g.id !== id)[0];
      setSelectedId(next?.id ?? null);
    } catch (e) { console.error('[GoalExecuteSection] archive failed', e); }
    setDeleting(false); setConfirmDelete(false);
  }

  const hasAny = allGoals.length > 0;

  return (
    <div ref={sectionRef}>
    <SectionCard>
      {/* Header */}
      <div
        role="button" tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); } }}
        className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer select-none"
      >
        <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
          <h3 className="text-base font-semibold text-white shrink-0">Execution plan</h3>

          {/* Dropdown — all goals including pending */}
          {!loading && !fetchError && allGoals.length > 0 && (
            <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
              <select
                value={selectedId ?? ''}
                onChange={e => { setSelectedId(e.target.value); setConfirmDelete(false); }}
                className="text-xs bg-gray-800 border border-gray-700/60 rounded-lg px-2.5 py-1
                  text-gray-300 focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[200px] truncate"
              >
                {allGoals.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.hasPlan ? (ARCHETYPE_ICON[g.archetype] ?? '') : '⏳'}{' '}
                    {g.title.length > 26 ? g.title.slice(0, 26) + '…' : g.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(pendingGoals.length > 0 || hasPartial) && (
            <span className="text-[10px] text-indigo-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full border border-indigo-500/60 border-t-indigo-500 animate-spin inline-block" />
              generating
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
          {hasAny && !loading && !fetchError && (
            confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-gray-400">Remove?</span>
                <button type="button" onClick={handleArchive} disabled={deleting}
                  className="text-[11px] px-2 py-0.5 rounded bg-red-900/60 text-red-300 hover:bg-red-800/60 transition-colors disabled:opacity-50">
                  {deleting ? '…' : 'Yes'}
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)}
                  className="text-[11px] px-2 py-0.5 rounded bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors">No</button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)}
                className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )
          )}
          <button type="button" onClick={() => { setOpen(o => !o); setConfirmDelete(false); }}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 transition-colors">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Body */}
      {open && (
        <div style={{ animation: 'sectionOpen 400ms ease both' }}>
          <style>{`@keyframes sectionOpen{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>

          {loading && (
            <div className="border-t border-white/[0.05] px-5 py-8 text-center space-y-3">
              <div className="w-5 h-5 rounded-full border-2 border-indigo-500/40 border-t-indigo-500 animate-spin mx-auto" />
              <p className="text-sm text-gray-500">Loading your goals…</p>
            </div>
          )}

          {!loading && fetchError && (
            <div className="border-t border-white/[0.05] px-5 py-4 flex items-center justify-between">
              <p className="text-xs text-gray-500">Couldn't load execution plans.</p>
              <button type="button" onClick={retry} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Retry</button>
            </div>
          )}

          {/* Selected goal has a plan */}
          {!loading && !fetchError && (selectedGoal ?? displayGoal) && (
            <div className="border-t border-white/[0.05]">
              <ExecuteBlock
                goal={(selectedGoal ?? displayGoal)!}
                onPlanUpdate={handlePlanUpdate}
                enriching={((selectedGoal ?? displayGoal)!.executionPlan as { _partial?: boolean })?._partial === true}
              />
            </div>
          )}

          {/* Selected goal is pending */}
          {!loading && !fetchError && selectedPending && !displayGoal && (
            <div className="border-t border-white/[0.05] px-5 py-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {!pollExhausted && !regenerating[selectedPending.id] && (
                  <div className="w-4 h-4 rounded-full border-2 border-indigo-500/40 border-t-indigo-500 animate-spin shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium truncate">{selectedPending.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{pollExhausted ? 'Generation timed out.' : 'Generating execution plan…'}</p>
                </div>
              </div>
              {(pollExhausted || regenerating[selectedPending.id]) && (
                <button type="button" onClick={() => handleRegenerate(selectedPending.id)} disabled={regenerating[selectedPending.id]}
                  className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors shrink-0 disabled:opacity-50">
                  <RefreshCw className={`w-3 h-3 ${regenerating[selectedPending.id] ? 'animate-spin' : ''}`} />
                  {regenerating[selectedPending.id] ? 'Generating…' : 'Regenerate'}
                </button>
              )}
            </div>
          )}

          {!loading && !fetchError && allGoals.length === 0 && (
            <div className="border-t border-white/[0.05] px-5 py-5 text-center space-y-1.5">
              {!profile && profileGoals && profileGoals.length > 0 ? (
                // Guest with saved profile goals
                <>
                  <p className="text-sm text-gray-400 font-medium">
                    You have {profileGoals.length} goal{profileGoals.length !== 1 ? 's' : ''} saved.
                  </p>
                  <p className="text-xs text-gray-600">
                    <a href="/login" className="underline hover:text-indigo-400 transition-colors">Sign in</a>
                    {' '}to generate an AI execution plan.
                  </p>
                </>
              ) : activeDrives.length > 0 ? (
                // Logged-in: has drives but no goals for them yet
                <p className="text-sm text-gray-500">No goals for your current drives yet — add one above.</p>
              ) : (
                // No drives or no goals at all
                <p className="text-sm text-gray-500">No active goals yet — create one to see your execution plan here.</p>
              )}
            </div>
          )}
        </div>
      )}
    </SectionCard>
    </div>
  );
}
