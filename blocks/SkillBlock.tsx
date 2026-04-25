"use client";
// blocks/SkillBlock.tsx — SkillRow + SkillsSection

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Sparkles, Loader2, X } from "lucide-react";
import { CollapsibleSection, uid, AiStatusBadge } from "@/components/self/shared";
import type { SkillEntry, GoalEntry, DayKey, WeekSchedule, Task } from "@/types/self";

export type { SkillEntry };

// ─── Day constants ────────────────────────────────────────────────────────────

const DAYS: { key: DayKey; short: string }[] = [
  { key: "mon", short: "Mon" },
  { key: "tue", short: "Tue" },
  { key: "wed", short: "Wed" },
  { key: "thu", short: "Thu" },
  { key: "fri", short: "Fri" },
  { key: "sat", short: "Sat" },
  { key: "sun", short: "Sun" },
];

// ─── Skill Edit Modal ─────────────────────────────────────────────────────────

function SkillEditModal({
  initialName,
  initialDays,
  goalName,
  onSave,
  onCancel,
}: {
  initialName: string;
  initialDays: DayKey[];
  goalName?: string;
  onSave: (name: string, days: DayKey[]) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [days, setDays] = useState<DayKey[]>(initialDays);

  function toggleDay(d: DayKey) {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  }

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, days);
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
        style={{ animation: "panelIn 200ms ease both" }}>
        <style>{`
          @keyframes panelIn {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            {goalName && (
              <p className="text-xs text-indigo-400/80 mb-0.5 truncate max-w-[220px]">{goalName}</p>
            )}
            <p className="text-base font-semibold text-white">
              {initialName ? "Edit skill" : "Add skill"}
            </p>
          </div>
          <button type="button" onClick={onCancel}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors -mt-1 -mr-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Skill name */}
        <div className="mb-5">
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }}
            placeholder="e.g. Python, Leadership, Design"
            className="w-full rounded-xl border border-gray-700 bg-gray-950/60 px-3 py-2.5 text-sm
              text-white placeholder-gray-600 outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Day picker */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">
            Practice on
          </p>
          <div className="grid grid-cols-7 gap-1.5">
            {DAYS.map(d => (
              <button key={d.key} type="button" onClick={() => toggleDay(d.key)}
                className={`py-2 rounded-lg border text-xs font-medium transition-colors ${
                  days.includes(d.key)
                    ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                    : "border-gray-700 bg-gray-800/50 text-gray-500 hover:border-gray-500 hover:text-gray-300"
                }`}>
                {d.short}
              </button>
            ))}
          </div>
          {days.length > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              {days.length} day{days.length > 1 ? "s" : ""} — will appear in your Time table
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button type="button" onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 bg-gray-800/50 text-sm text-gray-400
              hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm text-white
              font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Skill Row ────────────────────────────────────────────────────────────────

export function SkillRow({ skill, onEdit, onRemove }: {
  skill: SkillEntry;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 group py-0.5">
      <span className="text-gray-600 flex-shrink-0 text-base leading-none">·</span>
      <button type="button" onClick={onEdit}
        className="flex-1 min-w-0 text-left text-sm text-gray-200 hover:text-white transition-colors truncate">
        {skill.name}
      </button>
      <button type="button" onClick={e => { e.stopPropagation(); onRemove(); }}
        className="text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0">
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── Goal Skill Box ───────────────────────────────────────────────────────────

function GoalSkillBox({
  goal, skillsLoading, onUpdateGoalSkills, onSuggestSkills, highlight,
  schedule, onScheduleChange,
}: {
  goal: GoalEntry;
  skillsLoading: Record<string, boolean>;
  onUpdateGoalSkills: (goalId: string, skills: SkillEntry[]) => void;
  onSuggestSkills: (goalId: string) => void;
  highlight: boolean;
  schedule: WeekSchedule;
  onScheduleChange: (s: WeekSchedule) => void;
}) {
  const [modal, setModal] = useState<{ skill: SkillEntry; isNew: boolean } | null>(null);
  const [suggestStatus, setSuggestStatus] = useState<"ai" | "fallback" | null>(null);
  const wasLoadingRef = useRef(false);
  const namedSkills = goal.skills.filter(s => s.name.trim() !== "");

  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlight && boxRef.current) {
      boxRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlight]);

  // Detect when a suggest call completes and infer AI vs fallback from skill IDs
  useEffect(() => {
    const isLoading = !!skillsLoading[goal.id];
    if (isLoading && !wasLoadingRef.current) {
      wasLoadingRef.current = true;
      setSuggestStatus(null);
    } else if (!isLoading && wasLoadingRef.current) {
      wasLoadingRef.current = false;
      const hasAiSkills = goal.skills.some(s => s.id.startsWith("ai-"));
      setSuggestStatus(hasAiSkills ? "ai" : "fallback");
    }
  }, [skillsLoading, goal.id, goal.skills]);

  function existingDays(skillName: string): DayKey[] {
    const seen = new Set<DayKey>();
    return schedule.slots
      .filter(sl => sl.goalId === goal.id && sl.activity === skillName)
      .map(sl => sl.day)
      .filter(d => !seen.has(d) && seen.add(d));
  }

  function openAdd() {
    setModal({ skill: { id: uid(), name: "", level: "Beginner", monetize: false }, isNew: true });
  }

  function openEdit(skill: SkillEntry) {
    setModal({ skill, isNew: false });
  }

  function handleSave(name: string, days: DayKey[]) {
    if (!modal) return;
    const updated: SkillEntry = { ...modal.skill, name, level: "Beginner" };

    // Update skills
    const newSkills = modal.isNew
      ? [...goal.skills, updated]
      : goal.skills.map(s => s.id === modal.skill.id ? updated : s);
    onUpdateGoalSkills(goal.id, newSkills);

    // Sync slots (used elsewhere)
    const oldName = modal.isNew ? name : modal.skill.name;
    const filteredSlots = schedule.slots.filter(
      sl => !(sl.goalId === goal.id && sl.activity === oldName)
    );
    const newSlots = days.map(day => ({
      id: uid(), day, startHour: 8, endHour: 9,
      goalId: goal.id, activity: name, isFlexible: true,
    }));

    // Sync tasks — remove old, add new per selected day
    const filteredTasks = (schedule.tasks ?? []).filter(
      t => !(t.goalId === goal.id && t.title === oldName)
    );
    const newTasks: Task[] = days.map(day => ({
      id: uid(), title: name, done: false, day, goalId: goal.id,
    }));

    onScheduleChange({
      ...schedule,
      slots: [...filteredSlots, ...newSlots],
      tasks: [...filteredTasks, ...newTasks],
    });
    setModal(null);
  }

  return (
    <>
      {modal && (
        <SkillEditModal
          initialName={modal.skill.name}
          initialDays={existingDays(modal.skill.name)}
          goalName={goal.statement}
          onSave={handleSave}
          onCancel={() => setModal(null)}
        />
      )}
      <div ref={boxRef} className={`rounded-xl border bg-gray-950/60 p-4 space-y-3 ${
        highlight ? "goal-skill-highlight border-indigo-500/60" : "border-gray-800"
      }`}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-white line-clamp-2 flex-1">{goal.statement}</p>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!skillsLoading[goal.id] && <AiStatusBadge status={suggestStatus} />}
            <button type="button"
              onClick={() => onSuggestSkills(goal.id)}
              disabled={!!skillsLoading[goal.id]}
              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-700
                text-xs text-gray-400 hover:border-indigo-500/40 hover:text-indigo-300
                hover:bg-indigo-500/10 transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
              {skillsLoading[goal.id]
                ? <><Loader2 className="w-3 h-3 animate-spin" />Suggesting…</>
                : <><Sparkles className="w-3 h-3" />Suggest</>}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          {namedSkills.map(skill => (
            <SkillRow key={skill.id} skill={skill}
              onEdit={() => openEdit(skill)}
              onRemove={() => onUpdateGoalSkills(goal.id, goal.skills.filter(gs => gs.id !== skill.id))}
            />
          ))}
          {namedSkills.length === 0 && !skillsLoading[goal.id] && (
            <p className="text-xs text-gray-600">No skills added yet.</p>
          )}
        </div>

        <button type="button" onClick={openAdd}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-400 transition-colors">
          <Plus className="w-3 h-3" /> Add skill
        </button>
      </div>
    </>
  );
}

// ─── General Skill Box ────────────────────────────────────────────────────────

function GeneralSkillBox({
  generalSkills, onUpdateGeneralSkills,
  schedule, onScheduleChange, highlight,
}: {
  generalSkills: SkillEntry[];
  onUpdateGeneralSkills: (skills: SkillEntry[]) => void;
  schedule: WeekSchedule;
  onScheduleChange: (s: WeekSchedule) => void;
  highlight?: boolean;
}) {
  const [modal, setModal] = useState<{ skill: SkillEntry; isNew: boolean } | null>(null);
  const namedSkills = generalSkills.filter(s => s.name.trim() !== "");

  function existingDays(skillName: string): DayKey[] {
    const seen = new Set<DayKey>();
    return schedule.slots
      .filter(sl => sl.goalId === "general" && sl.activity === skillName)
      .map(sl => sl.day)
      .filter(d => !seen.has(d) && seen.add(d));
  }

  function openAdd() {
    setModal({ skill: { id: uid(), name: "", level: "Beginner", monetize: false }, isNew: true });
  }

  function openEdit(skill: SkillEntry) {
    setModal({ skill, isNew: false });
  }

  function handleSave(name: string, days: DayKey[]) {
    if (!modal) return;
    const updated: SkillEntry = { ...modal.skill, name, level: "Beginner" };

    const newSkills = modal.isNew
      ? [...generalSkills, updated]
      : generalSkills.map(s => s.id === modal.skill.id ? updated : s);
    onUpdateGeneralSkills(newSkills);

    const oldName = modal.isNew ? name : modal.skill.name;
    const filteredSlots = schedule.slots.filter(
      sl => !(sl.goalId === "general" && sl.activity === oldName)
    );
    const newSlots = days.map(day => ({
      id: uid(), day, startHour: 8, endHour: 9,
      goalId: "general", activity: name, isFlexible: true,
    }));
    const filteredTasks = (schedule.tasks ?? []).filter(
      t => !(t.goalId === "general" && t.title === oldName)
    );
    const newTasks: Task[] = days.map(day => ({
      id: uid(), title: name, done: false, day, goalId: "general",
    }));
    onScheduleChange({
      ...schedule,
      slots: [...filteredSlots, ...newSlots],
      tasks: [...filteredTasks, ...newTasks],
    });
    setModal(null);
  }

  return (
    <>
      {modal && (
        <SkillEditModal
          initialName={modal.skill.name}
          initialDays={existingDays(modal.skill.name)}
          goalName="General skills"
          onSave={handleSave}
          onCancel={() => setModal(null)}
        />
      )}
      <div className={`rounded-xl border border-gray-800 bg-gray-950/60 p-4 space-y-3${highlight ? " goal-skill-highlight" : ""}`}>
        <p className="text-sm font-semibold text-white">General</p>
        <div className="space-y-1">
          {namedSkills.map(skill => (
            <SkillRow key={skill.id} skill={skill}
              onEdit={() => openEdit(skill)}
              onRemove={() => onUpdateGeneralSkills(generalSkills.filter(gs => gs.id !== skill.id))}
            />
          ))}
          {namedSkills.length === 0 && (
            <p className="text-xs text-gray-600">e.g. Communication, Leadership</p>
          )}
        </div>
        <button type="button" onClick={openAdd}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-400 transition-colors">
          <Plus className="w-3 h-3" /> Add skill
        </button>
      </div>
    </>
  );
}

// ─── Skills Section ───────────────────────────────────────────────────────────

export function SkillsSection({
  generalSkills,
  goals,
  skillsLoading,
  onUpdateGeneralSkills,
  onUpdateGoalSkills,
  onSuggestSkills,
  highlightGoalId,
  highlightGeneral,
  schedule,
  onScheduleChange,
}: {
  generalSkills: SkillEntry[];
  goals: GoalEntry[];
  skillsLoading: Record<string, boolean>;
  onUpdateGeneralSkills: (skills: SkillEntry[]) => void;
  onUpdateGoalSkills: (goalId: string, skills: SkillEntry[]) => void;
  onSuggestSkills: (goalId: string) => void;
  highlightGoalId?: string | null;
  highlightGeneral?: boolean;
  schedule: WeekSchedule;
  onScheduleChange: (s: WeekSchedule) => void;
}) {
  const router = useRouter();
  const savedGoals = goals.filter(g => g.saved && g.statement);

  const learnBtn = (
    <button type="button"
      onClick={e => { e.stopPropagation(); router.push("/self?tab=learn"); }}
      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-700
        text-xs text-gray-400 hover:border-sky-500/40 hover:text-sky-300
        hover:bg-sky-500/10 transition-colors whitespace-nowrap">
      Learn →
    </button>
  );

  return (
    <CollapsibleSection title="Skills" headerExtra={learnBtn}>
      <style>{`
        @keyframes goalSkillHighlight {
          0%   { border-color: rgb(31,41,55); box-shadow: none; }
          25%  { border-color: rgba(99,102,241,0.9);
                 box-shadow: -140px 0 100px rgba(129,140,248,0.55) inset, 0 0 22px rgba(99,102,241,0.45); }
          65%  { border-color: rgba(99,102,241,0.6);
                 box-shadow: 140px 0 100px rgba(129,140,248,0.4) inset, 0 0 14px rgba(99,102,241,0.25); }
          100% { border-color: rgb(31,41,55); box-shadow: none; }
        }
        .goal-skill-highlight {
          animation: goalSkillHighlight 0.9s ease-in-out 3 forwards;
        }
      `}</style>
      <div className="space-y-6 pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {[...savedGoals].reverse().map(goal => (
            <GoalSkillBox
              key={goal.id}
              goal={goal}
              skillsLoading={skillsLoading}
              onUpdateGoalSkills={onUpdateGoalSkills}
              onSuggestSkills={onSuggestSkills}
              highlight={highlightGoalId === goal.id}
              schedule={schedule}
              onScheduleChange={onScheduleChange}
            />
          ))}

          <GeneralSkillBox
            generalSkills={generalSkills}
            onUpdateGeneralSkills={onUpdateGeneralSkills}
            highlight={highlightGeneral}
            schedule={schedule}
            onScheduleChange={onScheduleChange}
          />

        </div>
      </div>
    </CollapsibleSection>
  );
}
