// app/(with-nav)/self/tabs/SelfTab.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronUp, Pencil, Check,
  X, Loader2, ChevronRight, Calendar, Zap, Sparkles,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type DriveType = "learning" | "helping" | "building" | "doing";

type SkillEntry = {
  id: string;
  name: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  monetize: boolean;
};

type GoalEntry = {
  id: string;
  driveId: DriveType;
  statement: string;
  description: string;
  skills: SkillEntry[];
  linkedBusinessIds: string[];
  saved: boolean;
  plan?: AIRoadmap | null;
};

type HealthProfile = {
  food: string;
  exercise: string;
  sessionsPerWeek: number;
  heightCm: string;
  weightKg: string;
  age: string;
};

type PageItem = {
  id: string;
  title: string;
  description?: string | null;
};

type SaveState = "idle" | "saving" | "saved" | "error";

// ─── AI Types ─────────────────────────────────────────────────────────────────

type Phase = {
  id: string;
  name: string;
  duration: string;
  actions: string[];
};

type DayPlan = {
  day: string;
  tasks: string[];
};

type Suggestion = {
  id: string;
  text: string;
  type: "skill" | "health" | "network" | "execution";
  priority: "low" | "medium" | "high";
};

type AIRoadmap = {
  phases: Phase[];
  suggestions: Suggestion[];
  weekPlans?: Record<string, DayPlan[]>; // key: `${phaseId}-${availableDays}`
  fallback?: boolean; // true when AI was unavailable
};


// ─── Constants ────────────────────────────────────────────────────────────────

const DRIVES: { id: DriveType; label: string; description: string }[] = [
  { id: "learning", label: "Learning", description: "Curious about everything" },
  { id: "helping",  label: "Helping",  description: "Here for the people"      },
  { id: "building", label: "Building", description: "Making things happen"     },
  { id: "doing",    label: "Doing",    description: "Master of the craft"      },
];

const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
const FOOD_OPTIONS     = ["Vegetarian", "Eggetarian", "Non-Vegetarian", "Vegan"];
const EXERCISE_OPTIONS = ["Yoga", "Cardio", "Strength", "Mixed"];

const MEAL_PREVIEW: Record<string, string> = {
  Vegetarian:       "Dal, sabzi, roti · fruit snacks",
  Vegan:            "Legumes, grains, nuts & seeds",
  Eggetarian:       "Eggs + plant-based meals",
  "Non-Vegetarian": "Balanced protein + whole foods",
};

// Drive accent colours — used for column headers
const DRIVE_COLOR: Record<DriveType, string> = {
  learning: "text-sky-400 border-sky-500/40 bg-sky-500/10",
  helping:  "text-rose-400 border-rose-500/40 bg-rose-500/10",
  building: "text-indigo-400 border-indigo-500/40 bg-indigo-500/10",
  doing:    "text-amber-400 border-amber-500/40 bg-amber-500/10",
};

const GUEST_KEY    = "charaivati_guest_self";
const GUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 9); }

function defaultGoal(driveId: DriveType): GoalEntry {
  return {
    id: uid(), driveId, statement: "", description: "",
    skills: [{ id: uid(), name: "", level: "Beginner", monetize: false }],
    linkedBusinessIds: [], saved: false,
  };
}

function defaultHealth(): HealthProfile {
  return { food: "Vegetarian", exercise: "Mixed", sessionsPerWeek: 3, heightCm: "", weightKg: "", age: "" };
}

async function safeFetchJson(input: RequestInfo, init?: RequestInit) {
  const res  = await fetch(input, init);
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

function guestLoad() {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > GUEST_TTL_MS) { localStorage.removeItem(GUEST_KEY); return null; }
    return data;
  } catch { return null; }
}

function guestSave(data: object) {
  try { localStorage.setItem(GUEST_KEY, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

// ─── Shared small components ──────────────────────────────────────────────────

function PillButton({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs border transition-colors ${
        active
          ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
          : "border-gray-700 bg-transparent text-gray-400 hover:border-gray-500"
      }`}>
      {children}
    </button>
  );
}

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-gray-800 bg-gray-900/70 ${className}`}>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{children}</p>;
}

function TextInput({ value, onChange, placeholder, className = "" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <input type="text" value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm text-white
        placeholder-gray-600 outline-none focus:border-indigo-500 transition-colors ${className}`}
    />
  );
}

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

  // Sync phases when a regenerated plan arrives from the parent
  const prevPlanRef = React.useRef(roadmap);
  React.useEffect(() => {
    if (goal.plan && goal.plan !== prevPlanRef.current) {
      prevPlanRef.current = goal.plan;
      setPhases(goal.plan.phases);
      setSelectedPhaseId(goal.plan.phases[0]?.id ?? "");
      setDirty(false);
    }
  }, [goal.plan]);
  const [weekExpanded,    setWeekExpanded]    = useState(false);
  const [availableDays,   setAvailableDays]   = useState(5);
  const [weekLoading,     setWeekLoading]     = useState(false);
  const [weekError,       setWeekError]       = useState<string | null>(null);
  const [editingWeek,     setEditingWeek]     = useState(false);
  const [localWeekPlan,   setLocalWeekPlan]   = useState<DayPlan[] | null>(null);

  const selectedPhase  = phases.find(p => p.id === selectedPhaseId) ?? phases[0];
  const weekKey        = `${selectedPhaseId}-${availableDays}`;
  // Derive current week plan from persisted roadmap — no local state needed
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

  function handleSave() {
    onSavePlan({ ...roadmap, phases });
    setDirty(false);
  }

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
      // Save into roadmap.weekPlans so it persists across refreshes
      const updatedWeekPlans = { ...(roadmap.weekPlans ?? {}), [key]: resp.json.week as DayPlan[] };
      onSavePlan({ ...roadmap, phases, weekPlans: updatedWeekPlans });
    } catch { setWeekError("Could not generate week plan. Try again."); }
    finally   { setWeekLoading(false); }
  }

  function handlePhaseChange(id: string) {
    setSelectedPhaseId(id);
    // No need to clear — currentWeekPlan is derived from roadmap.weekPlans[key]
  }

  function handleDaysChange(days: number) {
    setAvailableDays(days);
    setEditingWeek(false);
    setLocalWeekPlan(null);
    // Plans per day-count are stored separately — switching days shows cached plan if available
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
          {/* AI unavailable banner */}
          {roadmap.fallback && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 leading-relaxed">
              Our AI suggestions are unavailable right now — we'll get back to you soon.
              <br />
              <span className="text-amber-400/70 text-xs">In the meantime, add your own plan below. Hit Regenerate anytime to let AI improve it.</span>
            </div>
          )}

          {/* Phase selector */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Phase</p>
            <div className="flex gap-2 flex-wrap">
              {phases.map(phase => (
                <button key={phase.id} type="button" onClick={() => handlePhaseChange(phase.id)}
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
                    <textarea
                      value={action}
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
                {/* Controls row */}
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
                    {/* Edit / Save row */}
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
            <p className="text-xs text-gray-500 mt-0.5">{goal.horizon}</p>

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

// ─── Drive Goal Column ────────────────────────────────────────────────────────

function DriveColumn({
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
      {/* Column header */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${colorClass}`}>
        <span className="text-xs font-semibold uppercase tracking-wider">{drive.label}</span>
        <span className="text-xs opacity-60">· {drive.description}</span>
      </div>

      {/* Goals */}
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

      {/* Add goal button — shown when all existing goals are saved and under limit */}
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

// ─── Skill Row (shared) ───────────────────────────────────────────────────────

function SkillRow({ skill, onChange, onRemove }: {
  skill: SkillEntry;
  onChange: (s: SkillEntry) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg bg-gray-900 border border-gray-800 px-3 py-2 group space-y-1.5">
      <div className="flex items-center gap-2">
        <input
          value={skill.name}
          onChange={e => onChange({ ...skill, name: e.target.value })}
          placeholder="Skill name"
          className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder-gray-600 outline-none"
        />
        <button type="button" onClick={onRemove}
          className="text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-1">
        {SKILL_LEVELS.map(l => (
          <button key={l} type="button"
            onClick={() => onChange({ ...skill, level: l })}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              skill.level === l
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                : "text-gray-600 hover:text-gray-400"
            }`}>{l}</button>
        ))}
        <button type="button"
          onClick={() => onChange({ ...skill, monetize: !skill.monetize })}
          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ml-auto ${
            skill.monetize
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              : "text-gray-600 hover:text-gray-400"
          }`}>Earn</button>
      </div>
    </div>
  );
}

// ─── Skills Section ───────────────────────────────────────────────────────────

function SkillsSection({
  generalSkills,
  goals,
  skillsLoading,
  onUpdateGeneralSkills,
  onUpdateGoalSkills,
  onSuggestSkills,
}: {
  generalSkills: SkillEntry[];
  goals: GoalEntry[];
  skillsLoading: Record<string, boolean>;
  onUpdateGeneralSkills: (skills: SkillEntry[]) => void;
  onUpdateGoalSkills: (goalId: string, skills: SkillEntry[]) => void;
  onSuggestSkills: (goalId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const savedGoals = goals.filter(g => g.saved && g.statement);

  return (
    <SectionCard>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left">
        <h3 className="text-lg font-semibold text-white">Skills</h3>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>

      {open && (
        <div className="px-5 pb-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* General Skills */}
            <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4 space-y-3">
              <p className="text-sm font-semibold text-white">General</p>
              <div className="space-y-2">
                {generalSkills.map((skill, i) => (
                  <SkillRow key={skill.id} skill={skill}
                    onChange={s => onUpdateGeneralSkills(generalSkills.map((gs, j) => j === i ? s : gs))}
                    onRemove={() => onUpdateGeneralSkills(generalSkills.filter((_, j) => j !== i))}
                  />
                ))}
                {generalSkills.length === 0 && (
                  <p className="text-xs text-gray-600">e.g. Communication, Leadership</p>
                )}
              </div>
              <button type="button"
                onClick={() => onUpdateGeneralSkills([...generalSkills, { id: uid(), name: "", level: "Beginner", monetize: false }])}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-400 transition-colors">
                <Plus className="w-3 h-3" /> Add skill
              </button>
            </div>

            {/* Goal-specific Skills */}
            {savedGoals.map(goal => (
              <div key={goal.id} className="rounded-xl border border-gray-800 bg-gray-950/60 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-white line-clamp-2 flex-1">{goal.statement}</p>
                  <button type="button"
                    onClick={() => onSuggestSkills(goal.id)}
                    disabled={!!skillsLoading[goal.id]}
                    className="flex-none flex items-center gap-1 px-2 py-1 rounded-lg border border-indigo-500/40
                      bg-indigo-500/10 text-xs text-indigo-300 hover:bg-indigo-500/20 transition-colors
                      disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
                    {skillsLoading[goal.id]
                      ? <><Loader2 className="w-3 h-3 animate-spin" />Suggesting…</>
                      : <><Sparkles className="w-3 h-3" />AI suggest</>}
                  </button>
                </div>
                <div className="space-y-2">
                  {goal.skills.map((skill, si) => (
                    <SkillRow key={skill.id} skill={skill}
                      onChange={s => onUpdateGoalSkills(goal.id, goal.skills.map((gs, j) => j === si ? s : gs))}
                      onRemove={() => onUpdateGoalSkills(goal.id, goal.skills.filter((_, j) => j !== si))}
                    />
                  ))}
                  {goal.skills.length === 0 && !skillsLoading[goal.id] && (
                    <p className="text-xs text-gray-600">No skills added yet.</p>
                  )}
                </div>
                <button type="button"
                  onClick={() => onUpdateGoalSkills(goal.id, [...goal.skills, { id: uid(), name: "", level: "Beginner", monetize: false }])}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-400 transition-colors">
                  <Plus className="w-3 h-3" /> Add skill
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Health Section ───────────────────────────────────────────────────────────

function HealthSection({ health, setHealth }: {
  health: HealthProfile; setHealth: (h: HealthProfile) => void;
}) {
  const [open, setOpen] = useState(true);
  const set = (k: keyof HealthProfile, v: string | number) => setHealth({ ...health, [k]: v });

  return (
    <SectionCard>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left">
        <div>
          <h3 className="text-base font-semibold text-white">Health Foundation</h3>
          <p className="text-xs text-gray-400 mt-0.5">Fuels every goal — shared across all</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {(["heightCm", "weightKg", "age"] as const).map(k => (
              <div key={k}>
                <FieldLabel>{k === "heightCm" ? "Height (cm)" : k === "weightKg" ? "Weight (kg)" : "Age"}</FieldLabel>
                <input type="number" value={health[k]} onChange={e => set(k, e.target.value)}
                  placeholder={k === "heightCm" ? "170" : k === "weightKg" ? "65" : "28"}
                  className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm
                    text-white placeholder-gray-600 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <FieldLabel>Food preference</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {FOOD_OPTIONS.map(f => (
                  <PillButton key={f} active={health.food === f} onClick={() => set("food", f)}>{f}</PillButton>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>Movement</FieldLabel>
              <div className="flex flex-wrap gap-2 mb-2">
                {EXERCISE_OPTIONS.map(e => (
                  <PillButton key={e} active={health.exercise === e} onClick={() => set("exercise", e)}>{e}</PillButton>
                ))}
              </div>
              <div className="flex gap-2">
                {[2, 3, 4, 5].map(n => (
                  <PillButton key={n} active={health.sessionsPerWeek === n} onClick={() => set("sessionsPerWeek", n)}>
                    {n}×/wk
                  </PillButton>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950/60 px-4 py-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Plan</p>
            <p className="text-sm text-gray-300">
              {MEAL_PREVIEW[health.food] ?? "Balanced diet"}&nbsp;·&nbsp;
              {health.exercise} {health.sessionsPerWeek}× per week
            </p>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Main SelfTab ─────────────────────────────────────────────────────────────

export default function SelfTab({ profile }: { profile?: any }) {
  const [drives,    setDrives]    = useState<DriveType[]>([]);
  // All goals for all drives are stored together; hidden ones stay in state
  const [goals,     setGoals]     = useState<GoalEntry[]>([]);
  const [health,         setHealth]         = useState<HealthProfile>(defaultHealth());
  const [generalSkills,  setGeneralSkills]  = useState<SkillEntry[]>([]);
  const [skillsLoading,  setSkillsLoading]  = useState<Record<string, boolean>>({});
  const [pages,          setPages]          = useState<PageItem[]>([]);
  const generalSkillsRef = useRef<SkillEntry[]>([]);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isGuest,   setIsGuest]   = useState(false);

  const [planLoading, setPlanLoading] = useState<Record<string, boolean>>({});

  const profileApplied = useRef(false);
  const saveTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guestLoaded    = useRef(false);

  // ── Goals visible in the current session (drive is active) ────
  const visibleGoals = goals.filter(g => drives.includes(g.driveId));

  // ── Generate AI plan for a single goal ────────────────────────
  async function generateGoalPlan(goalId: string) {
    const goal = goals.find(g => g.id === goalId);
    if (!goal || !goal.statement) return;

    setPlanLoading(prev => ({ ...prev, [goalId]: true }));
    try {
      const driveLabel  = DRIVES.find(d => d.id === goal.driveId)?.label ?? goal.driveId;
      const goalSkills  = goal.skills.filter(s => s.name).map(s => s.name);
      const goalPayload = [{
        id:          goal.id,
        title:       goal.statement,
        description: goal.description?.trim() || "",
        skill:       goalSkills.join(", "),
        drive:       driveLabel,
      }];

      // Pass existing plan as context so AI refines rather than replaces
      const existingPlan = goal.plan && !goal.plan.fallback
        ? { phases: goal.plan.phases.map(p => ({ id: p.id, name: p.name, actions: p.actions })) }
        : undefined;

      const timelineResp = await safeFetchJson("/api/ai/generate-timeline", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drives: [driveLabel], goals: goalPayload, existingPlan }),
      });

      const isFallback = timelineResp.json?._fallback === true;
      const phases     = timelineResp.json?.phases ?? [];

      if (isFallback) {
        // AI unavailable — open modal with empty editable plan and fallback flag
        const plan: AIRoadmap = {
          phases: [
            { id: "foundation", name: "Foundation", duration: "2–4 weeks", actions: [""] },
            { id: "growth",     name: "Growth",     duration: "4–8 weeks", actions: [""] },
            { id: "mastery",    name: "Mastery",    duration: "8+ weeks",  actions: [""] },
          ],
          suggestions: [],
          fallback: true,
        };
        setGoals(prev => {
          const next = prev.map(g => g.id === goalId ? { ...g, plan } : g);
          persist(drives, next, health);
          return next;
        });
        return;
      }

      if (!phases.length) throw new Error("No phases returned");

      const plan: AIRoadmap = { phases, suggestions: [], fallback: false };
      setGoals(prev => {
        const next = prev.map(g => g.id === goalId ? { ...g, plan } : g);
        persist(drives, next, health);
        return next;
      });
    } catch {
      // button returns to "Generate plan" on failure
    } finally {
      setPlanLoading(prev => { const n = { ...prev }; delete n[goalId]; return n; });
    }
  }


  // ── Detect guest ───────────────────────────────────────────────
  useEffect(() => {
    if (profile !== undefined) {
      setIsGuest(!profile);
      if (!profile && !guestLoaded.current) {
        guestLoaded.current = true;
        const saved = guestLoad();
        if (saved) {
          if (saved.drives) setDrives(saved.drives);
          if (saved.health) setHealth(h => ({ ...h, ...saved.health }));
          if (Array.isArray(saved.goals) && saved.goals.length) {
            setGoals(saved.goals);
            setGoalsOpen(true);
          }
        }
        profileApplied.current = true;
      }
    }
  }, [profile]);

  // ── Load pages ─────────────────────────────────────────────────
  useEffect(() => {
    if (isGuest) return;
    safeFetchJson("/api/user/pages", { method: "GET", credentials: "include" })
      .then(r => { if (r.ok && r.json?.ok) setPages(r.json.pages || []); })
      .catch(() => {});
  }, [isGuest]);

  useEffect(() => {
    const handler = (e: Event) => {
      const page = (e as CustomEvent).detail as PageItem;
      setPages(prev => prev.some(p => p.id === page.id) ? prev : [page, ...prev]);
    };
    window.addEventListener("charaivati:page-created", handler);
    return () => window.removeEventListener("charaivati:page-created", handler);
  }, []);

  // ── Pre-fill from DB profile ───────────────────────────────────
  useEffect(() => {
    if (!profile || profileApplied.current) return;
    profileApplied.current = true;

    // Drives — accept new array field or legacy single-string field
    const loadedDrives: DriveType[] = Array.isArray(profile.drives)
      ? profile.drives
      : profile.drive
        ? (Array.isArray(profile.drive) ? profile.drive : [profile.drive])
        : [];
    if (loadedDrives.length > 0) setDrives(loadedDrives);

    const loadedHealth = profile.health ? { ...defaultHealth(), ...profile.health } : defaultHealth();
    if (profile.health) setHealth(loadedHealth);

    if (Array.isArray(profile.generalSkills)) {
      const gs = profile.generalSkills as SkillEntry[];
      setGeneralSkills(gs);
      generalSkillsRef.current = gs;
    }

    // Goals — handle both new flat array and old drive-keyed object
    let loadedGoals: GoalEntry[] = [];
    if (Array.isArray(profile.goals) && profile.goals.length) {
      // New format: flat array with driveId on each entry
      loadedGoals = profile.goals.map((g: GoalEntry) => ({
        ...g,
        driveId: g.driveId ?? loadedDrives[0] ?? "building",
      }));
    } else if (profile.goals && typeof profile.goals === "object") {
      // Old format: { learning: [...], building: [...] } — migrate on the fly
      const OLD_DRIVES: DriveType[] = ["learning", "helping", "building", "doing"];
      OLD_DRIVES.forEach(driveId => {
        const driveGoals = (profile.goals as any)[driveId];
        if (Array.isArray(driveGoals)) {
          driveGoals.forEach((g: any) => loadedGoals.push({ ...g, driveId }));
        }
      });
    }
    if (loadedGoals.length) {
      setGoals(loadedGoals);
      setGoalsOpen(true);
    }

  }, [profile]);

  // ── Persist ────────────────────────────────────────────────────
  function persist(nextDrives: DriveType[], nextGoals: GoalEntry[], nextHealth: HealthProfile) {
    if (!profileApplied.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    if (isGuest) {
      guestSave({ drives: nextDrives, goals: nextGoals, health: nextHealth });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1200);
      return;
    }

    setSaveState("saving");
    saveTimerRef.current = setTimeout(async () => {
      try {
        const resp = await safeFetchJson("/api/user/profile", {
          method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ drives: nextDrives, goals: nextGoals, health: nextHealth, generalSkills: generalSkillsRef.current }),
        });
        setSaveState(resp.ok && resp.json?.ok ? "saved" : "error");
        if (resp.ok && resp.json?.ok) setTimeout(() => setSaveState("idle"), 1500);
      } catch { setSaveState("error"); }
    }, 800);
  }


  // ── Drive toggle ───────────────────────────────────────────────
  function toggleDrive(d: DriveType) {
    let next: DriveType[];
    if (drives.includes(d)) {
      // Deselecting — goals for this drive stay in state, just hidden
      next = drives.filter(x => x !== d);
    } else {
      if (drives.length < 2) {
        next = [...drives, d];
      } else {
        // Slide window: drop oldest, add new
        // Goals for the dropped drive stay in state (hidden), new drive's column appears
        next = [drives[1], d];
      }
    }
    setDrives(next);
    if (next.length > 0) setGoalsOpen(true);

    // When a new drive is added and has no goals yet, create a blank one for it
    const newDrives = next.filter(id => !drives.includes(id));
    let nextGoals = goals;
    newDrives.forEach(driveId => {
      const hasGoals = goals.some(g => g.driveId === driveId);
      if (!hasGoals) nextGoals = [...nextGoals, defaultGoal(driveId)];
    });
    if (nextGoals !== goals) setGoals(nextGoals);

    persist(next, nextGoals, health);
  }

  // ── Goal helpers ───────────────────────────────────────────────
  function updateGoal(id: string, u: GoalEntry) {
    const next = goals.map(g => g.id === id ? u : g);
    setGoals(next);
  }

  function saveGoal(id: string) {
    const next = goals.map(g => g.id === id ? { ...g, saved: true } : g);
    setGoals(next);
    persist(drives, next, health);
  }

  function editGoal(id: string) {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, saved: false } : g));
  }

  function removeGoal(id: string) {
    const filtered = goals.filter(g => g.id !== id);
    // If a drive now has no goals at all, add a blank placeholder
    const nextGoals = drives.reduce((acc, driveId) => {
      const hasAny = acc.some(g => g.driveId === driveId);
      return hasAny ? acc : [...acc, defaultGoal(driveId)];
    }, filtered);
    setGoals(nextGoals);
    persist(drives, nextGoals, health);
  }

  function saveGoalPlan(id: string, plan: AIRoadmap) {
    setGoals(prev => {
      const next = prev.map(g => g.id === id ? { ...g, plan } : g);
      persist(drives, next, health);
      return next;
    });
  }

  function addGoal(driveId: DriveType) {
    const next = [...goals, defaultGoal(driveId)];
    setGoals(next);
  }

  function handleHealthChange(h: HealthProfile) {
    setHealth(h);
    persist(drives, goals, h);
  }

  function handleGeneralSkillsChange(skills: SkillEntry[]) {
    setGeneralSkills(skills);
    generalSkillsRef.current = skills;
    persist(drives, goals, health);
  }

  function handleGoalSkillsChange(goalId: string, skills: SkillEntry[]) {
    setGoals(prev => {
      const next = prev.map(g => g.id === goalId ? { ...g, skills } : g);
      persist(drives, next, health);
      return next;
    });
  }

  async function suggestGoalSkills(goalId: string) {
    const goal = goals.find(g => g.id === goalId);
    if (!goal?.statement) return;
    setSkillsLoading(prev => ({ ...prev, [goalId]: true }));
    try {
      const resp = await safeFetchJson("/api/ai/suggest-skills", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goal.statement }),
      });
      if (!resp.ok) return;
      if (resp.json?.needsSkills && Array.isArray(resp.json.skills) && resp.json.skills.length > 0) {
        // Merge AI suggestions with any existing manual skills
        const existing = goal.skills.filter(s => s.name);
        const aiSkills = resp.json.skills as SkillEntry[];
        const merged   = [
          ...existing,
          ...aiSkills.filter(ai => !existing.some(e => e.name.toLowerCase() === ai.name.toLowerCase())),
        ];
        handleGoalSkillsChange(goalId, merged);
      } else if (resp.json?.needsSkills === false) {
        // AI decided no skills needed — clear list so card shows the "no skills" hint
        handleGoalSkillsChange(goalId, []);
      }
    } finally {
      setSkillsLoading(prev => { const n = { ...prev }; delete n[goalId]; return n; });
    }
  }

  // ── Summary stats (visible goals only) ────────────────────────
  const allVisibleSaved = visibleGoals.length > 0 && visibleGoals.every(g => g.saved);
  const filledGoals     = visibleGoals.filter(g => g.statement).length;
  const totalSkills     = visibleGoals.reduce((a, g) => a + g.skills.filter(s => s.name).length, 0);
  const monetizable     = visibleGoals.reduce((a, g) => a + g.skills.filter(s => s.monetize && s.name).length, 0);

  return (
    <div className="text-white space-y-5">

      {/* ── What keeps you moving? ───────────────────────────────── */}
      <SectionCard>
        <div className="px-5 pt-5 pb-2 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">What keeps you moving?</h2>
            {isGuest && (
              <p className="text-sm text-yellow-600 mt-1">
                Guest mode — saved locally for 7 days.{" "}
                <a href="/login" className="underline hover:text-yellow-400">Sign in</a> to sync.
              </p>
            )}
          </div>
          <span className={`text-xs mt-1 transition-opacity ${
            saveState === "idle"   ? "opacity-0"                  :
            saveState === "saving" ? "opacity-100 text-gray-500"  :
            saveState === "saved"  ? "opacity-100 text-green-500" :
                                     "opacity-100 text-red-400"
          }`}>
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : "·"}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 pb-5">
          {DRIVES.map(d => {
            const selected = drives.includes(d.id);
            const atLimit  = !selected && drives.length >= 2;
            return (
              <button key={d.id} type="button" onClick={() => toggleDrive(d.id)} disabled={atLimit}
                className={`rounded-xl border px-4 py-4 text-left transition-all ${
                  selected
                    ? "border-indigo-500 bg-indigo-500/10"
                    : atLimit
                      ? "border-gray-800 bg-gray-950/20 opacity-40 cursor-not-allowed"
                      : "border-gray-800 bg-gray-950/40 hover:border-gray-600"
                }`}>
                <div className={`text-sm font-semibold mb-1 ${selected ? "text-indigo-300" : "text-white"}`}>
                  {selected && <span className="mr-1.5 text-indigo-400">✓</span>}{d.label}
                </div>
                <div className="text-xs text-gray-500">{d.description}</div>
              </button>
            );
          })}
        </div>

        {drives.length > 0 && (
          <div className="px-5 pb-4 border-t border-gray-800 pt-3">
            <button type="button" onClick={() => setGoalsOpen(v => !v)}
              className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
              {goalsOpen ? <><ChevronUp className="w-4 h-4" />Hide goals</> : <><ChevronDown className="w-4 h-4" />Set my goals</>}
            </button>
          </div>
        )}
      </SectionCard>

      {/* ── Goals columns + Health ────────────────────────────────── */}
      {drives.length > 0 && goalsOpen && (
        <>
          <SectionCard>
            <div className="px-5 pt-5 pb-3">
              <h2 className="text-xl font-semibold">What do you want to do?</h2>
            </div>

            {/* Two-column layout — one column per active drive */}
            <div className={`px-5 pb-5 gap-4 ${drives.length === 2 ? "grid grid-cols-1 sm:grid-cols-2" : "flex flex-col"}`}>
              {drives.map(driveId => {
                const driveInfo  = DRIVES.find(d => d.id === driveId)!;
                const driveGoals = goals.filter(g => g.driveId === driveId);
                return (
                  <DriveColumn
                    key={driveId}
                    drive={driveInfo}
                    goals={driveGoals}
                    pages={pages}
                    onUpdateGoal={updateGoal}
                    onSaveGoal={saveGoal}
                    onEditGoal={editGoal}
                    onRemoveGoal={removeGoal}
                    onAddGoal={addGoal}
                    planLoading={planLoading}
                    onGeneratePlan={generateGoalPlan}
                    onSavePlan={saveGoalPlan}
                    onRegenerate={generateGoalPlan}
                  />
                );
              })}
            </div>

          </SectionCard>

          {/* Skills */}
          <div>
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="h-px flex-1 bg-gray-800" />
              <span className="text-xs text-gray-600 uppercase tracking-wider">Skills · general &amp; goal-specific</span>
              <div className="h-px flex-1 bg-gray-800" />
            </div>
            <SkillsSection
              generalSkills={generalSkills}
              goals={visibleGoals}
              skillsLoading={skillsLoading}
              onUpdateGeneralSkills={handleGeneralSkillsChange}
              onUpdateGoalSkills={handleGoalSkillsChange}
              onSuggestSkills={suggestGoalSkills}
            />
          </div>

          {/* Health */}
          <div>
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="h-px flex-1 bg-gray-800" />
              <span className="text-xs text-gray-600 uppercase tracking-wider">Your health · applies to all goals</span>
              <div className="h-px flex-1 bg-gray-800" />
            </div>
            <HealthSection health={health} setHealth={handleHealthChange} />
          </div>

          {/* Summary CTA */}
          {filledGoals > 0 && allVisibleSaved && (
            <SectionCard className="px-5 py-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-sm font-semibold text-white">Foundation set</p>
                  <p className="text-xs text-gray-500 mt-0.5 flex gap-3 flex-wrap">
                    <span>{filledGoals} goal{filledGoals > 1 ? "s" : ""}</span>
                    <span>{totalSkills} skill{totalSkills !== 1 ? "s" : ""}</span>
                    {monetizable > 0 && <span className="text-indigo-400">{monetizable} monetizable</span>}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="px-4 py-2 rounded-lg border border-gray-700 bg-gray-800
                    hover:bg-gray-700 text-sm text-gray-300 transition-colors">Go to Learn →</button>
                  <button className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500
                    text-sm text-white font-medium transition-colors">Go to Earn →</button>
                </div>
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}