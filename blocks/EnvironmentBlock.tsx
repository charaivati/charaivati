"use client";
// blocks/EnvironmentBlock.tsx

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useAIBlock } from "@/hooks/useAIBlock";
import { uid } from "@/components/self/shared";
import type { GoalEntry } from "@/types/self";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkspaceType = "home" | "office" | "coworking" | "hybrid" | "remote";
export type LivingWith    = "alone" | "family" | "roommates" | "partner";
export type CueType       = "space" | "people" | "ritual";

export type EnvironmentCue = {
  id: string;
  type: CueType;
  text: string;
  linkedContext: string;
  savedAt?: string;
  done?: boolean;
  userAdded?: boolean;
};

export type EnvironmentProfile = {
  location?: { city: string; country: string; timezone: string };
  workspace:  WorkspaceType | "";
  livingWith?: LivingWith | "";
  suggestions: EnvironmentCue[];
  pinned:      EnvironmentCue[];
  lastGeneratedFor?: {
    goalIds:     string[];
    healthFlags: string[];
  };
  // Legacy flat fields kept for EnergyBlock backward compat
  city?:        string;
  country?:     string;
  timezone?:    string;
  constraints?: string[];
  assets?:      string[];
};

// ─── Default ──────────────────────────────────────────────────────────────────

export function defaultEnvironmentProfile(): EnvironmentProfile {
  return { workspace: "", suggestions: [], pinned: [] };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WORKSPACE_TYPES: WorkspaceType[]  = ["home", "office", "coworking", "hybrid", "remote"];
const LIVING_WITH_OPTIONS: LivingWith[] = ["alone", "family", "roommates", "partner"];

const CUE_TABS: { id: CueType; label: string; icon: string }[] = [
  { id: "space",   label: "Space",   icon: "🏠" },
  { id: "people",  label: "People",  icon: "👥" },
  { id: "ritual",  label: "Rituals", icon: "🔁" },
];

const CUE_ICON: Record<CueType, string> = { space: "🏠", people: "👥", ritual: "🔁" };

// ─── Fallback pool (shuffled so "New" always feels fresh) ────────────────────

const FALLBACK_POOL: Omit<EnvironmentCue, "id">[] = [
  { type: "space",   text: "Keep your current project materials visible on your desk.", linkedContext: "Focus" },
  { type: "space",   text: "Try a dedicated workspace with minimal distractions.", linkedContext: "Productivity" },
  { type: "space",   text: "Put a whiteboard or sticky-note wall in your line of sight.", linkedContext: "Clarity" },
  { type: "space",   text: "Clear your desk at the end of each day to reset mentally.", linkedContext: "Reset ritual" },
  { type: "space",   text: "Place a meaningful object that reminds you of your goal nearby.", linkedContext: "Motivation" },
  { type: "people",  text: "Consider connecting with someone who shares your goals weekly.", linkedContext: "Accountability" },
  { type: "people",  text: "It helps to have someone you can share progress with regularly.", linkedContext: "Support" },
  { type: "people",  text: "Try scheduling a bi-weekly check-in with a peer or mentor.", linkedContext: "Growth" },
  { type: "people",  text: "Identify one person you can teach what you're learning — it deepens retention.", linkedContext: "Learning" },
  { type: "people",  text: "Consider reducing time with people who consistently drain your focus.", linkedContext: "Energy" },
  { type: "ritual",  text: "Try a brief daily review of your top priorities each morning.", linkedContext: "Planning" },
  { type: "ritual",  text: "Consider a wind-down ritual to clearly separate work and rest time.", linkedContext: "Balance" },
  { type: "ritual",  text: "Start work sessions with a 2-minute intention: what is the one thing that matters today?", linkedContext: "Focus" },
  { type: "ritual",  text: "Try a short walk before deep-work blocks to prime your focus.", linkedContext: "Mental clarity" },
  { type: "ritual",  text: "End each week with a 10-minute review of what moved and what didn't.", linkedContext: "Reflection" },
];

function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function makeFallbackCues(): EnvironmentCue[] {
  const space   = pickRandom(FALLBACK_POOL.filter(c => c.type === "space"),   2);
  const people  = pickRandom(FALLBACK_POOL.filter(c => c.type === "people"),  2);
  const ritual  = pickRandom(FALLBACK_POOL.filter(c => c.type === "ritual"),  2);
  return [...space, ...people, ...ritual].map(c => ({ ...c, id: uid() }));
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-zinc-800 rounded-lg p-3 space-y-2 animate-pulse">
      <div className="h-3.5 bg-zinc-700 rounded w-4/5" />
      <div className="h-3.5 bg-zinc-700 rounded w-3/5" />
      <div className="h-2.5 bg-zinc-700/60 rounded w-1/3 mt-1" />
    </div>
  );
}

// ─── EnvironmentSection ───────────────────────────────────────────────────────

export function EnvironmentSection({
  env,
  onChange,
  goals,
  activeHealthFlags,
}: {
  env: EnvironmentProfile;
  onChange: (e: EnvironmentProfile) => void;
  goals: GoalEntry[];
  activeHealthFlags: string[];
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeTab, setActiveTab]     = useState<CueType>("space");
  const [addOpen, setAddOpen]         = useState(false);
  const [addText, setAddText]         = useState("");
  const [addType, setAddType]         = useState<CueType>("space");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep a ref so async onSuccess callbacks always see the latest env (never stale)
  const envRef = useRef(env);
  useEffect(() => { envRef.current = env; });

  const { loading: generating, generate } = useAIBlock<{ cues: EnvironmentCue[] }>(
    "/api/self/generate-environment-cues"
  );

  // ── Staleness detection ──────────────────────────────────────────────────────
  const isStale = useMemo(() => {
    if (!env.lastGeneratedFor) return true;
    const currentGoalIds = goals.map(g => g.id).sort();
    const currentFlags   = [...activeHealthFlags].sort();
    const prevGoalIds    = [...env.lastGeneratedFor.goalIds].sort();
    const prevFlags      = [...env.lastGeneratedFor.healthFlags].sort();
    return (
      JSON.stringify(currentGoalIds) !== JSON.stringify(prevGoalIds) ||
      JSON.stringify(currentFlags)   !== JSON.stringify(prevFlags)
    );
  }, [goals, activeHealthFlags, env.lastGeneratedFor]);

  // ── Auto-generate when stale (debounced 1500ms) ──────────────────────────────
  useEffect(() => {
    if (!isStale) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runGenerate();
    }, 1500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStale]);

  // ── Shared generate call (used by both auto and manual button) ───────────────
  function runGenerate() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const goalIds     = goals.map(g => g.id).sort();
    const healthFlags = [...activeHealthFlags].sort();
    generate(
      {
        goals:       goals.map(g => ({ id: g.id, statement: g.statement, description: g.description })),
        healthFlags: activeHealthFlags,
        workspace:   env.workspace,
        livingWith:  env.livingWith,
      },
      (data) => {
        onChange({
          ...envRef.current,
          suggestions:      data.cues ?? [],
          lastGeneratedFor: { goalIds, healthFlags },
        });
      },
      () => ({ cues: makeFallbackCues() })
    );
  }

  // ── Derived display values ───────────────────────────────────────────────────
  const city     = env.location?.city     ?? env.city     ?? "";
  const country  = env.location?.country  ?? env.country  ?? "";
  const timezone = env.location?.timezone ?? env.timezone ?? "";

  const filteredSuggestions = env.suggestions.filter(c => c.type === activeTab);
  const doneCount           = env.pinned.filter(c => c.done).length;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function setWorkspace(w: WorkspaceType) {
    onChange({ ...env, workspace: env.workspace === w ? "" : w });
  }
  function setLivingWith(l: LivingWith) {
    onChange({ ...env, livingWith: env.livingWith === l ? "" : l });
  }
  function setLocation(k: "city" | "country" | "timezone", v: string) {
    onChange({
      ...env,
      location: {
        city:     env.location?.city     ?? "",
        country:  env.location?.country  ?? "",
        timezone: env.location?.timezone ?? "",
        [k]: v,
      },
    });
  }
  function pinCue(cue: EnvironmentCue) {
    // Ignore if the same text is already saved (prevents duplicates when pressing New)
    if (env.pinned.some(p => p.text === cue.text)) return;
    onChange({
      ...env,
      suggestions: env.suggestions.filter(c => c.id !== cue.id),
      pinned:      [...env.pinned, { ...cue, savedAt: new Date().toISOString(), done: false }],
    });
  }
  function dismissCue(id: string) {
    onChange({ ...env, suggestions: env.suggestions.filter(c => c.id !== id) });
  }
  function removePinned(id: string) {
    onChange({ ...env, pinned: env.pinned.filter(c => c.id !== id) });
  }
  function toggleDone(id: string) {
    onChange({
      ...env,
      pinned: env.pinned.map(c => c.id === id ? { ...c, done: !c.done } : c),
    });
  }
  function addUserItem() {
    const text = addText.trim();
    if (!text) return;
    const newCue: EnvironmentCue = {
      id:            uid(),
      type:          addType,
      text,
      linkedContext: "My note",
      savedAt:       new Date().toISOString(),
      done:          false,
      userAdded:     true,
    };
    onChange({ ...env, pinned: [...env.pinned, newCue] });
    setAddText("");
    setAddOpen(false);
  }

  // ── Styles ───────────────────────────────────────────────────────────────────

  const badgeBase = "px-2.5 py-1.5 rounded-lg text-xs border transition-colors cursor-pointer capitalize";
  const badgeClass = (selected: boolean) =>
    selected
      ? `${badgeBase} bg-white/10 border-white/20 text-white`
      : `${badgeBase} bg-transparent border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-300`;

  const inputCls = "w-full bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/20";

  return (
    <div className="space-y-5">

      {/* ── Generating banner ── */}
      {generating && (
        <div className="flex items-center gap-2 text-xs text-zinc-400 py-0.5">
          <span className="w-3 h-3 rounded-full border-2 border-zinc-600 border-t-zinc-400 animate-spin flex-shrink-0" />
          Updating suggestions…
        </div>
      )}

      {/* ── Profile section (collapsed by default) ── */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setProfileOpen(o => !o)}
          className="flex items-center justify-between w-full text-left group"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Profile</span>
            {(env.workspace || city) && !profileOpen && (
              <div className="flex gap-1.5 items-center">
                {env.workspace && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-zinc-400 border border-white/8 capitalize">
                    {env.workspace}
                  </span>
                )}
                {city && <span className="text-[10px] text-zinc-500">{city}</span>}
              </div>
            )}
          </div>
          <span className="text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors">
            {profileOpen ? "Hide" : "Edit"}
          </span>
        </button>

        {profileOpen && (
          <div className="space-y-4 pt-1">

            {/* Workspace */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Workspace</p>
              <div className="flex flex-wrap gap-1.5">
                {WORKSPACE_TYPES.map(w => (
                  <button key={w} type="button" onClick={() => setWorkspace(w)} className={badgeClass(env.workspace === w)}>
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {/* Living with */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Living with</p>
              <div className="flex flex-wrap gap-1.5">
                {LIVING_WITH_OPTIONS.map(l => (
                  <button key={l} type="button" onClick={() => setLivingWith(l)} className={badgeClass(env.livingWith === l)}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Location</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={city}
                  onChange={e => setLocation("city", e.target.value)}
                  placeholder="City"
                  className={inputCls}
                />
                <input
                  value={country}
                  onChange={e => setLocation("country", e.target.value)}
                  placeholder="Country"
                  className={inputCls}
                />
              </div>
              <input
                value={timezone}
                onChange={e => setLocation("timezone", e.target.value)}
                placeholder="Timezone (e.g. Asia/Kolkata)"
                className={inputCls}
              />
            </div>

          </div>
        )}
      </div>

      {/* ── Suggestions section ── */}
      <div className="space-y-3">

        {/* Tab pills + New suggestions button */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 flex-1">
            {CUE_TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  activeTab === tab.id
                    ? "bg-white/10 border-white/20 text-white"
                    : "bg-transparent border-white/10 text-zinc-500 hover:border-white/15 hover:text-zinc-400"
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={runGenerate}
            disabled={generating}
            title="Generate new suggestions"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-zinc-500 hover:text-zinc-200 border border-white/10 hover:border-white/20 hover:bg-white/5 transition-colors disabled:opacity-40 flex-shrink-0"
          >
            <span className={generating ? "animate-spin inline-block" : ""}>↻</span>
            New
          </button>
        </div>

        {/* Cards */}
        <div className="space-y-2">
          {generating ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : filteredSuggestions.length === 0 ? (
            <p className="text-xs text-zinc-600 py-2">
              {env.lastGeneratedFor ? "No suggestions right now" : "Generating your first suggestions…"}
            </p>
          ) : (
            filteredSuggestions.map(cue => {
              const alreadySaved = env.pinned.some(p => p.text === cue.text);
              return (
              <div key={cue.id} className="bg-zinc-800 rounded-lg p-3 space-y-1.5 border border-white/5">
                <p className="text-sm text-zinc-100 leading-relaxed">{cue.text}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500">{cue.linkedContext}</span>
                  <div className="flex gap-0.5">
                    {alreadySaved ? (
                      <span className="flex items-center gap-1 px-2 py-1 text-xs text-green-500 leading-none">
                        ✓ Saved
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => pinCue(cue)}
                        title="Save to My environment"
                        className="flex items-center gap-1 px-2 py-1 rounded text-zinc-500 hover:text-white hover:bg-white/8 transition-colors text-xs leading-none"
                      >
                        📌 Save
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => dismissCue(cue.id)}
                      title="Dismiss"
                      className="p-1.5 rounded text-zinc-600 hover:text-zinc-300 hover:bg-white/8 transition-colors text-xs leading-none font-medium"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );})
          )}
        </div>
      </div>

      {/* ── My environment (pinned + user-added) ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">My environment</p>
          {env.pinned.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/8 border border-white/10 text-zinc-400 font-medium">
              {doneCount}/{env.pinned.length}
            </span>
          )}
        </div>

        {env.pinned.length > 0 && (
          <div className="space-y-2">
            {env.pinned.map(cue => (
              <div
                key={cue.id}
                className={`rounded-lg p-3 border flex items-start gap-2.5 transition-colors ${
                  cue.done
                    ? "bg-zinc-800/30 border-green-500/15"
                    : "bg-zinc-800/60 border-white/5"
                }`}
              >
                {/* Done toggle */}
                <button
                  type="button"
                  onClick={() => toggleDone(cue.id)}
                  title={cue.done ? "Mark undone" : "Mark done"}
                  className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 transition-colors ${
                    cue.done
                      ? "border-green-500 bg-green-500/20 text-green-400"
                      : "border-zinc-600 hover:border-zinc-400"
                  }`}
                >
                  {cue.done && (
                    <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                      <path d="M1 3.5L3.5 6L8 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>

                {/* Type icon */}
                <span className="text-sm flex-shrink-0 mt-0.5">{CUE_ICON[cue.type]}</span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-relaxed ${cue.done ? "line-through text-zinc-500" : "text-zinc-200"}`}>
                    {cue.text}
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">
                    {cue.userAdded ? "Your note" : "Saved suggestion"}
                    {cue.savedAt && ` · ${new Date(cue.savedAt).toLocaleDateString()}`}
                  </p>
                </div>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removePinned(cue.id)}
                  title="Remove"
                  className="flex-shrink-0 p-1.5 rounded text-zinc-600 hover:text-zinc-400 hover:bg-white/8 transition-colors text-xs leading-none"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add your own */}
        {!addOpen ? (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-200 border border-dashed border-white/10 hover:border-white/20 hover:bg-white/5 transition-colors w-full justify-center mt-1"
          >
            + Add your own item
          </button>
        ) : (
          <div className="space-y-2 bg-zinc-800/60 rounded-lg p-3 border border-white/10 mt-1">
            <input
              autoFocus
              value={addText}
              onChange={e => setAddText(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") { e.preventDefault(); addUserItem(); }
                if (e.key === "Escape") { setAddOpen(false); setAddText(""); }
              }}
              placeholder="e.g. Move my desk near the window"
              className={inputCls}
            />
            <div className="flex items-center gap-2 flex-wrap">
              {/* Type picker */}
              <div className="flex gap-1">
                {CUE_TABS.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAddType(tab.id)}
                    className={`px-2 py-1 rounded text-xs border transition-colors ${
                      addType === tab.id
                        ? "bg-white/10 border-white/20 text-white"
                        : "border-white/10 text-zinc-500 hover:text-zinc-400 hover:border-white/15"
                    }`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>
              {/* Actions */}
              <div className="flex gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={() => { setAddOpen(false); setAddText(""); }}
                  className="px-2.5 py-1 rounded text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={addUserItem}
                  disabled={!addText.trim()}
                  className="px-2.5 py-1 rounded text-xs bg-white/10 text-white hover:bg-white/15 border border-white/15 transition-colors disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
