"use client";
// blocks/GoalBlock.tsx — AIPlanModal, GoalSummary, GoalCard, DriveColumn

import React, { useState } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronUp, Pencil, Check,
  X, Loader2, ChevronRight, Calendar, Zap,
} from "lucide-react";
import { TextInput, FallbackBanner, uid } from "@/components/self/shared";
import { safeFetchJson } from "@/hooks/useAIBlock";
import type { DriveType, GoalEntry, PageItem, AIRoadmap, Phase, DayPlan } from "@/types/self";

export type { GoalEntry };

// ─── Drive accent colours (local — only used by DriveColumn) ─────────────────

const DRIVE_COLOR: Record<DriveType, string> = {
  learning: "text-sky-400 border-sky-500/40 bg-sky-500/10",
  helping:  "text-rose-400 border-rose-500/40 bg-rose-500/10",
  building: "text-indigo-400 border-indigo-500/40 bg-indigo-500/10",
  doing:    "text-amber-400 border-amber-500/40 bg-amber-500/10",
};

// ─── AI Plan Modal ────────────────────────────────────────────────────────────

function AIPlanModal({ goal, onClose, onSavePlan, onRegenerate, planLoading }: {
  goal: GoalEntry;
  onClose: () => void;
  onSavePlan: (plan: AIRoadmap) => void;
  onRegenerate: () => void;
  planLoading: boolean;
}) {
  const roadmap = goal.plan!;
  const [selectedPhaseId, setSelectedPhaseId] = useState(roadmap.phases[0]?.id ?? "");
  const [phases,          setPhases]          = useState<Phase[]>(roadmap.phases);
  const [dirty,           setDirty]           = useState(false);

  const prevPlanRef = React.useRef(roadmap);
  React.useEffect(() => {
    if (goal.plan && goal.plan !== prevPlanRef.current) {
      prevPlanRef.current = goal.plan;
      setPhases(goal.plan.phases);
      setSelectedPhaseId(goal.plan.phases[0]?.id ?? "");
      setDirty(false);
    }
  }, [goal.plan]);

  const [weekExpanded,  setWeekExpanded]  = useState(false);
  const [availableDays, setAvailableDays] = useState(5);
  const [weekLoading,   setWeekLoading]   = useState(false);
  const [weekError,     setWeekError]     = useState<string | null>(null);
  const [editingWeek,   setEditingWeek]   = useState(false);
  const [localWeekPlan, setLocalWeekPlan] = useState<DayPlan[] | null>(null);

  const selectedPhase   = phases.find(p => p.id === selectedPhaseId) ?? phases[0];
  const weekKey         = `${selectedPhaseId}-${availableDays}`;
  const currentWeekPlan: DayPlan[] | null = roadmap.weekPlans?.[weekKey] ?? null;

  function updateAction(phaseId: string, idx: number, value: string) {
    setPhases(prev => prev.map(p =>
      p.id === phaseId ? { ...p, actions: p.actions.map((a, i) => i === idx ? value : a) } : p
    ));
    setDirty(true);
  }
  function addAction(phaseId: string) {
    setPhases(prev => prev.map(p =>
      p.id === phaseId ? { ...p, actions: [...p.actions, ""] } : p
    ));
    setDirty(true);
  }
  function removeAction(phaseId: string, idx: number) {
    setPhases(prev => prev.map(p =>
      p.id === phaseId ? { ...p, actions: p.actions.filter((_, i) => i !== idx) } : p
    ));
    setDirty(true);
  }
  function handleSave() { onSavePlan({ ...roadmap, phases }); setDirty(false); }

  async function fetchWeekPlan(phaseId: string, days: number) {
    const key = `${phaseId}-${days}`;
    setWeekLoading(true); setWeekError(null);
    try {
      const resp = await safeFetchJson("/api/ai/generate-week-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phases, currentPhase: phaseId, availableDays: days }),
      });
      if (!resp.ok || !resp.json?.week) throw new Error("Failed");
      const updatedWeekPlans = { ...(roadmap.weekPlans ?? {}), [key]: resp.json.week as DayPlan[] };
      onSavePlan({ ...roadmap, phases, weekPlans: updatedWeekPlans });
    } catch { setWeekError("Could not generate week plan. Try again."); }
    finally  { setWeekLoading(false); }
  }

  function handleDaysChange(days: number) {
    setAvailableDays(days);
    setEditingWeek(false);
    setLocalWeekPlan(null);
  }

  function startEditingWeek() {
    setLocalWeekPlan(currentWeekPlan ? currentWeekPlan.map(d => ({ ...d, tasks: [...d.tasks] })) : null);
    setEditingWeek(true);
  }
  function updateWeekTask(dayIdx: number, taskIdx: number, value: string) {
    setLocalWeekPlan(prev => prev
      ? prev.map((d, di) => di === dayIdx ? { ...d, tasks: d.tasks.map((t, ti) => ti === taskIdx ? value : t) } : d)
      : prev
    );
  }
  function saveWeekPlan() {
    if (!localWeekPlan) return;
    const updatedWeekPlans = { ...(roadmap.weekPlans ?? {}), [weekKey]: localWeekPlan };
    onSavePlan({ ...roadmap, phases, weekPlans: updatedWeekPlans });
    setEditingWeek(false);
    setLocalWeekPlan(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl
        border border-gray-800 bg-gray-950 shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            <p className="text-xs text-indigo-400 uppercase tracking-wider mb-1">AI Roadmap</p>
            <h2 className="text-base font-semibold text-white truncate">{goal.statement || "Your Goal"}</h2>
          </div>
          <button type="button" onClick={onClose}
            className="p-1.5 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700
              text-gray-400 hover:text-white transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-6 overflow-y-auto">
          {roadmap.fallback && <FallbackBanner />}

          {/* Phase selector */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Phase</p>
            <div className="flex gap-2 flex-wrap">
              {phases.map(phase => (
                <button key={phase.id} type="button" onClick={() => setSelectedPhaseId(phase.id)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                    selectedPhaseId === phase.id
                      ? "border-indigo-500 bg-indigo-500/20 text-indigo-300 font-medium"
                      : "border-gray-700 text-gray-400 hover:border-gray-500"
                  }`}>
                  {phase.name}
                </button>
              ))}
            </div>
          </div>

          {/* Editable phase actions */}
          {selectedPhase && (
            <div className={planLoading ? "opacity-40 pointer-events-none" : ""}>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{selectedPhase.name} Actions</p>
              {planLoading && (
                <div className="flex items-center gap-2 text-xs text-indigo-400 mb-3">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />Generating new plan…
                </div>
              )}
              <div className="space-y-2">
                {selectedPhase.actions.map((action, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="flex-none w-5 h-5 rounded-full bg-indigo-600/30 border border-indigo-500/40
                      text-indigo-400 text-xs flex items-center justify-center font-semibold mt-2.5">{i + 1}</span>
                    <textarea value={action}
                      onChange={e => updateAction(selectedPhase.id, i, e.target.value)}
                      rows={2}
                      className="flex-1 rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm
                        text-gray-200 leading-relaxed resize-none outline-none focus:border-indigo-500 transition-colors"
                    />
                    <button type="button" onClick={() => removeAction(selectedPhase.id, i)}
                      className="mt-2.5 p-1 text-gray-600 hover:text-red-400 transition-colors flex-shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => addAction(selectedPhase.id)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed
                    border-gray-700 text-xs text-gray-500 hover:border-gray-500 hover:text-gray-300 transition-colors">
                  <Plus className="w-3.5 h-3.5" />Add action
                </button>
              </div>
            </div>
          )}

          {/* Regenerate / Save bar */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-800">
            <button type="button" onClick={onRegenerate} disabled={planLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/50
                bg-indigo-500/10 text-xs text-indigo-300 hover:bg-indigo-500/20 transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed">
              {planLoading
                ? <><Loader2 className="w-3 h-3 animate-spin" />Regenerating…</>
                : <>↺ Regenerate plan</>}
            </button>
            {dirty && !planLoading && (
              <button type="button" onClick={handleSave}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500
                  text-white text-xs font-medium transition-colors">
                <Check className="w-3.5 h-3.5" />Save changes
              </button>
            )}
          </div>

          {/* Week plan expander */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
            <button type="button" onClick={() => setWeekExpanded(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-800/40 transition-colors">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-medium text-white">Weekly Breakdown</span>
              </div>
              {weekExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
            </button>

            {weekExpanded && (
              <div className="px-4 pb-4 border-t border-gray-800 pt-4 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Days available</p>
                    <div className="flex gap-1.5">
                      {[3, 4, 5, 6, 7].map(n => (
                        <button key={n} type="button" onClick={() => handleDaysChange(n)}
                          className={`w-8 h-8 rounded-lg text-xs border transition-colors ${
                            availableDays === n
                              ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                              : "border-gray-700 text-gray-400 hover:border-gray-600"
                          }`}>{n}</button>
                      ))}
                    </div>
                  </div>
                  <button type="button"
                    onClick={() => fetchWeekPlan(selectedPhaseId, availableDays)}
                    disabled={weekLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/50
                      bg-indigo-500/10 text-xs text-indigo-300 hover:bg-indigo-500/20 transition-colors
                      disabled:opacity-40 disabled:cursor-not-allowed self-end">
                    {weekLoading
                      ? <><Loader2 className="w-3 h-3 animate-spin" />Generating…</>
                      : currentWeekPlan ? <>↺ Regenerate</> : <><Calendar className="w-3 h-3" />Generate</>}
                  </button>
                </div>

                {weekError && !weekLoading && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-red-400">{weekError}</p>
                    <button type="button" onClick={() => fetchWeekPlan(selectedPhaseId, availableDays)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Retry</button>
                  </div>
                )}
                {!currentWeekPlan && !weekLoading && !weekError && (
                  <p className="text-xs text-gray-600 text-center py-2">
                    Select a phase and days, then click Generate.
                  </p>
                )}
                {currentWeekPlan && !weekLoading && (
                  <div className="space-y-2">
                    <div className="flex justify-end gap-2">
                      {editingWeek ? (
                        <>
                          <button type="button" onClick={() => { setEditingWeek(false); setLocalWeekPlan(null); }}
                            className="text-xs text-gray-400 hover:text-gray-300 transition-colors px-2 py-1">
                            Cancel
                          </button>
                          <button type="button" onClick={saveWeekPlan}
                            className="flex items-center gap-1 text-xs px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
                            <Check className="w-3 h-3" />Save
                          </button>
                        </>
                      ) : (
                        <button type="button" onClick={startEditingWeek}
                          className="text-xs text-gray-400 hover:text-indigo-300 transition-colors px-2 py-1">
                          Edit tasks
                        </button>
                      )}
                    </div>
                    {(editingWeek ? localWeekPlan! : currentWeekPlan).map((dayPlan: DayPlan, di: number) => (
                      <div key={dayPlan.day} className="rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2.5">
                        <p className="text-xs font-semibold text-indigo-400 mb-1.5">{dayPlan.day}</p>
                        <div className="space-y-1">
                          {dayPlan.tasks.map((task: string, ti: number) => (
                            editingWeek ? (
                              <textarea key={ti} value={task}
                                onChange={e => updateWeekTask(di, ti, e.target.value)}
                                rows={2}
                                className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1
                                  text-xs text-gray-200 resize-none focus:outline-none focus:border-indigo-500" />
                            ) : (
                              <p key={ti} className="text-xs text-gray-300 flex items-start gap-1.5">
                                <span className="text-gray-600 mt-0.5">·</span>{task}
                              </p>
                            )
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Goal Summary (collapsed view) ───────────────────────────────────────────

function GoalSummary({ goal, planLoading, onEdit, onRemove, onGeneratePlan, onSavePlan, onRegenerate }: {
  goal: GoalEntry;
  planLoading: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onGeneratePlan: () => void;
  onSavePlan: (plan: AIRoadmap) => void;
  onRegenerate: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const namedSkills = goal.skills.filter(s => s.name);

  return (
    <>
      <div className="rounded-2xl border border-gray-800 bg-gray-950/40 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {goal.statement || <span className="text-gray-500 italic">No goal stated</span>}
            </p>
            {namedSkills.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {namedSkills.map(s => (
                  <span key={s.id}
                    className={`px-2 py-0.5 rounded-full text-xs border ${
                      s.monetize ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300" : "border-gray-700 text-gray-400"
                    }`}>
                    {s.name}{s.monetize && " 💰"}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5 flex-shrink-0 items-end">
            <button type="button"
              onClick={() => goal.plan ? setModalOpen(true) : onGeneratePlan()}
              disabled={planLoading}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                goal.plan
                  ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20"
                  : "border-gray-700 bg-gray-800 text-gray-400 hover:border-indigo-500/40 hover:text-indigo-300"
              }`}>
              {planLoading
                ? <><Loader2 className="w-3 h-3 animate-spin" />Generating…</>
                : goal.plan
                  ? <><Zap className="w-3 h-3" />Check plan</>
                  : <><Zap className="w-3 h-3" />Generate plan</>}
            </button>
            <div className="flex gap-1">
              <button type="button" onClick={onEdit}
                className="p-1.5 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700
                  text-gray-400 hover:text-white transition-colors">
                <Pencil className="w-3 h-3" />
              </button>
              <button type="button" onClick={onRemove}
                className="p-1.5 rounded-lg border border-gray-700 bg-gray-800 hover:bg-red-900/30
                  text-gray-400 hover:text-red-400 transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {modalOpen && goal.plan && (
        <AIPlanModal
          goal={goal}
          onClose={() => setModalOpen(false)}
          onSavePlan={onSavePlan}
          onRegenerate={onRegenerate}
          planLoading={planLoading}
        />
      )}
    </>
  );
}

// ─── Goal Card (edit view) ────────────────────────────────────────────────────

function GoalCard({ goal, idx, pages, onChange, onSave, onRemove, canRemove }: {
  goal: GoalEntry;
  idx: number;
  pages: PageItem[];
  onChange: (g: GoalEntry) => void;
  onSave: () => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [showAddBiz, setShowAddBiz] = useState(false);
  const [newBizTitle, setNewBizTitle] = useState("");
  const [newBizDesc,  setNewBizDesc]  = useState("");
  const [bizAdding,   setBizAdding]   = useState(false);
  const [bizError,    setBizError]    = useState<string | null>(null);

  const toggleBiz = (id: string) => {
    const linked = goal.linkedBusinessIds.includes(id)
      ? goal.linkedBusinessIds.filter(b => b !== id)
      : [...goal.linkedBusinessIds, id];
    onChange({ ...goal, linkedBusinessIds: linked });
  };

  async function createAndLink() {
    const title = newBizTitle.trim();
    if (!title) { setBizError("Enter a business name"); return; }
    setBizAdding(true); setBizError(null);
    try {
      const resp = await safeFetchJson("/api/user/pages", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ title, description: newBizDesc.trim() }),
      });
      if (!resp.ok || !resp.json?.ok) throw new Error(resp.json?.error || "Could not create");
      const created: PageItem = resp.json.page;
      window.dispatchEvent(new CustomEvent("charaivati:page-created", { detail: created }));
      onChange({ ...goal, linkedBusinessIds: [...goal.linkedBusinessIds, created.id] });
      setNewBizTitle(""); setNewBizDesc(""); setShowAddBiz(false);
    } catch (err: unknown) {
      setBizError(err instanceof Error ? err.message : "Error creating page");
    } finally { setBizAdding(false); }
  }

  const canSave = goal.statement.trim().length > 0;

  return (
    <div className="rounded-2xl border border-indigo-500/30 bg-gray-950/40 p-4 space-y-4">
      {/* Statement */}
      <div className="flex items-center gap-2">
        <span className="flex-none w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold
          flex items-center justify-center">{idx + 1}</span>
        <input type="text" value={goal.statement}
          onChange={e => onChange({ ...goal, statement: e.target.value })}
          placeholder="Goal in one line…"
          className="flex-1 bg-transparent border-b border-gray-700 focus:border-indigo-500
            text-white text-sm py-1 outline-none placeholder-gray-600 transition-colors"
        />
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-gray-600 hover:text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Description */}
      <textarea
        value={goal.description}
        onChange={e => onChange({ ...goal, description: e.target.value })}
        placeholder="Describe this goal in more detail — why it matters, what success looks like, any context that helps…"
        rows={3}
        className="w-full bg-transparent rounded-lg border border-gray-800 focus:border-indigo-500/60
          text-sm text-white placeholder-gray-600 px-3 py-2 outline-none resize-none transition-colors"
      />

      {/* Business pages */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-400">Business pages</span>
          <button type="button" onClick={() => { setShowAddBiz(v => !v); setBizError(null); }}
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            <Plus className="w-3 h-3" />{showAddBiz ? "Cancel" : "Create new"}
          </button>
        </div>
        {pages.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {pages.map(page => {
              const linked = goal.linkedBusinessIds.includes(page.id);
              return (
                <button key={page.id} type="button" onClick={() => toggleBiz(page.id)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    linked ? "border-indigo-500 bg-indigo-500/20 text-indigo-300" : "border-gray-700 text-gray-400 hover:border-gray-500"
                  }`}>
                  {linked && <span className="mr-1">✓</span>}{page.title}
                </button>
              );
            })}
          </div>
        )}
        {pages.length === 0 && !showAddBiz && (
          <p className="text-xs text-gray-600">No business pages yet.</p>
        )}
        {showAddBiz && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-3 space-y-2">
            <TextInput value={newBizTitle} onChange={setNewBizTitle} placeholder="Business name" />
            <textarea value={newBizDesc} onChange={e => setNewBizDesc(e.target.value)}
              placeholder="Description (optional)" rows={2}
              className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm
                text-white placeholder-gray-600 outline-none focus:border-indigo-500 resize-none transition-colors"
            />
            {bizError && <p className="text-xs text-red-400">{bizError}</p>}
            <div className="flex justify-end">
              <button type="button" onClick={createAndLink} disabled={bizAdding}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs transition-colors disabled:opacity-50">
                {bizAdding ? "Creating…" : "Create & link"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex justify-end pt-1 border-t border-gray-800">
        <button type="button" onClick={onSave} disabled={!canSave}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500
            text-white text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <Check className="w-3.5 h-3.5" /> Save goal
        </button>
      </div>
    </div>
  );
}

// ─── Drive Column ─────────────────────────────────────────────────────────────

export function DriveColumn({
  drive, goals, pages,
  onUpdateGoal, onSaveGoal, onEditGoal, onRemoveGoal, onAddGoal,
  planLoading, onGeneratePlan, onSavePlan, onRegenerate,
}: {
  drive: { id: DriveType; label: string; description: string };
  goals: GoalEntry[];
  pages: PageItem[];
  onUpdateGoal: (id: string, g: GoalEntry) => void;
  onSaveGoal:   (id: string) => void;
  onEditGoal:   (id: string) => void;
  onRemoveGoal: (id: string) => void;
  onAddGoal:    (driveId: DriveType) => void;
  planLoading:    Record<string, boolean>;
  onGeneratePlan: (id: string) => void;
  onSavePlan:     (id: string, plan: AIRoadmap) => void;
  onRegenerate:   (id: string) => void;
}) {
  const colorClass = DRIVE_COLOR[drive.id];
  const canAdd = goals.every(g => g.saved);

  return (
    <div className="flex-1 min-w-0 space-y-3">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${colorClass}`}>
        <span className="text-xs font-semibold uppercase tracking-wider">{drive.label}</span>
        <span className="text-xs opacity-60">· {drive.description}</span>
      </div>

      {goals.map((goal, idx) =>
        goal.saved ? (
          <GoalSummary
            key={goal.id}
            goal={goal}
            planLoading={!!planLoading[goal.id]}
            onEdit={() => onEditGoal(goal.id)}
            onRemove={() => onRemoveGoal(goal.id)}
            onGeneratePlan={() => onGeneratePlan(goal.id)}
            onSavePlan={plan => onSavePlan(goal.id, plan)}
            onRegenerate={() => onRegenerate(goal.id)}
          />
        ) : (
          <GoalCard
            key={goal.id}
            goal={goal}
            idx={idx}
            pages={pages}
            onChange={u => onUpdateGoal(goal.id, u)}
            onSave={() => onSaveGoal(goal.id)}
            onRemove={() => onRemoveGoal(goal.id)}
            canRemove={goals.length > 1}
          />
        )
      )}

      {canAdd && (
        <button type="button" onClick={() => onAddGoal(drive.id)}
          className="w-full rounded-xl border border-dashed border-gray-700 py-2.5 text-xs
            text-gray-500 hover:border-gray-500 hover:text-gray-300 transition-colors
            flex items-center justify-center gap-1.5">
          <Plus className="w-3.5 h-3.5" />Add goal
        </button>
      )}
    </div>
  );
}
