// app/(with-nav)/self/tabs/SelfTab.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, Pencil, Check } from "lucide-react";

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
  statement: string;
  horizon: "This year" | "3 Years" | "Lifetime";
  skills: SkillEntry[];
  linkedBusinessIds: string[];
  saved: boolean; // collapsed/saved state
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

// ─── Constants ────────────────────────────────────────────────────────────────

const DRIVES: { id: DriveType; label: string; description: string }[] = [
  { id: "learning", label: "Learning", description: "Curious about everything" },
  { id: "helping",  label: "Helping",  description: "Here for the people"      },
  { id: "building", label: "Building", description: "Making things happen"     },
  { id: "doing",    label: "Doing",    description: "Master of the craft"      },
];

const HORIZONS         = ["This year", "3 Years", "Lifetime"] as const;
const SKILL_LEVELS     = ["Beginner", "Intermediate", "Advanced"] as const;
const FOOD_OPTIONS     = ["Vegetarian", "Eggetarian", "Non-Vegetarian", "Vegan"];
const EXERCISE_OPTIONS = ["Yoga", "Cardio", "Strength", "Mixed"];

const MEAL_PREVIEW: Record<string, string> = {
  Vegetarian:       "Dal, sabzi, roti · fruit snacks",
  Vegan:            "Legumes, grains, nuts & seeds",
  Eggetarian:       "Eggs + plant-based meals",
  "Non-Vegetarian": "Balanced protein + whole foods",
};

const GUEST_KEY    = "charaivati_guest_self";
const GUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 9); }

function defaultGoal(): GoalEntry {
  return {
    id: uid(), statement: "", horizon: "This year",
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

// ── Guest localStorage helpers ────────────────────────────────────
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

// ─── Goal Summary (collapsed view) ───────────────────────────────────────────

function GoalSummary({ goal, pages, onEdit, onRemove }: {
  goal: GoalEntry;
  pages: PageItem[];
  onEdit: () => void;
  onRemove: () => void;
}) {
  const namedSkills  = goal.skills.filter(s => s.name);
  const linkedPages  = pages.filter(p => goal.linkedBusinessIds.includes(p.id));
  const monetizable  = namedSkills.filter(s => s.monetize);

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950/40 px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Statement + horizon */}
          <p className="text-sm font-semibold text-white truncate">
            {goal.statement || <span className="text-gray-500 italic">No goal stated</span>}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{goal.horizon}</p>

          {/* Skills */}
          {namedSkills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {namedSkills.map(s => (
                <span key={s.id}
                  className={`px-2 py-0.5 rounded-full text-xs border ${
                    s.monetize
                      ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
                      : "border-gray-700 text-gray-400"
                  }`}>
                  {s.name}
                  {s.monetize && " 💰"}
                </span>
              ))}
            </div>
          )}

          {/* Linked pages */}
          {linkedPages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {linkedPages.map(p => (
                <span key={p.id}
                  className="px-2 py-0.5 rounded-full text-xs border border-gray-700 text-gray-500">
                  🏢 {p.title}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-shrink-0">
          <button type="button" onClick={onEdit}
            className="p-1.5 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700
              text-gray-400 hover:text-white transition-colors" title="Edit">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onRemove}
            className="p-1.5 rounded-lg border border-gray-700 bg-gray-800 hover:bg-red-900/30
              text-gray-400 hover:text-red-400 transition-colors" title="Remove">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
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

  const setSkills   = (skills: SkillEntry[]) => onChange({ ...goal, skills });
  const updateSkill = (si: number, patch: Partial<SkillEntry>) =>
    setSkills(goal.skills.map((s, i) => i === si ? { ...s, ...patch } : s));
  const addSkill    = () => setSkills([...goal.skills, { id: uid(), name: "", level: "Beginner", monetize: false }]);
  const removeSkill = (si: number) => setSkills(goal.skills.filter((_, i) => i !== si));

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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, description: newBizDesc.trim() }),
      });
      if (!resp.ok || !resp.json?.ok) throw new Error(resp.json?.error || "Could not create");
      const created: PageItem = resp.json.page;
      window.dispatchEvent(new CustomEvent("charaivati:page-created", { detail: created }));
      onChange({ ...goal, linkedBusinessIds: [...goal.linkedBusinessIds, created.id] });
      setNewBizTitle(""); setNewBizDesc(""); setShowAddBiz(false);
    } catch (err: unknown) {
      setBizError(err instanceof Error ? err.message : "Error creating page");
    } finally {
      setBizAdding(false);
    }
  }

  const canSave = goal.statement.trim().length > 0;

  return (
    <div className="rounded-2xl border border-indigo-500/30 bg-gray-950/40 p-5 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="flex-none w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold
          flex items-center justify-center">{idx + 1}</span>
        <input type="text" value={goal.statement}
          onChange={e => onChange({ ...goal, statement: e.target.value })}
          placeholder="I want to…"
          className="flex-1 bg-transparent border-b border-gray-700 focus:border-indigo-500
            text-white text-sm py-1 outline-none placeholder-gray-600 transition-colors"
        />
        {canRemove && (
          <button type="button" onClick={onRemove}
            className="text-gray-600 hover:text-red-400 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Horizon */}
      <div>
        <FieldLabel>Horizon</FieldLabel>
        <div className="flex gap-2">
          {HORIZONS.map(h => (
            <PillButton key={h} active={goal.horizon === h}
              onClick={() => onChange({ ...goal, horizon: h })}>{h}</PillButton>
          ))}
        </div>
      </div>

      {/* Skills */}
      <div>
        <FieldLabel>Skills for this goal</FieldLabel>
        <div className="space-y-2">
          {goal.skills.map((skill, si) => (
            <div key={skill.id} className="flex flex-wrap gap-2 items-center">
              <TextInput value={skill.name} onChange={v => updateSkill(si, { name: v })}
                placeholder="Skill name…" className="w-36" />
              {SKILL_LEVELS.map(l => (
                <PillButton key={l} active={skill.level === l}
                  onClick={() => updateSkill(si, { level: l })}>{l}</PillButton>
              ))}
              <PillButton active={skill.monetize}
                onClick={() => updateSkill(si, { monetize: !skill.monetize })}>
                {skill.monetize ? "💰 Earning" : "Earn from this?"}
              </PillButton>
              {goal.skills.length > 1 && (
                <button type="button" onClick={() => removeSkill(si)}
                  className="text-gray-600 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={addSkill}
          className="mt-3 flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-400 transition-colors">
          <Plus className="w-3 h-3" /> Add skill
        </button>
      </div>

      {/* Business pages */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <FieldLabel>Business pages for this goal</FieldLabel>
          <button type="button" onClick={() => { setShowAddBiz(v => !v); setBizError(null); }}
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            <Plus className="w-3 h-3" />{showAddBiz ? "Cancel" : "Create new"}
          </button>
        </div>

        {pages.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {pages.map(page => {
              const linked = goal.linkedBusinessIds.includes(page.id);
              return (
                <button key={page.id} type="button" onClick={() => toggleBiz(page.id)}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                    linked
                      ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                      : "border-gray-700 text-gray-400 hover:border-gray-500"
                  }`}>
                  {linked && <span className="mr-1">✓</span>}{page.title}
                </button>
              );
            })}
          </div>
        )}

        {pages.length === 0 && !showAddBiz && (
          <p className="text-xs text-gray-600 mb-3">No business pages yet — create one to link.</p>
        )}

        {showAddBiz && (
          <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4 space-y-3">
            <p className="text-xs text-gray-400 font-medium">New business page</p>
            <TextInput value={newBizTitle} onChange={setNewBizTitle} placeholder="Business name" />
            <textarea value={newBizDesc} onChange={e => setNewBizDesc(e.target.value)}
              placeholder="Description (optional)" rows={2}
              className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm
                text-white placeholder-gray-600 outline-none focus:border-indigo-500 resize-none transition-colors"
            />
            {bizError && <p className="text-xs text-red-400">{bizError}</p>}
            <div className="flex justify-end">
              <button type="button" onClick={createAndLink} disabled={bizAdding}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm
                  transition-colors disabled:opacity-50">
                {bizAdding ? "Creating…" : "Create & link"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="flex justify-end pt-1 border-t border-gray-800">
        <button type="button" onClick={onSave} disabled={!canSave}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500
            text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <Check className="w-4 h-4" /> Save goal
        </button>
      </div>
    </div>
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
  const [drives,    setDrives]    = useState<DriveType[]>([]);        // up to 2
  const [goals,     setGoals]     = useState<GoalEntry[]>([defaultGoal()]);
  const [health,    setHealth]    = useState<HealthProfile>(defaultHealth());
  const [pages,     setPages]     = useState<PageItem[]>([]);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isGuest,   setIsGuest]   = useState(false);

  const profileApplied = useRef(false);
  const saveTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guestLoaded    = useRef(false);

  // ── Detect guest — re-runs whenever profile prop changes ───────
  // profile starts as undefined while layout fetches, then arrives.
  // We only commit to guest mode after a deliberate delay, giving
  // the profile prop time to arrive from the parent.
  useEffect(() => {
    if (profile !== undefined) {
      // Profile has arrived (even if null) — we know the fetch is done
      setIsGuest(!profile);
      if (!profile && !guestLoaded.current) {
        // Logged-out guest: load localStorage
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

  // ── Load pages (skip for guests — they can't persist pages) ────
  useEffect(() => {
    if (isGuest) return;
    safeFetchJson("/api/user/pages", { method: "GET", credentials: "include" })
      .then(r => { if (r.ok && r.json?.ok) setPages(r.json.pages || []); })
      .catch(() => {});
  }, [isGuest]);

  // Listen for pages created inside GoalCards
  useEffect(() => {
    const handler = (e: Event) => {
      const page = (e as CustomEvent).detail as PageItem;
      setPages(prev => prev.some(p => p.id === page.id) ? prev : [page, ...prev]);
    };
    window.addEventListener("charaivati:page-created", handler);
    return () => window.removeEventListener("charaivati:page-created", handler);
  }, []);

  // ── Pre-fill from DB profile (logged-in, runs once) ─────────────
  useEffect(() => {
    if (!profile || profileApplied.current) return;
    profileApplied.current = true;
    // drive was previously a single string — coerce to array
    if (profile.drive) {
      setDrives(Array.isArray(profile.drive) ? profile.drive : [profile.drive]);
    }
    if (profile.health) setHealth(h => ({ ...h, ...profile.health }));
    if (Array.isArray(profile.goals) && profile.goals.length) {
      setGoals(profile.goals);
      setGoalsOpen(true);
    }
  }, [profile]);

  // ── Persist ────────────────────────────────────────────────────
  function persist(nextDrives: DriveType[], nextGoals: GoalEntry[], nextHealth: HealthProfile) {
    if (!profileApplied.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    if (isGuest) {
      // Guest: save to localStorage immediately (no debounce needed for local)
      guestSave({ drives: nextDrives, goals: nextGoals, health: nextHealth });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1200);
      return;
    }

    // Logged-in: debounced API save
    setSaveState("saving");
    saveTimerRef.current = setTimeout(async () => {
      try {
        const resp = await safeFetchJson("/api/user/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          // Store drives array as JSON in the `drive` field
          body: JSON.stringify({ drive: nextDrives, goals: nextGoals, health: nextHealth }),
        });
        setSaveState(resp.ok && resp.json?.ok ? "saved" : "error");
        if (resp.ok && resp.json?.ok) setTimeout(() => setSaveState("idle"), 1500);
      } catch {
        setSaveState("error");
      }
    }, 800);
  }

  // ── Drive toggle (max 2) ───────────────────────────────────────
  function toggleDrive(d: DriveType) {
    let next: DriveType[];
    if (drives.includes(d)) {
      next = drives.filter(x => x !== d);
    } else {
      next = drives.length < 2 ? [...drives, d] : [drives[1], d]; // slide window if already 2
    }
    setDrives(next);
    if (next.length > 0) setGoalsOpen(true);
    persist(next, goals, health);
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
    const next = goals.filter(g => g.id !== id);
    const final = next.length === 0 ? [defaultGoal()] : next;
    setGoals(final);
    persist(drives, final, health);
  }

  function handleHealthChange(h: HealthProfile) {
    setHealth(h);
    persist(drives, goals, h);
  }

  const allGoalsSaved = goals.every(g => g.saved);
  const filledGoals   = goals.filter(g => g.statement).length;
  const totalSkills   = goals.reduce((a, g) => a + g.skills.filter(s => s.name).length, 0);
  const monetizable   = goals.reduce((a, g) => a + g.skills.filter(s => s.monetize && s.name).length, 0);

  return (
    <div className="text-white space-y-5">

      {/* ── What keeps you moving? — always visible ──────────────── */}
      <SectionCard>
        <div className="px-5 pt-5 pb-2 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">What keeps you moving?</h2>
            <p className="text-sm text-gray-400 mt-1">
              Pick up to 2.{" "}
              {isGuest && (
                <span className="text-yellow-600 text-xs">
                  Guest mode — saved locally for 7 days. <a href="/login" className="underline hover:text-yellow-400">Sign in</a> to sync.
                </span>
              )}
            </p>
          </div>
          {/* Save indicator */}
          <span className={`text-xs mt-1 transition-opacity ${
            saveState === "idle"   ? "opacity-0"                   :
            saveState === "saving" ? "opacity-100 text-gray-500"   :
            saveState === "saved"  ? "opacity-100 text-green-500"  :
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
              <button key={d.id} type="button"
                onClick={() => toggleDrive(d.id)}
                disabled={atLimit}
                className={`rounded-xl border px-4 py-4 text-left transition-all ${
                  selected
                    ? "border-indigo-500 bg-indigo-500/10"
                    : atLimit
                      ? "border-gray-800 bg-gray-950/20 opacity-40 cursor-not-allowed"
                      : "border-gray-800 bg-gray-950/40 hover:border-gray-600"
                }`}>
                <div className={`text-sm font-semibold mb-1 ${selected ? "text-indigo-300" : "text-white"}`}>
                  {selected && <span className="mr-1.5 text-indigo-400">✓</span>}
                  {d.label}
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
              {goalsOpen
                ? <><ChevronUp   className="w-4 h-4" />Hide goals</>
                : <><ChevronDown className="w-4 h-4" />Set my goals</>}
            </button>
          </div>
        )}
      </SectionCard>

      {/* ── Goals + Health ────────────────────────────────────────── */}
      {drives.length > 0 && goalsOpen && (
        <>
          <SectionCard>
            <div className="px-5 pt-5 pb-2">
              <h2 className="text-xl font-semibold">What do you want to do?</h2>
              <p className="text-sm text-gray-400 mt-1">Up to 2 goals. Save each to collapse it.</p>
            </div>

            <div className="px-5 pb-5 space-y-4">
              {goals.map((goal, idx) =>
                goal.saved ? (
                  <GoalSummary
                    key={goal.id}
                    goal={goal}
                    pages={pages}
                    onEdit={() => editGoal(goal.id)}
                    onRemove={() => removeGoal(goal.id)}
                  />
                ) : (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    idx={idx}
                    pages={pages}
                    onChange={u => updateGoal(goal.id, u)}
                    onSave={() => saveGoal(goal.id)}
                    onRemove={() => removeGoal(goal.id)}
                    canRemove={goals.length > 1}
                  />
                )
              )}

              {goals.length < 2 && allGoalsSaved && (
                <button type="button"
                  onClick={() => setGoals(prev => [...prev, defaultGoal()])}
                  className="w-full rounded-xl border border-dashed border-gray-700 py-3 text-sm
                    text-gray-500 hover:border-gray-500 hover:text-gray-300 transition-colors
                    flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />Add a second goal
                </button>
              )}
            </div>
          </SectionCard>

          {/* Health — shared, outside goals */}
          <div>
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="h-px flex-1 bg-gray-800" />
              <span className="text-xs text-gray-600 uppercase tracking-wider">Your health · applies to all goals</span>
              <div className="h-px flex-1 bg-gray-800" />
            </div>
            <HealthSection health={health} setHealth={handleHealthChange} />
          </div>

          {/* Summary CTA */}
          {filledGoals > 0 && allGoalsSaved && (
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
                    hover:bg-gray-700 text-sm text-gray-300 transition-colors">
                    Go to Learn →
                  </button>
                  <button className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500
                    text-sm text-white font-medium transition-colors">
                    Go to Earn →
                  </button>
                </div>
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}