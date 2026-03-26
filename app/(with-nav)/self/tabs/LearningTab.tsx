"use client";

import React, { useEffect, useMemo, useState } from "react";

type MotivationId = "learning" | "helping" | "building" | "doing";
type Horizon = "thisYear" | "threeYears" | "lifetime";
type SkillLevel = "beginner" | "intermediate" | "advanced";

type GoalDraft = {
  title: string;
  horizon: Horizon;
  skill: string;
  skillLevel: SkillLevel;
  earnFromSkill: boolean;
};

type StoredState = {
  selectedMotivations: MotivationId[];
  activeMotivation: MotivationId;
  goalsByMotivation: Record<MotivationId, GoalDraft[]>;
};

type MotivationOption = {
  id: MotivationId;
  title: string;
  subtitle: string;
};

const LS_KEY = "self_learning_tab_state_v1";
const MAX_GOALS = 2;

const MOTIVATIONS: MotivationOption[] = [
  { id: "learning", title: "Learning", subtitle: "Curious about everything" },
  { id: "helping", title: "Helping", subtitle: "Here for the people" },
  { id: "building", title: "Building", subtitle: "Making things happen" },
  { id: "doing", title: "Doing", subtitle: "Master of the craft" },
];

const defaultGoalsByMotivation: Record<MotivationId, GoalDraft[]> = {
  learning: [],
  helping: [],
  building: [],
  doing: [],
};

function createEmptyGoal(): GoalDraft {
  return {
    title: "",
    horizon: "thisYear",
    skill: "",
    skillLevel: "beginner",
    earnFromSkill: false,
  };
}

function isMotivationId(value: unknown): value is MotivationId {
  return ["learning", "helping", "building", "doing"].includes(String(value));
}

function sanitizeStoredState(input: unknown): StoredState {
  const fallback: StoredState = {
    selectedMotivations: ["learning"],
    activeMotivation: "learning",
    goalsByMotivation: defaultGoalsByMotivation,
  };

  if (!input || typeof input !== "object") return fallback;

  const obj = input as Partial<StoredState>;
  const selected = Array.isArray(obj.selectedMotivations)
    ? obj.selectedMotivations.filter(isMotivationId).slice(0, 2)
    : [];

  const goalsRaw = obj.goalsByMotivation && typeof obj.goalsByMotivation === "object" ? obj.goalsByMotivation : {};

  const normalizedGoals: Record<MotivationId, GoalDraft[]> = {
    learning: [],
    helping: [],
    building: [],
    doing: [],
  };

  (Object.keys(normalizedGoals) as MotivationId[]).forEach((motivation) => {
    const source = (goalsRaw as Record<string, unknown>)[motivation];
    if (!Array.isArray(source)) return;
    normalizedGoals[motivation] = source.slice(0, MAX_GOALS).map((g) => {
      const goal = g as Partial<GoalDraft>;
      return {
        title: typeof goal.title === "string" ? goal.title : "",
        horizon:
          goal.horizon === "thisYear" || goal.horizon === "threeYears" || goal.horizon === "lifetime"
            ? goal.horizon
            : "thisYear",
        skill: typeof goal.skill === "string" ? goal.skill : "",
        skillLevel:
          goal.skillLevel === "beginner" || goal.skillLevel === "intermediate" || goal.skillLevel === "advanced"
            ? goal.skillLevel
            : "beginner",
        earnFromSkill: Boolean(goal.earnFromSkill),
      };
    });
  });

  const firstSelected = selected[0] ?? "learning";
  const active = isMotivationId(obj.activeMotivation) ? obj.activeMotivation : firstSelected;

  return {
    selectedMotivations: selected.length ? selected : ["learning"],
    activeMotivation: selected.includes(active) ? active : firstSelected,
    goalsByMotivation: normalizedGoals,
  };
}

export default function LearningTab() {
  const [state, setState] = useState<StoredState>({
    selectedMotivations: ["learning"],
    activeMotivation: "learning",
    goalsByMotivation: defaultGoalsByMotivation,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setState(sanitizeStoredState(parsed));
      }
    } catch {
      // ignore bad local state
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }, [state, loaded]);

  const activeGoals = useMemo(() => state.goalsByMotivation[state.activeMotivation] ?? [], [state]);

  function toggleMotivation(id: MotivationId) {
    setState((prev) => {
      const selected = prev.selectedMotivations;
      const isSelected = selected.includes(id);

      if (isSelected) {
        const nextSelected = selected.filter((item) => item !== id);
        if (nextSelected.length === 0) {
          return {
            ...prev,
            selectedMotivations: [id],
            activeMotivation: id,
          };
        }
        return {
          ...prev,
          selectedMotivations: nextSelected,
          activeMotivation: nextSelected.includes(prev.activeMotivation)
            ? prev.activeMotivation
            : nextSelected[0],
        };
      }

      if (selected.length >= 2) {
        const nextSelected = [selected[1], id];
        return {
          ...prev,
          selectedMotivations: nextSelected,
          activeMotivation: id,
        };
      }

      return {
        ...prev,
        selectedMotivations: [...selected, id],
        activeMotivation: id,
      };
    });
  }

  function setActiveMotivation(id: MotivationId) {
    setState((prev) => ({
      ...prev,
      activeMotivation: prev.selectedMotivations.includes(id) ? id : prev.activeMotivation,
    }));
  }

  function updateGoal(index: number, patch: Partial<GoalDraft>) {
    setState((prev) => {
      const current = [...(prev.goalsByMotivation[prev.activeMotivation] ?? [])];
      current[index] = { ...createEmptyGoal(), ...current[index], ...patch };
      return {
        ...prev,
        goalsByMotivation: {
          ...prev.goalsByMotivation,
          [prev.activeMotivation]: current,
        },
      };
    });
  }

  function addGoal() {
    setState((prev) => {
      const current = prev.goalsByMotivation[prev.activeMotivation] ?? [];
      if (current.length >= MAX_GOALS) return prev;
      return {
        ...prev,
        goalsByMotivation: {
          ...prev.goalsByMotivation,
          [prev.activeMotivation]: [...current, createEmptyGoal()],
        },
      };
    });
  }

  function removeGoal(index: number) {
    setState((prev) => {
      const current = [...(prev.goalsByMotivation[prev.activeMotivation] ?? [])];
      current.splice(index, 1);
      return {
        ...prev,
        goalsByMotivation: {
          ...prev.goalsByMotivation,
          [prev.activeMotivation]: current,
        },
      };
    });
  }

  return (
    <div className="space-y-5 text-white">
      <section className="rounded-2xl border border-gray-800 bg-gray-900/70">
        <div className="px-5 py-5">
          <h2 className="text-3xl font-semibold">What keeps you moving?</h2>
          <p className="mt-1 text-gray-300">Pick up to 2.</p>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {MOTIVATIONS.map((motivation) => {
              const selected = state.selectedMotivations.includes(motivation.id);
              const active = state.activeMotivation === motivation.id;

              return (
                <button
                  key={motivation.id}
                  type="button"
                  onClick={() => {
                    toggleMotivation(motivation.id);
                    setActiveMotivation(motivation.id);
                  }}
                  className={`rounded-xl border px-4 py-4 text-left transition ${
                    selected
                      ? active
                        ? "border-indigo-500/60 bg-indigo-500/20"
                        : "border-indigo-500/40 bg-indigo-500/10"
                      : "border-gray-700 bg-gray-950/60 hover:bg-gray-900"
                  }`}
                >
                  <div className="font-semibold">{selected ? `✓ ${motivation.title}` : motivation.title}</div>
                  <div className="mt-1 text-sm text-gray-400">{motivation.subtitle}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {state.selectedMotivations.map((id) => {
              const item = MOTIVATIONS.find((m) => m.id === id);
              if (!item) return null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveMotivation(id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    state.activeMotivation === id
                      ? "border-indigo-500 bg-indigo-500/20 text-indigo-200"
                      : "border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  {item.title} {state.activeMotivation === id ? "(Active)" : ""}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
        <h3 className="text-3xl font-semibold">What do you want to do?</h3>
        <p className="mt-1 text-gray-300">Up to 2 goals. Each tab keeps separate goals.</p>

        <div className="mt-4 space-y-4">
          {activeGoals.map((goal, index) => (
            <article key={`${state.activeMotivation}-${index}`} className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-full bg-indigo-500/80 text-xs font-bold flex items-center justify-center">{index + 1}</div>
                <input
                  value={goal.title}
                  onChange={(event) => updateGoal(index, { title: event.target.value })}
                  placeholder="Describe this goal"
                  className="flex-1 border-b border-gray-700 bg-transparent pb-1 text-white outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeGoal(index)}
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
                      onClick={() => updateGoal(index, { horizon: item.id as Horizon })}
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
                  onChange={(event) => updateGoal(index, { skill: event.target.value })}
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
                      onClick={() => updateGoal(index, { skillLevel: item.id as SkillLevel })}
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
                    onClick={() => updateGoal(index, { earnFromSkill: !goal.earnFromSkill })}
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
          ))}

          {activeGoals.length < MAX_GOALS && (
            <button
              type="button"
              onClick={addGoal}
              className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-indigo-300 hover:bg-gray-800"
            >
              + Add goal for {MOTIVATIONS.find((m) => m.id === state.activeMotivation)?.title}
            </button>
          )}
        </div>

        {loaded && (
          <p className="mt-4 text-xs text-emerald-400">
            Saved locally. Refresh-safe and tab-specific for {MOTIVATIONS.find((m) => m.id === state.activeMotivation)?.title}.
          </p>
        )}
      </section>
    </div>
  );
}
