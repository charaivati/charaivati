"use client";

import React, { useEffect, useMemo, useState } from "react";

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

type HealthState = {
  note: string;
};

type LearningStoredState = {
  drives: DriveType[];
  goalsByDrive: Record<DriveType, GoalEntry[]>;
  lastInteractedDrive: DriveType | null;
  health: HealthState;
};

type DriveOption = {
  id: DriveType;
  title: string;
  subtitle: string;
};

const LS_KEY = "self_learning_tab_state_v2";
const MAX_DRIVES = 2;
const MAX_GOALS_PER_DRIVE = 2;

const DRIVE_OPTIONS: DriveOption[] = [
  { id: "learning", title: "Learning", subtitle: "Curious about everything" },
  { id: "helping", title: "Helping", subtitle: "Here for the people" },
  { id: "building", title: "Building", subtitle: "Making things happen" },
  { id: "doing", title: "Doing", subtitle: "Master of the craft" },
];

function createGoalsByDrive(): Record<DriveType, GoalEntry[]> {
  return {
    learning: [],
    helping: [],
    building: [],
    doing: [],
  };
}

function createGoalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultGoal(): GoalEntry {
  return {
    id: createGoalId(),
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
        id: typeof goal.id === "string" && goal.id ? goal.id : createGoalId(),
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

  const requestedLast = isDriveType(obj.lastInteractedDrive)
    ? obj.lastInteractedDrive
    : null;

  return {
    drives,
    goalsByDrive,
    lastInteractedDrive: requestedLast ?? drives[0] ?? null,
    health: {
      note:
        obj.health && typeof obj.health === "object" && typeof obj.health.note === "string"
          ? obj.health.note
          : "",
    },
  };
}

async function saveLearningStateToBackend(payload: {
  drive: DriveType;
  goals: GoalEntry[];
  health: HealthState;
}) {
  await fetch("/api/user/profile", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
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

export default function LearningTab() {
  const [drives, setDrives] = useState<DriveType[]>(["learning"]);
  const [goalsByDrive, setGoalsByDrive] = useState<Record<DriveType, GoalEntry[]>>(
    createGoalsByDrive,
  );
  const [lastInteractedDrive, setLastInteractedDrive] = useState<DriveType | null>(
    "learning",
  );
  const [health, setHealth] = useState<HealthState>({ note: "" });
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = sanitizeStoredState(JSON.parse(raw));
        setDrives(parsed.drives);
        setGoalsByDrive(parsed.goalsByDrive);
        setLastInteractedDrive(parsed.lastInteractedDrive);
        setHealth(parsed.health);
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
    };
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }, [drives, goalsByDrive, lastInteractedDrive, health, loaded]);

  const activeDrives = useMemo(() => drives.slice(0, MAX_DRIVES), [drives]);

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
      goal.id === goalId ? { ...defaultGoal(), ...goal, ...patch, id: goal.id } : goal,
    );
    updateGoals(drive, next);
  }

  function removeGoal(drive: DriveType, goalId: string) {
    const current = [...(goalsByDrive[drive] ?? [])];
    const next = current.filter((goal) => goal.id !== goalId);
    updateGoals(drive, next);
  }

  async function handleSave() {
    if (!lastInteractedDrive) return;
    setSaveState("saving");
    try {
      await saveLearningStateToBackend({
        drive: lastInteractedDrive,
        goals: goalsByDrive[lastInteractedDrive] ?? [],
        health,
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

          <div className="mt-4 flex flex-wrap gap-2">
            {activeDrives.map((drive) => (
              <button
                key={drive}
                type="button"
                onClick={() => setLastInteractedDrive(drive)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  lastInteractedDrive === drive
                    ? "border-indigo-500 bg-indigo-500/20 text-indigo-200"
                    : "border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800"
                }`}
              >
                {drive}
              </button>
            ))}
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

                  {goalsByDrive[drive].map((goal, index) => (
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

      {loaded && (
        <p className="text-xs text-emerald-400">
          Local state is preserved. Drive columns appear only for selected drives.
        </p>
      )}
    </div>
  );
}
