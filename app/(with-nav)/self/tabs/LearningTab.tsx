"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

type DriveType = "learning" | "helping" | "building" | "doing";
type Horizon = "thisYear" | "threeYears" | "lifetime";
type SkillLevel = "beginner" | "intermediate" | "advanced";

type GoalEntry = {
  id: string;
  title: string;
  horizon: Horizon;
  skill: string;
  skillLevel: SkillLevel;
  earnFromSkill: boolean;
};

type HealthProfile = {
  note: string;
};

type TimelinePhase = {
  id: string;
  name: string;
  duration: string;
  actions: string[];
};

type SuggestionType = "skill" | "health" | "network" | "execution";
type SuggestionPriority = "low" | "medium" | "high";

type ActionSuggestion = {
  id: string;
  text: string;
  type: SuggestionType;
  priority: SuggestionPriority;
};

type WeekDayPlan = {
  day: string;
  tasks: string[];
};

type UserPlanTask = {
  id: string;
  text: string;
  type: SuggestionType;
  priority: SuggestionPriority;
  day: string;
  completed: boolean;
};

type LearningStoredState = {
  drives: DriveType[];
  goalsByDrive: Record<DriveType, GoalEntry[]>;
  lastInteractedDrive: DriveType | null;
  health: HealthProfile;
  timeline: TimelinePhase[];
  currentPhase: string | null;
  userPlan: {
    tasks: UserPlanTask[];
  };
};

type DriveOption = {
  id: DriveType;
  title: string;
  subtitle: string;
};

const LS_KEY = "self_learning_tab_state_v3";
const MAX_DRIVES = 2;
const MAX_GOALS_PER_DRIVE = 2;

const DRIVE_OPTIONS: DriveOption[] = [
  { id: "learning", title: "Learning", subtitle: "Curious about everything" },
  { id: "helping", title: "Helping", subtitle: "Here for the people" },
  { id: "building", title: "Building", subtitle: "Making things happen" },
  { id: "doing", title: "Doing", subtitle: "Master of the craft" },
];

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function createGoalsByDrive(): Record<DriveType, GoalEntry[]> {
  return {
    learning: [],
    helping: [],
    building: [],
    doing: [],
  };
}

function createId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultGoal(): GoalEntry {
  return {
    id: createId("goal"),
    title: "",
    horizon: "thisYear",
    skill: "",
    skillLevel: "beginner",
    earnFromSkill: false,
  };
}

function isDriveType(value: unknown): value is DriveType {
  return ["learning", "helping", "building", "doing"].includes(String(value));
}

function sanitizeStoredState(input: unknown): LearningStoredState {
  const fallback: LearningStoredState = {
    drives: ["learning"],
    goalsByDrive: createGoalsByDrive(),
    lastInteractedDrive: "learning",
    health: { note: "" },
    timeline: [],
    currentPhase: null,
    userPlan: { tasks: [] },
  };

  if (!input || typeof input !== "object") return fallback;

  const obj = input as Partial<LearningStoredState>;
  const drives = Array.isArray(obj.drives)
    ? obj.drives.filter(isDriveType).slice(0, MAX_DRIVES)
    : fallback.drives;

  const goalsRaw =
    obj.goalsByDrive && typeof obj.goalsByDrive === "object"
      ? obj.goalsByDrive
      : {};

  const goalsByDrive = createGoalsByDrive();
  (Object.keys(goalsByDrive) as DriveType[]).forEach((drive) => {
    const source = (goalsRaw as Record<string, unknown>)[drive];
    if (!Array.isArray(source)) return;

    goalsByDrive[drive] = source.slice(0, MAX_GOALS_PER_DRIVE).map((entry) => {
      const goal = entry as Partial<GoalEntry>;
      return {
        id: typeof goal.id === "string" && goal.id ? goal.id : createId("goal"),
        title: typeof goal.title === "string" ? goal.title : "",
        horizon:
          goal.horizon === "thisYear" ||
          goal.horizon === "threeYears" ||
          goal.horizon === "lifetime"
            ? goal.horizon
            : "thisYear",
        skill: typeof goal.skill === "string" ? goal.skill : "",
        skillLevel:
          goal.skillLevel === "beginner" ||
          goal.skillLevel === "intermediate" ||
          goal.skillLevel === "advanced"
            ? goal.skillLevel
            : "beginner",
        earnFromSkill: Boolean(goal.earnFromSkill),
      };
    });
  });

  const timeline = Array.isArray(obj.timeline)
    ? obj.timeline
        .map((phase) => {
          const p = phase as Partial<TimelinePhase>;
          return {
            id: typeof p.id === "string" && p.id ? p.id : createId("phase"),
            name: typeof p.name === "string" ? p.name : "Phase",
            duration: typeof p.duration === "string" ? p.duration : "1 week",
            actions: Array.isArray(p.actions)
              ? p.actions.filter((x): x is string => typeof x === "string")
              : [],
          };
        })
        .slice(0, 6)
    : [];

  const tasks =
    obj.userPlan && Array.isArray(obj.userPlan.tasks)
      ? obj.userPlan.tasks
          .map((task) => {
            const t = task as Partial<UserPlanTask>;
            return {
              id: typeof t.id === "string" && t.id ? t.id : createId("task"),
              text: typeof t.text === "string" ? t.text : "",
              type:
                t.type === "skill" ||
                t.type === "health" ||
                t.type === "network" ||
                t.type === "execution"
                  ? t.type
                  : "execution",
              priority:
                t.priority === "low" || t.priority === "medium" || t.priority === "high"
                  ? t.priority
                  : "medium",
              day: typeof t.day === "string" ? t.day : "Mon",
              completed: Boolean(t.completed),
            };
          })
          .filter((task) => task.text.trim().length > 0)
      : [];

  return {
    drives,
    goalsByDrive,
    lastInteractedDrive:
      isDriveType(obj.lastInteractedDrive) && drives.includes(obj.lastInteractedDrive)
        ? obj.lastInteractedDrive
        : drives[0] ?? null,
    health: {
      note:
        obj.health && typeof obj.health === "object" && typeof obj.health.note === "string"
          ? obj.health.note
          : "",
    },
    timeline,
    currentPhase:
      typeof obj.currentPhase === "string" && timeline.some((p) => p.id === obj.currentPhase)
        ? obj.currentPhase
        : timeline[0]?.id ?? null,
    userPlan: { tasks },
  };
}

function GoalCard({
  goal,
  index,
  onUpdate,
  onRemove,
}: {
  goal: GoalEntry;
  index: number;
  onUpdate: (patch: Partial<GoalEntry>) => void;
  onRemove: () => void;
}) {
  return (
    <article className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/80 text-xs font-bold">
          {index + 1}
        </div>
        <input
          value={goal.title}
          onChange={(event) => onUpdate({ title: event.target.value })}
          placeholder="Describe this goal"
          className="flex-1 border-b border-gray-700 bg-transparent pb-1 text-white outline-none"
        />
        <button
          type="button"
          onClick={onRemove}
          className="text-sm text-gray-400 hover:text-red-300"
        >
          Delete
        </button>
      </div>

      <div className="mt-4">
        <p className="text-xs uppercase tracking-wide text-gray-400">Horizon</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            { id: "thisYear", label: "This year" },
            { id: "threeYears", label: "3 Years" },
            { id: "lifetime", label: "Lifetime" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onUpdate({ horizon: item.id as Horizon })}
              className={`rounded-full border px-3 py-1 text-xs ${
                goal.horizon === item.id
                  ? "border-indigo-500 bg-indigo-500/20 text-indigo-200"
                  : "border-gray-700 text-gray-300"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs uppercase tracking-wide text-gray-400">Skills for this goal</p>
        <input
          value={goal.skill}
          onChange={(event) => onUpdate({ skill: event.target.value })}
          placeholder="Add a skill"
          className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
        />

        <div className="mt-2 flex flex-wrap gap-2">
          {[
            { id: "beginner", label: "Beginner" },
            { id: "intermediate", label: "Intermediate" },
            { id: "advanced", label: "Advanced" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onUpdate({ skillLevel: item.id as SkillLevel })}
              className={`rounded-full border px-3 py-1 text-xs ${
                goal.skillLevel === item.id
                  ? "border-indigo-500 bg-indigo-500/20 text-indigo-200"
                  : "border-gray-700 text-gray-300"
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onUpdate({ earnFromSkill: !goal.earnFromSkill })}
            className={`rounded-full border px-3 py-1 text-xs ${
              goal.earnFromSkill
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                : "border-gray-700 text-gray-300"
            }`}
          >
            Earn from this?
          </button>
        </div>
      </div>
    </article>
  );
}

function TimelineSection({
  timeline,
  currentPhase,
  expanded,
  onToggleExpand,
  onSelectPhase,
  onGenerate,
  loading,
  error,
}: {
  timeline: TimelinePhase[];
  currentPhase: string | null;
  expanded: Record<string, boolean>;
  onToggleExpand: (phaseId: string) => void;
  onSelectPhase: (phaseId: string) => void;
  onGenerate: () => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">AI Timeline Generator</h3>
          <p className="mt-1 text-sm text-gray-300">
            Foundation → Growth → Mastery phases generated from your drives, goals, and health.
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading}
          className="rounded-lg border border-indigo-400/40 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-60"
        >
          {loading ? "Generating..." : "Generate timeline"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

      {timeline.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {timeline.map((phase) => {
            const open = Boolean(expanded[phase.id]);
            const selected = phase.id === currentPhase;
            return (
              <article
                key={phase.id}
                className={`rounded-xl border p-3 ${
                  selected
                    ? "border-indigo-500/60 bg-indigo-500/10"
                    : "border-gray-800 bg-gray-950/50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectPhase(phase.id)}
                  className="w-full text-left"
                >
                  <p className="text-sm font-semibold text-white">{phase.name}</p>
                  <p className="mt-1 text-xs text-gray-400">{phase.duration}</p>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleExpand(phase.id)}
                  className="mt-2 text-xs text-indigo-300 hover:text-indigo-200"
                >
                  {open ? "Hide actions" : "Show actions"}
                </button>

                {open && (
                  <ul className="mt-2 space-y-1 text-xs text-gray-300">
                    {phase.actions.map((action) => (
                      <li key={`${phase.id}-${action}`}>• {action}</li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SuggestionsSidebar({
  suggestions,
  addedSuggestionIds,
  loading,
  error,
  onAdd,
  onDismiss,
  onRegenerate,
}: {
  suggestions: ActionSuggestion[];
  addedSuggestionIds: Record<string, boolean>;
  loading: boolean;
  error: string | null;
  onAdd: (suggestion: ActionSuggestion) => void;
  onDismiss: (suggestionId: string) => void;
  onRegenerate: () => void;
}) {
  return (
    <aside className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Dynamic Suggestions</h4>
        <button
          type="button"
          onClick={onRegenerate}
          className="text-xs text-indigo-300 hover:text-indigo-200"
        >
          Regenerate
        </button>
      </div>

      {loading && <p className="mt-2 text-xs text-gray-400">Generating suggestions...</p>}
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}

      <div className="mt-3 space-y-2">
        {suggestions.length === 0 && !loading && (
          <p className="text-xs text-gray-400">No suggestions yet. Generate timeline first.</p>
        )}

        {suggestions.map((suggestion) => {
          const added = Boolean(addedSuggestionIds[suggestion.id]);
          const priorityClass =
            suggestion.priority === "high"
              ? "ring-1 ring-amber-400/40"
              : suggestion.priority === "medium"
                ? "ring-1 ring-indigo-400/20"
                : "";

          return (
            <div
              key={suggestion.id}
              className={`rounded-lg border border-gray-800 bg-gray-950/50 p-3 ${priorityClass}`}
            >
              <p className="text-sm text-gray-200">{suggestion.text}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide">
                  <span className="rounded-full bg-gray-800 px-2 py-1 text-gray-300">
                    {suggestion.type}
                  </span>
                  <span className="rounded-full bg-gray-800 px-2 py-1 text-gray-300">
                    {suggestion.priority}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onDismiss(suggestion.id)}
                    className="text-xs text-gray-400 hover:text-gray-200"
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    disabled={added}
                    onClick={() => onAdd(suggestion)}
                    className="rounded border border-indigo-400/40 px-2 py-1 text-xs text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50"
                  >
                    {added ? "Added" : "+ Add"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function WeeklyExecutionPlan({
  weekPlan,
  userPlan,
  onUpdateAiTask,
  onUpdateUserTask,
  onToggleComplete,
}: {
  weekPlan: WeekDayPlan[];
  userPlan: { tasks: UserPlanTask[] };
  onUpdateAiTask: (day: string, taskIndex: number, nextText: string) => void;
  onUpdateUserTask: (taskId: string, nextText: string, nextDay: string) => void;
  onToggleComplete: (taskId: string) => void;
}) {
  const fallbackWeek = weekPlan.length ? weekPlan : WEEK_DAYS.slice(0, 5).map((day) => ({ day, tasks: [] }));

  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
      <h3 className="text-xl font-semibold">Weekly Execution Plan</h3>
      <p className="mt-1 text-sm text-gray-300">AI-generated tasks + your added suggestions (editable).</p>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {fallbackWeek.map((dayPlan) => {
          const userTasksForDay = userPlan.tasks.filter((task) => task.day === dayPlan.day);
          return (
            <article key={dayPlan.day} className="rounded-xl border border-gray-800 bg-gray-950/50 p-3">
              <h4 className="text-sm font-semibold text-indigo-300">{dayPlan.day}</h4>

              <div className="mt-2 space-y-2">
                {dayPlan.tasks.map((task, index) => (
                  <input
                    key={`${dayPlan.day}-${index}`}
                    value={task}
                    onChange={(event) => onUpdateAiTask(dayPlan.day, index, event.target.value)}
                    className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-200"
                  />
                ))}

                {userTasksForDay.map((task) => (
                  <div key={task.id} className="rounded border border-emerald-500/30 bg-emerald-500/5 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs text-gray-300">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => onToggleComplete(task.id)}
                        />
                        Added task
                      </label>
                      <select
                        value={task.day}
                        onChange={(event) => onUpdateUserTask(task.id, task.text, event.target.value)}
                        className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-[10px] text-gray-200"
                      >
                        {WEEK_DAYS.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      value={task.text}
                      onChange={(event) => onUpdateUserTask(task.id, event.target.value, task.day)}
                      className={`mt-2 w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-200 ${
                        task.completed ? "line-through opacity-70" : ""
                      }`}
                    />
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function LearningTab() {
  const [drives, setDrives] = useState<DriveType[]>(["learning"]);
  const [goalsByDrive, setGoalsByDrive] = useState<Record<DriveType, GoalEntry[]>>(createGoalsByDrive);
  const [lastInteractedDrive, setLastInteractedDrive] = useState<DriveType | null>("learning");
  const [health, setHealth] = useState<HealthProfile>({ note: "" });

  const [timeline, setTimeline] = useState<TimelinePhase[]>([]);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});

  const [suggestions, setSuggestions] = useState<ActionSuggestion[]>([]);
  const [addedSuggestionIds, setAddedSuggestionIds] = useState<Record<string, boolean>>({});
  const [userPlan, setUserPlan] = useState<{ tasks: UserPlanTask[] }>({ tasks: [] });
  const [weekPlan, setWeekPlan] = useState<WeekDayPlan[]>([]);

  const [loaded, setLoaded] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [weekPlanLoading, setWeekPlanLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [weekPlanError, setWeekPlanError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = sanitizeStoredState(JSON.parse(raw));
        setDrives(parsed.drives);
        setGoalsByDrive(parsed.goalsByDrive);
        setLastInteractedDrive(parsed.lastInteractedDrive);
        setHealth(parsed.health);
        setTimeline(parsed.timeline);
        setCurrentPhase(parsed.currentPhase);
        setUserPlan(parsed.userPlan);
      }
    } catch {
      // ignore malformed local storage values
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const state: LearningStoredState = {
      drives,
      goalsByDrive,
      lastInteractedDrive,
      health,
      timeline,
      currentPhase,
      userPlan,
    };
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }, [drives, goalsByDrive, lastInteractedDrive, health, timeline, currentPhase, userPlan, loaded]);

  const activeDrives = useMemo(() => drives.slice(0, MAX_DRIVES), [drives]);

  const flattenedGoals = useMemo(() => {
    return activeDrives.flatMap((drive) =>
      (goalsByDrive[drive] ?? []).map((goal) => ({ ...goal, drive })),
    );
  }, [activeDrives, goalsByDrive]);

  const flatSkills = useMemo(
    () => flattenedGoals.map((goal) => goal.skill).filter((skill) => skill.trim().length > 0),
    [flattenedGoals],
  );

  function toggleDrive(drive: DriveType) {
    setDrives((prev) => {
      if (prev.includes(drive)) {
        const next = prev.filter((item) => item !== drive);
        if (lastInteractedDrive === drive) {
          setLastInteractedDrive(next[0] ?? null);
        }
        return next;
      }

      if (prev.length >= MAX_DRIVES) {
        return [prev[1], drive];
      }

      return [...prev, drive];
    });
    setLastInteractedDrive(drive);
  }

  function updateGoals(drive: DriveType, nextGoals: GoalEntry[]) {
    setGoalsByDrive((prev) => ({
      ...prev,
      [drive]: nextGoals,
    }));
    setLastInteractedDrive(drive);
  }

  function addGoal(drive: DriveType) {
    const current = goalsByDrive[drive] ?? [];
    if (current.length >= MAX_GOALS_PER_DRIVE) return;
    updateGoals(drive, [...current, defaultGoal()]);
  }

  function updateGoal(drive: DriveType, goalId: string, patch: Partial<GoalEntry>) {
    const current = [...(goalsByDrive[drive] ?? [])];
    const next = current.map((goal) =>
      goal.id === goalId ? { ...goal, ...patch, id: goal.id } : goal,
    );
    updateGoals(drive, next);
  }

  function removeGoal(drive: DriveType, goalId: string) {
    const current = [...(goalsByDrive[drive] ?? [])];
    const next = current.filter((goal) => goal.id !== goalId);
    updateGoals(drive, next);
  }

  async function generateTimeline() {
    setTimelineLoading(true);
    setTimelineError(null);
    try {
      const res = await fetch("/api/ai/generate-timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drives: activeDrives,
          goals: flattenedGoals,
          health,
        }),
      });
      const json = await res.json();
      const phases = Array.isArray(json?.phases) ? (json.phases as TimelinePhase[]) : [];
      setTimeline(phases);
      setCurrentPhase(phases[0]?.id ?? null);
      setExpandedPhases(
        Object.fromEntries(phases.map((phase) => [phase.id, false])) as Record<string, boolean>,
      );
    } catch {
      setTimelineError("Could not generate timeline.");
    } finally {
      setTimelineLoading(false);
    }
  }

  const generateWeekPlan = useCallback(async (targetPhase: string | null, customTimeline: TimelinePhase[] = timeline) => {
    if (!targetPhase || customTimeline.length === 0) {
      setWeekPlan([]);
      return;
    }

    setWeekPlanLoading(true);
    setWeekPlanError(null);
    try {
      const res = await fetch("/api/ai/generate-week-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phases: customTimeline,
          currentPhase: targetPhase,
          availableDays: 5,
        }),
      });
      const json = await res.json();
      setWeekPlan(Array.isArray(json?.week) ? (json.week as WeekDayPlan[]) : []);
    } catch {
      setWeekPlanError("Could not generate week plan.");
    } finally {
      setWeekPlanLoading(false);
    }
  }, [timeline]);

  const fetchSuggestions = useCallback(async () => {
    if (!currentPhase || timeline.length === 0) {
      setSuggestions([]);
      return;
    }

    setSuggestionLoading(true);
    setSuggestionError(null);
    try {
      const recentActivity = userPlan.tasks.slice(-5).map((task) => task.text);
      const res = await fetch("/api/ai/suggest-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPhase,
          recentActivity,
          goals: flattenedGoals,
          skills: flatSkills,
        }),
      });
      const json = await res.json();
      setSuggestions(Array.isArray(json?.suggestions) ? (json.suggestions as ActionSuggestion[]) : []);
      setAddedSuggestionIds({});
    } catch {
      setSuggestionError("Could not load suggestions.");
    } finally {
      setSuggestionLoading(false);
    }
  }, [currentPhase, flatSkills, flattenedGoals, timeline, userPlan.tasks]);

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => {
      fetchSuggestions().catch(() => setSuggestionError("Could not load suggestions."));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [loaded, fetchSuggestions]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      generateWeekPlan(currentPhase).catch(() => setWeekPlanError("Could not generate week plan."));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [currentPhase, generateWeekPlan]);

  function addSuggestionToPlan(suggestion: ActionSuggestion) {
    if (addedSuggestionIds[suggestion.id]) return;

    const targetDay = weekPlan[0]?.day ?? "Mon";
    const task: UserPlanTask = {
      id: createId("task"),
      text: suggestion.text,
      type: suggestion.type,
      priority: suggestion.priority,
      day: targetDay,
      completed: false,
    };

    setUserPlan((prev) => ({ tasks: [...prev.tasks, task] }));
    setAddedSuggestionIds((prev) => ({ ...prev, [suggestion.id]: true }));
  }

  function dismissSuggestion(suggestionId: string) {
    setSuggestions((prev) => prev.filter((item) => item.id !== suggestionId));
  }

  function updateAiTask(day: string, taskIndex: number, nextText: string) {
    setWeekPlan((prev) =>
      prev.map((dayPlan) => {
        if (dayPlan.day !== day) return dayPlan;
        const tasks = [...dayPlan.tasks];
        tasks[taskIndex] = nextText;
        return { ...dayPlan, tasks };
      }),
    );
  }

  function updateUserTask(taskId: string, nextText: string, nextDay: string) {
    setUserPlan((prev) => ({
      tasks: prev.tasks.map((task) =>
        task.id === taskId ? { ...task, text: nextText, day: nextDay } : task,
      ),
    }));
  }

  function toggleTaskComplete(taskId: string) {
    setUserPlan((prev) => ({
      tasks: prev.tasks.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task,
      ),
    }));
  }

  async function handleSave() {
    if (!lastInteractedDrive) return;
    setSaveState("saving");
    try {
      await fetch("/api/user/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drive: lastInteractedDrive,
          goals: goalsByDrive[lastInteractedDrive] ?? [],
          health,
        }),
      });
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1200);
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div className="space-y-5 text-white">
      <section className="rounded-2xl border border-gray-800 bg-gray-900/70">
        <div className="px-5 py-5">
          <h2 className="text-3xl font-semibold">What keeps you moving?</h2>
          <p className="mt-1 text-gray-300">Pick up to 2.</p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {DRIVE_OPTIONS.map((option) => {
              const selected = drives.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggleDrive(option.id)}
                  className={`rounded-xl border px-4 py-4 text-left transition ${
                    selected
                      ? "border-indigo-500/60 bg-indigo-500/20"
                      : "border-gray-700 bg-gray-950/60 hover:bg-gray-900"
                  }`}
                >
                  <div className="font-semibold">
                    {selected ? `✓ ${option.title}` : option.title}
                  </div>
                  <div className="mt-1 text-sm text-gray-400">{option.subtitle}</div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {activeDrives.length > 0 && (
        <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
          <h3 className="text-3xl font-semibold">What do you want to do?</h3>
          <p className="mt-1 text-gray-300">
            Goals are grouped by drive. Deselecting a drive hides its column and reselecting restores it.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {activeDrives.map((drive) => {
              const goals = goalsByDrive[drive] ?? [];
              return (
                <div key={drive} className="space-y-3">
                  <h4 className="text-sm font-semibold capitalize text-indigo-400">{drive}</h4>

                  {goals.map((goal, index) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      index={index}
                      onUpdate={(patch) => updateGoal(drive, goal.id, patch)}
                      onRemove={() => removeGoal(drive, goal.id)}
                    />
                  ))}

                  {goals.length < MAX_GOALS_PER_DRIVE && (
                    <button
                      type="button"
                      onClick={() => addGoal(drive)}
                      className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-indigo-300 hover:bg-gray-800"
                    >
                      + Add goal
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-xl border border-gray-800 bg-gray-950/50 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-400">Health note</p>
            <input
              value={health.note}
              onChange={(event) => setHealth({ note: event.target.value })}
              placeholder="Optional health context"
              className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
            />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500"
            >
              Save goals
            </button>
            <span className="text-xs text-gray-400">
              {saveState === "saving" && "Saving..."}
              {saveState === "saved" && "Saved"}
              {saveState === "error" && "Save failed"}
              {saveState === "idle" && ""}
            </span>
          </div>
        </section>
      )}

      <TimelineSection
        timeline={timeline}
        currentPhase={currentPhase}
        expanded={expandedPhases}
        onToggleExpand={(phaseId) =>
          setExpandedPhases((prev) => ({ ...prev, [phaseId]: !prev[phaseId] }))
        }
        onSelectPhase={setCurrentPhase}
        onGenerate={() => generateTimeline()}
        loading={timelineLoading}
        error={timelineError}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          {weekPlanError && <p className="text-sm text-rose-300">{weekPlanError}</p>}
          {weekPlanLoading && <p className="text-sm text-gray-400">Generating week plan...</p>}
          <WeeklyExecutionPlan
            weekPlan={weekPlan}
            userPlan={userPlan}
            onUpdateAiTask={updateAiTask}
            onUpdateUserTask={updateUserTask}
            onToggleComplete={toggleTaskComplete}
          />
        </div>

        <SuggestionsSidebar
          suggestions={suggestions}
          addedSuggestionIds={addedSuggestionIds}
          loading={suggestionLoading}
          error={suggestionError}
          onAdd={addSuggestionToPlan}
          onDismiss={dismissSuggestion}
          onRegenerate={() => fetchSuggestions()}
        />
      </div>

      {loaded && (
        <p className="text-xs text-emerald-400">
          Local state is preserved. Drive columns appear only for selected drives.
        </p>
      )}
    </div>
  );
}
