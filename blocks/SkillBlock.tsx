"use client";
// blocks/SkillBlock.tsx — SkillRow + SkillsSection

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Sparkles, Loader2 } from "lucide-react";
import { CollapsibleSection, uid } from "@/components/self/shared";
import type { SkillEntry, GoalEntry } from "@/types/self";

export type { SkillEntry };

// ─── Skill Row — bullet point style ──────────────────────────────────────────

export function SkillRow({ skill, onChange, onRemove }: {
  skill: SkillEntry;
  onChange: (s: SkillEntry) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 group py-0.5">
      <span className="text-gray-600 flex-shrink-0 text-base leading-none">·</span>
      <input
        value={skill.name}
        onChange={e => onChange({ ...skill, name: e.target.value })}
        placeholder="Skill name"
        className="flex-1 min-w-0 bg-transparent text-sm text-gray-200 placeholder-gray-600 outline-none"
      />
      <button type="button" onClick={onRemove}
        className="text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0">
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── Inline add-skill input ───────────────────────────────────────────────────

function AddSkillInline({ onCommit }: { onCommit: (name: string) => void }) {
  const [val, setVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => { inputRef.current?.focus(); }, []);

  function commit() {
    const trimmed = val.trim();
    onCommit(trimmed); // parent handles empty (cancels)
  }

  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-indigo-500 flex-shrink-0 text-base leading-none">·</span>
      <input
        ref={inputRef}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") onCommit(""); }}
        placeholder="Type skill and press Enter"
        className="flex-1 min-w-0 bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none"
      />
    </div>
  );
}

// ─── Goal Skill Box ───────────────────────────────────────────────────────────

function GoalSkillBox({ goal, skillsLoading, onUpdateGoalSkills, onSuggestSkills, highlight }: {
  goal: GoalEntry;
  skillsLoading: Record<string, boolean>;
  onUpdateGoalSkills: (goalId: string, skills: SkillEntry[]) => void;
  onSuggestSkills: (goalId: string) => void;
  highlight: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const namedSkills = goal.skills.filter(s => s.name.trim() !== "");

  function commitNew(name: string) {
    if (name) onUpdateGoalSkills(goal.id, [...goal.skills, { id: uid(), name, level: "Beginner", monetize: false }]);
    setAdding(false);
  }

  return (
    <div className={`rounded-xl border bg-gray-950/60 p-4 space-y-3 ${
      highlight ? "goal-skill-highlight border-indigo-500/60" : "border-gray-800"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-white line-clamp-2 flex-1">{goal.statement}</p>
        <button type="button"
          onClick={() => onSuggestSkills(goal.id)}
          disabled={!!skillsLoading[goal.id]}
          className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-700
            text-xs text-gray-400 hover:border-indigo-500/40 hover:text-indigo-300
            hover:bg-indigo-500/10 transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0">
          {skillsLoading[goal.id]
            ? <><Loader2 className="w-3 h-3 animate-spin" />Suggesting…</>
            : <><Sparkles className="w-3 h-3" />Suggest</>}
        </button>
      </div>

      <div className="space-y-1">
        {namedSkills.map((skill, si) => (
          <SkillRow key={skill.id} skill={skill}
            onChange={s => onUpdateGoalSkills(goal.id, goal.skills.map((gs) => gs.id === skill.id ? s : gs))}
            onRemove={() => onUpdateGoalSkills(goal.id, goal.skills.filter(gs => gs.id !== skill.id))}
          />
        ))}
        {adding && <AddSkillInline onCommit={commitNew} />}
        {namedSkills.length === 0 && !adding && !skillsLoading[goal.id] && (
          <p className="text-xs text-gray-600">No skills added yet.</p>
        )}
      </div>

      {!adding && (
        <button type="button" onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-400 transition-colors">
          <Plus className="w-3 h-3" /> Add skill
        </button>
      )}
    </div>
  );
}

// ─── General Skill Box ────────────────────────────────────────────────────────

function GeneralSkillBox({ generalSkills, onUpdateGeneralSkills }: {
  generalSkills: SkillEntry[];
  onUpdateGeneralSkills: (skills: SkillEntry[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const namedSkills = generalSkills.filter(s => s.name.trim() !== "");

  function commitNew(name: string) {
    if (name) onUpdateGeneralSkills([...generalSkills, { id: uid(), name, level: "Beginner", monetize: false }]);
    setAdding(false);
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4 space-y-3">
      <p className="text-sm font-semibold text-white">General</p>
      <div className="space-y-1">
        {namedSkills.map((skill) => (
          <SkillRow key={skill.id} skill={skill}
            onChange={s => onUpdateGeneralSkills(generalSkills.map(gs => gs.id === skill.id ? s : gs))}
            onRemove={() => onUpdateGeneralSkills(generalSkills.filter(gs => gs.id !== skill.id))}
          />
        ))}
        {adding && <AddSkillInline onCommit={commitNew} />}
        {namedSkills.length === 0 && !adding && (
          <p className="text-xs text-gray-600">e.g. Communication, Leadership</p>
        )}
      </div>
      {!adding && (
        <button type="button" onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-400 transition-colors">
          <Plus className="w-3 h-3" /> Add skill
        </button>
      )}
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
  highlightGoalId,
}: {
  generalSkills: SkillEntry[];
  goals: GoalEntry[];
  skillsLoading: Record<string, boolean>;
  onUpdateGeneralSkills: (skills: SkillEntry[]) => void;
  onUpdateGoalSkills: (goalId: string, skills: SkillEntry[]) => void;
  onSuggestSkills: (goalId: string) => void;
  highlightGoalId?: string | null;
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
            />
          ))}

          <GeneralSkillBox
            generalSkills={generalSkills}
            onUpdateGeneralSkills={onUpdateGeneralSkills}
          />

        </div>
      </div>
    </CollapsibleSection>
  );
}
