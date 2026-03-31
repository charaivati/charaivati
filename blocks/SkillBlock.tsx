"use client";
// blocks/SkillBlock.tsx — SkillRow + SkillsSection

import React from "react";
import { Plus, Trash2, Sparkles, Loader2 } from "lucide-react";
import { CollapsibleSection, uid } from "@/components/self/shared";
import type { SkillEntry, GoalEntry } from "@/types/self";

export type { SkillEntry };

const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;

// ─── Skill Row ────────────────────────────────────────────────────────────────

export function SkillRow({ skill, onChange, onRemove }: {
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

export function SkillsSection({
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
  const savedGoals = goals.filter(g => g.saved && g.statement);

  return (
    <CollapsibleSection title="Skills">
      <div className="space-y-6 pt-2">
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
    </CollapsibleSection>
  );
}
