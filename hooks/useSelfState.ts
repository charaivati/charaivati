// hooks/useSelfState.ts — all state, effects, and persistence for SelfTab

import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";
import { uid } from "@/components/self/shared";
import { safeFetchJson } from "@/hooks/useAIBlock";
import { computeEnergy } from "@/blocks/EnergyBlock";
import type {
  DriveType, GoalEntry, HealthProfile, SkillEntry,
  PageItem, SaveState, AIRoadmap,
  FundsProfile, WeekSchedule, EnvironmentProfile,
} from "@/types/self";

// ─── Constants ────────────────────────────────────────────────────────────────

export const DRIVES: { id: DriveType; label: string; description: string }[] = [
  { id: "learning", label: "Learning", description: "Curious about everything" },
  { id: "helping",  label: "Helping",  description: "Here for the people"      },
  { id: "building", label: "Building", description: "Making things happen"     },
  { id: "doing",    label: "Doing",    description: "Master of the craft"      },
];

export const DRIVE_IDENTITY: Record<DriveType, string> = {
  learning: "a curious mind",
  helping:  "here for people",
  building: "a builder",
  doing:    "a doer",
};

export const DRIVE_QUESTION: Record<DriveType, string> = {
  learning: "What are you curious about?",
  helping:  "Who or what do you want to help?",
  building: "What would you like to build?",
  doing:    "What do you want to master?",
};

const GUEST_KEY    = "charaivati_guest_self";
const GUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Local helpers ────────────────────────────────────────────────────────────

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

export function defaultGoal(driveId: DriveType): GoalEntry {
  return {
    id: uid(), driveId, statement: "", description: "",
    skills: [{ id: uid(), name: "", level: "Beginner", monetize: false }],
    linkedBusinessIds: [], saved: false,
  };
}

function defaultFundsProfile(): FundsProfile {
  return { sources: [], monthlyBurn: 0, targetRunway: 6, fundsPlan: null };
}

function defaultWeekSchedule(): WeekSchedule {
  return { slots: [], tasks: [] };
}

function defaultEnvironmentProfile(): EnvironmentProfile {
  return { city: '', country: '', timezone: '', workspace: '', livingWith: '', constraints: [], assets: [] };
}

export function defaultHealth(): HealthProfile {
  return {
    food: "Vegetarian", exercise: "Mixed", sessionsPerWeek: 3,
    heightCm: "", weightKg: "", age: "",
    bodyFatPct: "", waistCm: "", hipCm: "", bicepCm: "", chestCm: "",
    medicalConditions: "",
    availableFoods: [],
    healthPlan: null,
    healthPlanGeneratedAt: null,
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSelfState(profile: any) {
  const [drives,         setDrives]         = useState<DriveType[]>([]);
  const [goals,          setGoals]          = useState<GoalEntry[]>([]);
  const [health,         setHealth]         = useState<HealthProfile>(defaultHealth());
  const [generalSkills,  setGeneralSkills]  = useState<SkillEntry[]>([]);
  const [skillsLoading,  setSkillsLoading]  = useState<Record<string, boolean>>({});
  const [pages,          setPages]          = useState<PageItem[]>([]);
  const [saveState,      setSaveState]      = useState<SaveState>("idle");
  const [isGuest,        setIsGuest]        = useState(false);
  const [planLoading,    setPlanLoading]    = useState<Record<string, boolean>>({});
  const [fundsProfile,       setFundsProfile]       = useState<FundsProfile>(defaultFundsProfile());
  const [weekSchedule,       setWeekSchedule]       = useState<WeekSchedule>(defaultWeekSchedule());
  const [environmentProfile, setEnvironmentProfile] = useState<EnvironmentProfile>(defaultEnvironmentProfile());
  const [typedLine1,     setTypedLine1]     = useState("");
  const [typedLine2,     setTypedLine2]     = useState("");
  const [line2Started,   setLine2Started]   = useState(false);
  const [typingDone,     setTypingDone]     = useState(false);
  const [drivesVisible,  setDrivesVisible]  = useState(false);
  const [drivePickerOpen,setDrivePickerOpen]= useState(false);
  const [profileReady,   setProfileReady]   = useState(false);

  const profileApplied   = useRef(false);
  const saveTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guestLoaded      = useRef(false);
  const animationStarted = useRef(false);
  const generalSkillsRef = useRef<SkillEntry[]>([]);
  const goalsRef         = useRef<GoalEntry[]>([]);

  const visibleGoals = goals.filter(g => drives.includes(g.driveId));

  // ── 2-second profile-ready fallback ───────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setProfileReady(true), 2000);
    return () => clearTimeout(t);
  }, []);

  // ── Detect guest / load guest data ────────────────────────────
  useEffect(() => {
    if (profile !== undefined) {
      setProfileReady(true);
      setIsGuest(!profile);
      if (!profile && !guestLoaded.current) {
        guestLoaded.current = true;
        const saved = guestLoad();
        if (saved) {
          if (saved.drives) setDrives(saved.drives);
          if (saved.health) setHealth(h => ({ ...h, ...saved.health }));
          if (Array.isArray(saved.goals) && saved.goals.length) setGoals(saved.goals);
          if (saved.fundsProfile)       setFundsProfile(saved.fundsProfile);
          if (saved.weekSchedule)       setWeekSchedule({ slots: saved.weekSchedule.slots ?? [], tasks: saved.weekSchedule.tasks ?? [] });
          if (saved.environmentProfile) setEnvironmentProfile(saved.environmentProfile);
        }
        profileApplied.current = true;
      }
    }
  }, [profile]);

  // ── Keep goalsRef current so non-modifying persist calls never use stale goals ──
  useEffect(() => { goalsRef.current = goals; }, [goals]);

  // ── Guest auto-save: whenever goals/drives/health change, persist to localStorage ──
  // This is a safety net independent of the manual persist() call chain.
  useEffect(() => {
    if (profile !== null) return;       // only for confirmed guests (null = guest, undefined = loading)
    if (!guestLoaded.current) return;   // don't overwrite before initial load completes
    if (drives.length === 0) return;    // never save with empty drives — not a valid committed state
    guestSave({ drives, goals, health, fundsProfile, weekSchedule, environmentProfile });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, drives, goals, health, fundsProfile, weekSchedule, environmentProfile]);

  // ── Load business pages ────────────────────────────────────────
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

    const loadedDrives: DriveType[] = Array.isArray(profile.drives)
      ? profile.drives
      : profile.drive
        ? (Array.isArray(profile.drive) ? profile.drive : [profile.drive])
        : [];
    if (loadedDrives.length > 0) setDrives(loadedDrives);

    if (profile.health) setHealth({ ...defaultHealth(), ...profile.health });

    if (profile.fundsProfile)       setFundsProfile({ ...defaultFundsProfile(), ...profile.fundsProfile });
    if (profile.weekSchedule)       setWeekSchedule({ slots: profile.weekSchedule.slots ?? [], tasks: profile.weekSchedule.tasks ?? [] });
    if (profile.environmentProfile) setEnvironmentProfile({ ...defaultEnvironmentProfile(), ...profile.environmentProfile });

    if (Array.isArray(profile.generalSkills)) {
      const gs = profile.generalSkills as SkillEntry[];
      setGeneralSkills(gs);
      generalSkillsRef.current = gs;
    }

    let loadedGoals: GoalEntry[] = [];
    if (Array.isArray(profile.goals) && profile.goals.length) {
      loadedGoals = profile.goals.map((g: GoalEntry) => ({
        ...g, driveId: g.driveId ?? loadedDrives[0] ?? "building",
      }));
    } else if (profile.goals && typeof profile.goals === "object") {
      const OLD_DRIVES: DriveType[] = ["learning", "helping", "building", "doing"];
      OLD_DRIVES.forEach(driveId => {
        const driveGoals = (profile.goals as any)[driveId];
        if (Array.isArray(driveGoals)) driveGoals.forEach((g: any) => loadedGoals.push({ ...g, driveId }));
      });
    }
    if (loadedGoals.length) setGoals(loadedGoals);
  }, [profile]);

  // ── Typewriter greeting animation ──────────────────────────────
  useEffect(() => {
    if (animationStarted.current || !profileReady) return;
    animationStarted.current = true;

    const effectiveProfile = profile ?? null;
    const profileDrives: DriveType[] = Array.isArray(effectiveProfile?.drives)
      ? effectiveProfile.drives : effectiveProfile?.drive ? [effectiveProfile.drive] : [];
    const guestDrives: DriveType[] = !effectiveProfile
      ? (() => { try { return guestLoad()?.drives ?? []; } catch { return []; } })() : [];
    const isReturning = profileDrives.length > 0 || guestDrives.length > 0;

    const h = new Date().getHours();
    const timeOfDay = h >= 5 && h <= 11 ? "morning" : h >= 12 && h <= 16 ? "afternoon" : h >= 17 && h <= 20 ? "evening" : "night";
    const rawName   = effectiveProfile?.name ?? effectiveProfile?.firstName ?? "";
    const firstName = rawName.split(" ")[0] || "there";
    const line1Full = `Good ${timeOfDay}, ${firstName}.`;
    const line2Full = "What do you think keeps you moving?";

    if (isReturning) {
      setTypedLine1(line1Full); setTypedLine2(line2Full);
      setLine2Started(true); setTypingDone(true); setDrivesVisible(true);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;

    function typeStr(full: string, setter: Dispatch<SetStateAction<string>>, speed: number, onDone: () => void) {
      let idx = 0;
      function tick() {
        if (cancelled) return;
        idx++;
        setter(full.slice(0, idx));
        if (idx < full.length) timers.push(setTimeout(tick, speed));
        else onDone();
      }
      tick();
    }

    typeStr(line1Full, setTypedLine1, 38, () => {
      timers.push(setTimeout(() => {
        if (cancelled) return;
        setLine2Started(true);
        typeStr(line2Full, setTypedLine2, 28, () => {
          setTypingDone(true);
          timers.push(setTimeout(() => { if (!cancelled) setDrivesVisible(true); }, 600));
        });
      }, 400));
    });

    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, [profileReady, profile]);

  // ── Persist ────────────────────────────────────────────────────
  function persist(nextDrives: DriveType[], nextGoals: GoalEntry[], nextHealth: HealthProfile, nextFunds?: FundsProfile, nextSchedule?: WeekSchedule, nextEnv?: EnvironmentProfile) {
    // Still waiting for the profile API — don't know who the user is yet
    if (profile === undefined) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    if (!profile) {
      // Guest: save to localStorage immediately, no need to wait for profileApplied flag
      guestSave({ drives: nextDrives, goals: nextGoals, health: nextHealth, fundsProfile: nextFunds ?? fundsProfile, weekSchedule: nextSchedule ?? weekSchedule, environmentProfile: nextEnv ?? environmentProfile });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1200);
      return;
    }

    // Logged-in user: wait until profile data has been loaded into state
    if (!profileApplied.current) return;

    setSaveState("saving");
    saveTimerRef.current = setTimeout(async () => {
      try {
        const resp = await safeFetchJson("/api/user/profile", {
          method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ drives: nextDrives, goals: nextGoals, health: nextHealth, generalSkills: generalSkillsRef.current, fundsProfile: nextFunds ?? fundsProfile, weekSchedule: nextSchedule ?? weekSchedule, environmentProfile: nextEnv ?? environmentProfile }),
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
      next = drives.filter(x => x !== d);
    } else {
      next = drives.length < 2 ? [...drives, d] : [drives[1], d];
    }
    setDrives(next);
    setDrivePickerOpen(false);
    persist(next, goalsRef.current, health);
  }

  // ── Goal helpers ───────────────────────────────────────────────
  function updateGoal(id: string, u: GoalEntry) {
    setGoals(prev => {
      const next = prev.map(g => g.id === id ? u : g);
      persist(drives, next, health);
      return next;
    });
  }
  function saveGoal(id: string) {
    setGoals(prev => {
      const next = prev.map(g => g.id === id ? { ...g, saved: true } : g);
      persist(drives, next, health);
      return next;
    });
  }
  function editGoal(id: string) {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, saved: false } : g));
  }
  function removeGoal(id: string) {
    setGoals(prev => {
      const filtered = prev.filter(g => g.id !== id);
      const next = drives.reduce((acc, driveId) => {
        return acc.some(g => g.driveId === driveId) ? acc : [...acc, defaultGoal(driveId)];
      }, filtered);
      persist(drives, next, health);
      return next;
    });
  }
  function saveGoalPlan(id: string, plan: AIRoadmap) {
    setGoals(prev => {
      const next = prev.map(g => g.id === id ? { ...g, plan } : g);
      persist(drives, next, health);
      return next;
    });
  }
  function addGoal(driveId: DriveType) {
    setGoals(prev => [...prev, defaultGoal(driveId)]);
  }
  function addGoalDirect(goal: GoalEntry) {
    setGoals(prev => {
      const next = [...prev, goal];
      persist(drives, next, health);
      return next;
    });
  }

  // Atomic: set drives + goals at once (used by onboarding to avoid stale-state bugs)
  function applyOnboardingResult(newDrives: DriveType[], newGoals: GoalEntry[]) {
    setDrives(newDrives);
    setGoals(newGoals);
    persist(newDrives, newGoals, health);
  }

  // ── New block handlers ─────────────────────────────────────────
  function handleFundsChange(f: FundsProfile) { setFundsProfile(f); persist(drives, goalsRef.current, health, f, weekSchedule, environmentProfile); }
  function handleWeekScheduleChange(s: WeekSchedule) { setWeekSchedule(s); persist(drives, goalsRef.current, health, fundsProfile, s, environmentProfile); }
  function handleEnvironmentChange(e: EnvironmentProfile) { setEnvironmentProfile(e); persist(drives, goalsRef.current, health, fundsProfile, weekSchedule, e); }

  // ── Health + skills handlers ───────────────────────────────────
  function handleHealthChange(h: HealthProfile) { setHealth(h); persist(drives, goalsRef.current, h); }

  function handleGeneralSkillsChange(skills: SkillEntry[]) {
    setGeneralSkills(skills);
    generalSkillsRef.current = skills;
    persist(drives, goalsRef.current, health);
  }
  function handleGoalSkillsChange(goalId: string, skills: SkillEntry[]) {
    setGoals(prev => {
      const next = prev.map(g => g.id === goalId ? { ...g, skills } : g);
      persist(drives, next, health);
      return next;
    });
  }

  // ── AI: suggest skills ─────────────────────────────────────────
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
        const existing = goal.skills.filter(s => s.name);
        const aiSkills = resp.json.skills as SkillEntry[];
        const merged   = [...existing, ...aiSkills.filter(ai => !existing.some(e => e.name.toLowerCase() === ai.name.toLowerCase()))];
        handleGoalSkillsChange(goalId, merged);
      } else if (resp.json?.needsSkills === false) {
        handleGoalSkillsChange(goalId, []);
      }
    } finally {
      setSkillsLoading(prev => { const n = { ...prev }; delete n[goalId]; return n; });
    }
  }

  // ── AI: generate goal plan ─────────────────────────────────────
  async function generateGoalPlan(goalId: string) {
    const goal = goals.find(g => g.id === goalId);
    if (!goal || !goal.statement) return;
    setPlanLoading(prev => ({ ...prev, [goalId]: true }));
    try {
      const driveLabel  = DRIVES.find(d => d.id === goal.driveId)?.label ?? goal.driveId;
      const goalPayload = [{
        id: goal.id, title: goal.statement, description: goal.description?.trim() || "",
        skill: goal.skills.filter(s => s.name).map(s => s.name).join(", "), drive: driveLabel,
      }];
      const existingPlan = goal.plan && !goal.plan.fallback
        ? { phases: goal.plan.phases.map(p => ({ id: p.id, name: p.name, actions: p.actions })) }
        : undefined;
      const energyScore = computeEnergy(health, environmentProfile, weekSchedule, fundsProfile);
      const energyPayload = {
        overall:     energyScore.overall,
        physical:    energyScore.physical,
        mental:      energyScore.mental,
        environment: energyScore.environment,
        time:        energyScore.time,
        funds:       energyScore.funds,
      };
      const timelineResp = await safeFetchJson("/api/ai/generate-timeline", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drives: [driveLabel], goals: goalPayload, existingPlan, energy: energyPayload }),
      });
      const isFallback = timelineResp.json?._fallback === true;
      const phases     = timelineResp.json?.phases ?? [];

      let plan: AIRoadmap;
      if (isFallback) {
        plan = {
          phases: [
            { id: "foundation", name: "Foundation", duration: "2–4 weeks", actions: [""] },
            { id: "growth",     name: "Growth",     duration: "4–8 weeks", actions: [""] },
            { id: "mastery",    name: "Mastery",    duration: "8+ weeks",  actions: [""] },
          ],
          suggestions: [], fallback: true,
        };
      } else {
        if (!phases.length) throw new Error("No phases returned");
        plan = { phases, suggestions: [], fallback: false };
      }
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

  // ── Summary stats ──────────────────────────────────────────────
  const allVisibleSaved = visibleGoals.length > 0 && visibleGoals.every(g => g.saved);
  const filledGoals     = visibleGoals.filter(g => g.statement).length;
  const totalSkills     = visibleGoals.reduce((a, g) => a + g.skills.filter(s => s.name).length, 0);
  const monetizable     = visibleGoals.reduce((a, g) => a + g.skills.filter(s => s.monetize && s.name).length, 0);

  return {
    // state
    drives, goals, health, generalSkills, skillsLoading, pages, saveState,
    isGuest, planLoading, typedLine1, typedLine2, line2Started, typingDone,
    drivesVisible, drivePickerOpen, profileReady, visibleGoals,
    allVisibleSaved, filledGoals, totalSkills, monetizable,
    fundsProfile, weekSchedule, environmentProfile,
    // setters
    setDrivePickerOpen,
    // handlers
    toggleDrive, updateGoal, saveGoal, editGoal, removeGoal, saveGoalPlan,
    addGoal, addGoalDirect, applyOnboardingResult, handleHealthChange, handleGeneralSkillsChange, handleGoalSkillsChange,
    suggestGoalSkills, generateGoalPlan,
    handleFundsChange, handleWeekScheduleChange, handleEnvironmentChange,
  };
}
