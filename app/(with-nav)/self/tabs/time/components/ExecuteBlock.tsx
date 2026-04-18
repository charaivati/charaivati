'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Pencil, Check, X, ChevronRight } from 'lucide-react';
import { SECTIONS } from '@/lib/site/capabilityRegistry';
import type { ExecutionPlan, PlanTask, PlanPhase } from '@/lib/site/executionPlanTypes';
import type { GoalArchetype } from '@prisma/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AiGoalWithPlan = {
  id: string;
  title: string;
  archetype: GoalArchetype;
  supportingArchetypes: GoalArchetype[];
  currentPhaseIndex: number;
  executionPlan: ExecutionPlan;
};

type Props = {
  goal: AiGoalWithPlan;
  onPlanUpdate: (plan: ExecutionPlan) => void;
  enriching?: boolean; // true while tasks are being generated (step 2 in flight)
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ARCHETYPE_LABELS: Record<GoalArchetype, string> = {
  LEARN: 'Learn',
  BUILD: 'Build',
  EXECUTE: 'Execute',
  CONNECT: 'Connect',
};

// ─── Section link helper ──────────────────────────────────────────────────────

function SectionPill({ sectionKey }: { sectionKey: string | null }) {
  if (!sectionKey) return null;
  const section = SECTIONS[sectionKey];
  if (!section) return null;

  if (section.status === 'planned' || !section.route) {
    return (
      <span
        title={section.interim ? `${section.interim} (${section.eta})` : `Coming ${section.eta}`}
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-800 text-gray-500 border border-gray-700/60 cursor-default select-none"
      >
        {section.label} · {section.eta ?? 'TBD'}
      </span>
    );
  }

  return (
    <Link
      href={section.route}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 transition-colors"
    >
      Open {section.label} <ChevronRight className="w-3 h-3" />
    </Link>
  );
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  done,
  onToggle,
  editMode,
  onTextChange,
}: {
  task: PlanTask;
  done: boolean;
  onToggle: () => void;
  editMode: boolean;
  onTextChange: (text: string) => void;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <button
        type="button"
        onClick={onToggle}
        className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 border transition-colors ${
          done
            ? 'bg-indigo-500 border-indigo-500'
            : 'border-gray-600 hover:border-indigo-400'
        }`}
      >
        {done && <Check className="w-3 h-3 text-white m-auto" />}
      </button>
      <div className="flex-1 min-w-0 space-y-1">
        {editMode ? (
          <input
            type="text"
            value={task.text}
            onChange={e => onTextChange(e.target.value)}
            className="w-full bg-gray-900/60 border border-gray-700/60 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500/50"
          />
        ) : (
          <span className={`text-sm ${done ? 'line-through text-gray-600' : 'text-gray-200'}`}>
            {task.text}
          </span>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {task.frequency && (
            <span className="text-[10px] text-gray-600 uppercase tracking-wide">
              {task.frequency}
            </span>
          )}
          <SectionPill sectionKey={task.sectionKey ?? null} />
        </div>
      </div>
    </div>
  );
}

// ─── Advance modal ────────────────────────────────────────────────────────────

function AdvanceModal({
  nextPhaseTitle,
  onConfirm,
  onCancel,
  advancing,
}: {
  nextPhaseTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  advancing: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-800 bg-gray-950 p-6 space-y-4"
        style={{ boxShadow: '0 0 40px rgba(0,0,0,0.8)' }}>
        <p className="text-base font-semibold text-white">Move to next phase?</p>
        <p className="text-sm text-gray-400">
          You&apos;ll advance to <span className="text-white font-medium">{nextPhaseTitle}</span>.
          This can&apos;t be undone automatically — make sure you&apos;ve met the graduation criteria.
        </p>
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            disabled={advancing}
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 disabled:opacity-40 transition-colors"
          >
            {advancing ? 'Saving…' : "Yes, I'm ready"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Not yet
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ExecuteBlock({ goal, onPlanUpdate, enriching = false }: Props) {
  const [plan, setPlan] = useState<ExecutionPlan>(goal.executionPlan);
  const [phaseIndex, setPhaseIndex] = useState(goal.currentPhaseIndex);
  const [doneTasks, setDoneTasks] = useState<Set<string>>(new Set());
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<ExecutionPlan>(goal.executionPlan);
  const [nextActionDone, setNextActionDone] = useState(false);

  // Sync when switching goals
  useEffect(() => {
    setPhaseIndex(goal.currentPhaseIndex);
    setDoneTasks(new Set());
    setNextActionDone(false);
    setPlan(goal.executionPlan);
    setEditDraft(goal.executionPlan);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal.id]);

  // When tasks arrive (partial → complete), update plan without resetting phase
  useEffect(() => {
    if (!goal.executionPlan._partial) {
      setPlan(goal.executionPlan);
      if (!editMode) setEditDraft(goal.executionPlan);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal.executionPlan._partial]);
  const [showAdvance, setShowAdvance] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [collapsedPhases, setCollapsedPhases] = useState(true);

  const currentPhase: PlanPhase | undefined = plan.phases[phaseIndex];
  const nextPhase: PlanPhase | undefined    = plan.phases[phaseIndex + 1];

  function taskKey(phaseIdx: number, taskIdx: number) {
    return `${phaseIdx}-${taskIdx}`;
  }

  function toggleTask(phaseIdx: number, taskIdx: number) {
    const key = taskKey(phaseIdx, taskIdx);
    setDoneTasks(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const allCurrentDone =
    currentPhase?.tasks.length > 0 &&
    currentPhase.tasks.every((_, i) => doneTasks.has(taskKey(phaseIndex, i)));

  // Next action: first uncompleted task in current phase, else plan.nextAction
  const nextAction: PlanTask = (() => {
    if (!currentPhase) return plan.nextAction;
    const idx = currentPhase.tasks.findIndex((_, i) => !doneTasks.has(taskKey(phaseIndex, i)));
    return idx >= 0 ? currentPhase.tasks[idx] : plan.nextAction;
  })();

  // True when the displayed nextAction is plan.nextAction (not a phase task)
  const nextActionIsStandalone = currentPhase?.tasks.length === 0 || nextAction.text === plan.nextAction.text;

  async function handleAdvance() {
    if (!nextPhase) return;
    setAdvancing(true);
    try {
      await fetch(`/api/self/goals/${goal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPhaseIndex: phaseIndex + 1 }),
      });
      setPhaseIndex(i => i + 1);
      setDoneTasks(new Set());
      setShowAdvance(false);
    } catch (e) {
      console.error('[ExecuteBlock] advance phase failed', e);
    }
    setAdvancing(false);
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      await fetch(`/api/self/goals/${goal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionPlan: editDraft }),
      });
      setPlan(editDraft);
      onPlanUpdate(editDraft);
      setEditMode(false);
    } catch (e) {
      console.error('[ExecuteBlock] save edit failed', e);
    }
    setSaving(false);
  }

  function updateDraftTask(phaseIdx: number, taskIdx: number, text: string) {
    setEditDraft(d => ({
      ...d,
      phases: d.phases.map((ph, pi) =>
        pi !== phaseIdx ? ph : {
          ...ph,
          tasks: ph.tasks.map((t, ti) => ti !== taskIdx ? t : { ...t, text }),
        }
      ),
    }));
  }

  function updateDraftField(field: keyof Pick<ExecutionPlan, 'minimumViableSession'>, value: string) {
    setEditDraft(d => ({ ...d, [field]: value }));
  }

  function updateDraftPhaseField(phaseIdx: number, field: keyof Pick<PlanPhase, 'title' | 'graduationCriteria'>, value: string) {
    setEditDraft(d => ({
      ...d,
      phases: d.phases.map((ph, pi) => pi !== phaseIdx ? ph : { ...ph, [field]: value }),
    }));
  }

  // Sections bar: only live/scaffolded ones
  const liveSections = plan.relevantSections
    .map(k => SECTIONS[k])
    .filter(s => s && (s.status === 'live' || s.status === 'scaffolded') && s.route);

  return (
    <>
      {showAdvance && nextPhase && (
        <AdvanceModal
          nextPhaseTitle={nextPhase.title}
          onConfirm={handleAdvance}
          onCancel={() => setShowAdvance(false)}
          advancing={advancing}
        />
      )}

      <div
        className="rounded-xl border border-gray-800 bg-gray-950/80 overflow-hidden"
        style={{ boxShadow: '0 0 24px rgba(99,102,241,0.08), inset 0 1px 0 rgba(255,255,255,0.06)' }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="px-5 py-4 border-b border-gray-800/80 flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-base font-semibold text-white leading-snug truncate">{goal.title}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-indigo-400 font-medium">{ARCHETYPE_LABELS[goal.archetype]}</span>
              {plan.supportingArchetypes.length > 0 && (
                <>
                  <span className="text-gray-700 text-xs">·</span>
                  <span className="text-xs text-gray-500">
                    {plan.supportingArchetypes.map(a => ARCHETYPE_LABELS[a]).join(', ')}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {editMode ? (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveEdit}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 disabled:opacity-40 transition-colors"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditDraft(plan); setEditMode(false); }}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => { setEditDraft(plan); setEditMode(true); }}
                className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Next action ────────────────────────────────────────────────── */}
        <div className="px-5 py-4 border-b border-gray-800/80 space-y-2">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Next action</p>
          <div className="flex items-start gap-3">
            <span className="text-indigo-400 text-sm mt-0.5 flex-shrink-0">→</span>
            <div className="flex-1 space-y-2">
              <p className="text-sm text-white">{nextAction.text}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <SectionPill sectionKey={nextAction.sectionKey ?? null} />
                {allCurrentDone ? (
                  <span className="text-xs text-amber-400 font-medium">
                    Phase complete — ready to graduate?
                  </span>
                ) : nextActionDone && nextActionIsStandalone ? (
                  <span className="text-xs text-green-500 font-medium">Done ✓</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (nextActionIsStandalone) {
                        setNextActionDone(true);
                      } else {
                        const idx = currentPhase?.tasks.findIndex(t => t.text === nextAction.text) ?? -1;
                        if (idx >= 0) toggleTask(phaseIndex, idx);
                      }
                    }}
                    className="text-xs text-gray-500 hover:text-gray-200 border border-gray-700 hover:border-gray-500 px-2 py-0.5 rounded transition-colors"
                  >
                    Mark done
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Current phase ──────────────────────────────────────────────── */}
        {currentPhase && (
          <div className="px-5 py-4 border-b border-gray-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                  Phase {phaseIndex + 1} of {plan.phases.length}
                </p>
                {editMode ? (
                  <input
                    type="text"
                    value={editDraft.phases[phaseIndex]?.title ?? ''}
                    onChange={e => updateDraftPhaseField(phaseIndex, 'title', e.target.value)}
                    className="mt-0.5 bg-gray-900/60 border border-gray-700/60 rounded px-2 py-1 text-sm font-semibold text-white focus:outline-none focus:border-indigo-500/50"
                  />
                ) : (
                  <p className="text-sm font-semibold text-white mt-0.5">{currentPhase.title}</p>
                )}
              </div>
              <span className="text-xs text-gray-600">{currentPhase.durationWeeks}w</span>
            </div>

            <div className="space-y-0.5">
              {(editMode ? editDraft.phases[phaseIndex]?.tasks : currentPhase.tasks)?.map((task, ti) => (
                <TaskRow
                  key={ti}
                  task={task}
                  done={doneTasks.has(taskKey(phaseIndex, ti))}
                  onToggle={() => toggleTask(phaseIndex, ti)}
                  editMode={editMode}
                  onTextChange={text => updateDraftTask(phaseIndex, ti, text)}
                />
              ))}
              {enriching && currentPhase.tasks.length === 0 && (
                <div className="flex items-center gap-2 py-2 text-xs text-gray-500">
                  <div className="w-3 h-3 rounded-full border border-indigo-500/40 border-t-indigo-500 animate-spin flex-shrink-0" />
                  Filling in tasks…
                </div>
              )}
            </div>

            <div className="pt-1 space-y-2">
              <p className="text-xs text-gray-500">
                <span className="text-gray-600">Ready when: </span>
                {editMode ? (
                  <input
                    type="text"
                    value={editDraft.phases[phaseIndex]?.graduationCriteria ?? ''}
                    onChange={e => updateDraftPhaseField(phaseIndex, 'graduationCriteria', e.target.value)}
                    className="w-full mt-1 bg-gray-900/60 border border-gray-700/60 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                  />
                ) : (
                  <span className="text-gray-400">{currentPhase.graduationCriteria}</span>
                )}
              </p>
              {nextPhase && (
                <button
                  type="button"
                  onClick={() => setShowAdvance(true)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-500/50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  I&apos;m ready — advance to {nextPhase.title} →
                </button>
              )}
              {!nextPhase && phaseIndex === plan.phases.length - 1 && (
                <p className="text-xs text-indigo-400 font-medium">
                  Final phase — you&apos;re in the home stretch.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Minimum viable session ─────────────────────────────────────── */}
        <div className="px-5 py-4 border-b border-gray-800/80 space-y-1.5">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Minimum viable session</p>
          {editMode ? (
            <textarea
              rows={2}
              value={editDraft.minimumViableSession}
              onChange={e => updateDraftField('minimumViableSession', e.target.value)}
              className="w-full bg-gray-900/60 border border-gray-700/60 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-indigo-500/50"
            />
          ) : (
            <p className="text-sm text-gray-300">{plan.minimumViableSession}</p>
          )}
        </div>

        {/* ── Later phases (collapsed) ───────────────────────────────────── */}
        {plan.phases.length > phaseIndex + 1 && (
          <div className="px-5 py-3 border-b border-gray-800/80">
            <button
              type="button"
              onClick={() => setCollapsedPhases(v => !v)}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${collapsedPhases ? '' : 'rotate-90'}`} />
              Later phases
            </button>
            {!collapsedPhases && (
              <div className="mt-2 space-y-1">
                {plan.phases.slice(phaseIndex + 1).map((ph, i) => (
                  <div key={i} className="flex items-center gap-2 py-1">
                    <span className="text-[10px] text-gray-600 w-12 flex-shrink-0">
                      Phase {phaseIndex + 2 + i}
                    </span>
                    <span className="text-sm text-gray-500">{ph.title}</span>
                    <span className="text-xs text-gray-700">{ph.durationWeeks}w</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Relevant sections ──────────────────────────────────────────── */}
        {liveSections.length > 0 && (
          <div className="px-5 py-3 border-b border-gray-800/80 space-y-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Relevant sections</p>
            <div className="flex flex-wrap gap-2">
              {liveSections.map(s => (
                <Link
                  key={s!.key}
                  href={s!.route!}
                  className="px-3 py-1 rounded-full text-xs border border-gray-700 bg-gray-900 text-gray-300 hover:border-indigo-500/50 hover:text-indigo-300 transition-colors"
                >
                  {s!.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Honest limitations ─────────────────────────────────────────── */}
        {plan.honestLimitations.length > 0 && (
          <div className="px-5 py-3 space-y-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Notes</p>
            <div className="space-y-1.5">
              {plan.honestLimitations.map((note, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-blue-300/80">
                  <span className="flex-shrink-0 mt-0.5">ⓘ</span>
                  <span className="leading-relaxed">{note}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
