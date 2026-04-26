"use client";
// components/self/SelfCanvas.tsx — visual grid layout

import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X, Trash2 } from "lucide-react";
import { computeEnergy } from "@/blocks/EnergyBlock";
import { GoalCreationFlow } from "@/app/(with-nav)/self/tabs/goal-creation/GoalCreationFlow";
import type { GoalArchetype } from "@/app/(with-nav)/self/tabs/goal-creation/flow-config/types";
import { ARCHETYPE_ICON } from "@/app/(with-nav)/self/tabs/time/components/GoalExecuteSection";
import { SkillsSection } from "@/blocks/SkillBlock";
import { HealthSection } from "@/blocks/HealthBlock";
import { FundsSection } from "@/blocks/FundsBlock";
import { TimeSection } from "@/blocks/TimeBlock";
import { EnvironmentSection } from "@/blocks/EnvironmentBlock";
import { GoalExecuteSection } from "@/app/(with-nav)/self/tabs/time/components/GoalExecuteSection";
import CirclesPanel from "@/components/CirclesPanel";
import { CollapsibleSection } from "@/components/self/shared";
import { TimelineList } from "@/components/timeline/TimelineList";
import type {
  GoalEntry, HealthProfile, SkillEntry, DriveType,
  WeekSchedule, FundsProfile, EnvironmentProfile,
  FrequencyType, JoyProfile, DayKey, PageItem,
} from "@/types/self";

// ─── Types ────────────────────────────────────────────────────────────────────

type PartnerId = "health" | "skills" | "energy" | "environment" | "time" | "funds" | "network";

type AiGoalItem = { id: string; title: string; archetype: GoalArchetype; status: string; updatedAt: string };

// ─── Archetype tabs ───────────────────────────────────────────────────────────

const ARCHETYPE_TABS: { id: GoalArchetype; label: string }[] = [
  { id: "LEARN",   label: "Learn"   },
  { id: "BUILD",   label: "Build"   },
  { id: "EXECUTE", label: "Execute" },
  { id: "CONNECT", label: "Connect" },
];

const DRIVE_TO_ARCHETYPE: Record<string, GoalArchetype> = {
  learning: "LEARN",
  building: "BUILD",
  doing:    "EXECUTE",
  helping:  "CONNECT",
};

// ─── Partner config ───────────────────────────────────────────────────────────

const PARTNER_CFG: Record<PartnerId, {
  label: string; icon: string;
  iconBg: string; iconText: string;
  border: string;
}> = {
  health:      { label: "Health",      icon: "🍎", iconBg: "#065f46", iconText: "#6ee7b7", border: "#34d399" },
  skills:      { label: "Skills",      icon: "🎯", iconBg: "#1e3a8a", iconText: "#93c5fd", border: "#60a5fa" },
  energy:      { label: "Energy",      icon: "⚡", iconBg: "#7c2d12", iconText: "#fdba74", border: "#fb923c" },
  environment: { label: "Environ.",    icon: "🌍", iconBg: "#1f2937", iconText: "#d1d5db", border: "#9ca3af" },
  time:        { label: "Time",        icon: "◷",  iconBg: "#0e7490", iconText: "#a5f3fc", border: "#22d3ee" },
  funds:       { label: "Funds",       icon: "💰", iconBg: "#78350f", iconText: "#fcd34d", border: "#fbbf24" },
  network:     { label: "Network",     icon: "👥", iconBg: "#4c1d95", iconText: "#c4b5fd", border: "#a78bfa" },
};

const MIDDLE_PARTNERS: PartnerId[] = ["energy", "environment", "time", "funds", "network"];
const ALL_PARTNERS:    PartnerId[] = ["health", "skills", "energy", "time", "environment", "funds", "network"];

// ─── Today ────────────────────────────────────────────────────────────────────

const JS_TO_IDX: Record<number, number> = { 0: 6, 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 };
const TODAY_IDX = JS_TO_IDX[new Date().getDay()] ?? 0;
const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TODAY_KEY = DAY_KEYS[TODAY_IDX];

// ─── Joy section score ────────────────────────────────────────────────────────

function joySectionScore(sec: { types: string[]; frequency: FrequencyType } | undefined): number {
  if (!sec || sec.types.length === 0) return 5;
  const m: Record<FrequencyType, number> = { daily: 9, few_per_week: 7, weekly: 5, rarely: 3 };
  return m[sec.frequency] ?? 5;
}

// ─── Goals compact card ───────────────────────────────────────────────────────

function GoalsCompact({ onExpand, profileGoals }: {
  onExpand: () => void;
  profileGoals: GoalEntry[];
}) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    function fetchCount() {
      fetch("/api/self/goals", { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) setCount((data.goals ?? []).filter((g: any) => g.status === "ACTIVE").length);
        })
        .catch(() => {});
    }
    fetchCount();
    const handler = () => fetchCount();
    window.addEventListener("charaivati:goalCreated", handler);
    return () => window.removeEventListener("charaivati:goalCreated", handler);
  }, []);

  // Fall back to profile goals (from onboarding / localStorage) when DB returns 0
  const filledProfileGoals = profileGoals.filter(g => g.statement.trim());
  const effectiveCount = (count === null || count === 0) && filledProfileGoals.length > 0
    ? filledProfileGoals.length
    : count;

  const label = effectiveCount === null
    ? "…"
    : effectiveCount === 0
    ? "No goals yet"
    : `${effectiveCount} goal${effectiveCount !== 1 ? "s" : ""}`;

  return (
    <button type="button" onClick={onExpand}
      className="rounded-xl border flex flex-col items-center justify-center h-full w-full text-center
        transition-all duration-150 hover:border-indigo-500/40 hover:shadow-indigo-500/10 select-none
        cursor-pointer pt-4 pb-4 px-3"
      style={{
        background: "rgba(17,24,39,0.85)",
        borderColor: "rgba(255,255,255,0.14)",
        boxShadow: "0 0 24px rgba(99,102,241,0.10), inset 0 1px 0 rgba(255,255,255,0.07)",
        minHeight: "140px",
      }}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm mb-2"
        style={{ background: "#1e1b4b", color: "#a5b4fc" }}>
        🎯
      </div>
      <span className="text-sm font-semibold text-white">Goals</span>
      <span className="text-xs text-gray-400 mt-1">{label}</span>
      {effectiveCount !== null && effectiveCount > 0 && count === 0 && (
        <span className="text-[9px] text-gray-600 mt-0.5">from profile</span>
      )}
    </button>
  );
}

// ─── Goals expanded card (AI goals only) ─────────────────────────────────────

function GoalsExpanded({ onClose, activeDrives }: {
  onClose: () => void;
  activeDrives: string[];
}) {
  const [goals, setGoals]   = useState<AiGoalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]   = useState<GoalArchetype | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Only show tabs for the drives the user has selected
  const visibleTabs = ARCHETYPE_TABS.filter(t =>
    activeDrives.length === 0 || activeDrives.some(d => DRIVE_TO_ARCHETYPE[d] === t.id)
  );
  const [tab, setTab] = useState<GoalArchetype>(visibleTabs[0]?.id ?? "LEARN");

  function loadGoals() {
    setLoading(true);
    fetch("/api/self/goals", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setGoals((data.goals ?? []).filter((g: any) => g.status === "ACTIVE") as AiGoalItem[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadGoals(); }, []);

  // Auto-switch to first visible tab that has goals
  useEffect(() => {
    if (goals.length === 0) return;
    const hasTab = goals.some(g => g.archetype === tab);
    if (!hasTab) {
      const first = visibleTabs.find(t => goals.some(g => g.archetype === t.id));
      if (first) setTab(first.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals]);

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await fetch(`/api/self/goals/${id}`, { method: "DELETE", credentials: "include" });
      setGoals(prev => prev.filter(g => g.id !== id));
    } catch (e) { console.error("[GoalsExpanded] delete failed", e); }
    setDeleting(null);
  }

  const tabGoals = goals.filter(g => g.archetype === tab);

  return (
    <>
      {modal !== null && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onKeyDown={e => { if (e.key === "Escape") setModal(null); }}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <GoalCreationFlow
              initialArchetype={modal}
              onSaved={() => {
                setModal(null);
                loadGoals();
                try { window.dispatchEvent(new CustomEvent("charaivati:goalCreated")); } catch {}
              }}
              onCancel={() => setModal(null)}
            />
          </div>
        </div>,
        document.body
      )}

      <div className="rounded-2xl border overflow-hidden"
        style={{
          borderColor: "rgba(129,140,248,0.35)",
          background: "rgb(17,24,39)",
          boxShadow: "0 0 32px rgba(99,102,241,0.12), inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.5)",
          animation: "panelIn 220ms ease both",
        }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-indigo-500/15">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
            style={{ background: "#1e1b4b", color: "#a5b4fc" }}>
            🎯
          </div>
          <span className="text-sm font-semibold text-white flex-1">Goals</span>
          <button type="button" onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Archetype tabs — only show user's selected drives */}
          <div className="flex gap-2 flex-wrap">
            {visibleTabs.map(t => {
              const cnt = goals.filter(g => g.archetype === t.id).length;
              return (
                <button key={t.id} type="button" onClick={() => setTab(t.id)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                  style={{
                    background: tab === t.id ? "rgba(99,102,241,0.15)" : "transparent",
                    borderColor: tab === t.id ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.1)",
                    color: tab === t.id ? "#a5b4fc" : "#6b7280",
                  }}>
                  {ARCHETYPE_ICON[t.id]} {t.label}
                  {cnt > 0 && <span className="ml-1 opacity-60">{cnt}</span>}
                </button>
              );
            })}
          </div>

          {/* Goals list */}
          {loading ? (
            <div className="py-4 flex justify-center">
              <div className="w-4 h-4 rounded-full border-2 border-indigo-500/40 border-t-indigo-500 animate-spin" />
            </div>
          ) : tabGoals.length === 0 ? (
            <p className="text-sm text-gray-600">No {tab.toLowerCase()} goals yet.</p>
          ) : (
            <div className="space-y-2">
              {tabGoals.map(g => (
                <div key={g.id}
                  className="group flex items-center gap-3 px-3 py-2.5 rounded-xl
                    bg-gray-800/40 border border-gray-700/30 hover:border-gray-600/50 transition-colors">
                  <span className="text-sm flex-shrink-0">{ARCHETYPE_ICON[g.archetype]}</span>
                  <p className="text-sm text-gray-200 flex-1 truncate">{g.title}</p>
                  <button type="button" onClick={() => handleDelete(g.id)} disabled={deleting === g.id}
                    className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10
                      transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50 flex-shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add goal */}
          <div className="pt-1">
            <button type="button" onClick={() => setModal(tab)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-500/40
                bg-indigo-500/8 text-xs text-indigo-300 hover:border-indigo-500/70 hover:text-indigo-200
                transition-colors">
              ✦ Add goal
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Top block (Health / Skills in row 1) ────────────────────────────────────

function TopBlock({
  id, status, statusType, active, onClick,
}: {
  id: PartnerId; status: string; statusType: "good" | "neutral" | "warning";
  active: boolean; onClick: () => void;
}) {
  const cfg = PARTNER_CFG[id];
  const statusColor = statusType === "good" ? "#22c55e" : statusType === "warning" ? "#f59e0b" : "#9ca3af";
  return (
    <button type="button" onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 rounded-xl border
        transition-all duration-150 cursor-pointer text-center w-full h-full py-3 px-2"
      style={{
        background: active ? `${cfg.border}12` : "rgba(17,24,39,0.7)",
        borderColor: active ? cfg.border : "rgba(255,255,255,0.07)",
        boxShadow: active ? `0 0 0 1px ${cfg.border}50, 0 4px 16px ${cfg.border}15` : undefined,
        transform: active ? "translateY(-2px)" : undefined,
      }}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0"
        style={{ background: cfg.iconBg, color: cfg.iconText }}>
        {cfg.icon}
      </div>
      <span className="text-[11px] font-semibold text-white leading-none">{cfg.label}</span>
      <span className="text-[9px] leading-none" style={{ color: statusColor }}>{status}</span>
    </button>
  );
}

// ─── Partner card (middle row) ────────────────────────────────────────────────

function PartnerCard({
  id, status, statusType, active, onClick,
}: {
  id: PartnerId; status: string; statusType: "good" | "neutral" | "warning";
  active: boolean; onClick: () => void;
}) {
  const cfg = PARTNER_CFG[id];
  const statusColor = statusType === "good" ? "#22c55e" : statusType === "warning" ? "#f59e0b" : "#9ca3af";
  return (
    <button type="button" onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-xl border py-3 px-1
        transition-all duration-150 cursor-pointer text-center w-full"
      style={{
        background: active ? `${cfg.border}12` : "rgba(17,24,39,0.7)",
        borderColor: active ? cfg.border : "rgba(255,255,255,0.07)",
        boxShadow: active ? `0 0 0 1px ${cfg.border}50, 0 4px 16px ${cfg.border}15` : undefined,
        transform: active ? "translateY(-2px)" : undefined,
      }}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
        style={{ background: cfg.iconBg, color: cfg.iconText }}>
        {cfg.icon}
      </div>
      <span className="text-[11px] font-medium text-white leading-none">{cfg.label}</span>
      <span className="text-[9px] leading-none" style={{ color: statusColor }}>{status}</span>
    </button>
  );
}

// ─── Energy panel ─────────────────────────────────────────────────────────────

const FREQ_CYCLE: FrequencyType[] = ["rarely", "weekly", "few_per_week", "daily"];

function FactorPill({ label, value, onClick }: { label: string; value: number; onClick?: () => void }) {
  const cls = value >= 7
    ? "text-green-400 border-green-500/30 bg-green-500/10"
    : value >= 4
    ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
    : "text-red-400 border-red-500/30 bg-red-500/10";
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs
        transition-opacity ${cls} ${onClick ? "hover:opacity-75 cursor-pointer" : "cursor-default"}`}>
      <span className="text-gray-400">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
      {onClick && <span className="opacity-40 text-[9px]">↻</span>}
    </button>
  );
}

function EBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-20 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value * 10}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold tabular-nums flex-shrink-0 w-8 text-right"
        style={{ color }}>{value}/10</span>
    </div>
  );
}

function EnergyPanel({ health, energy, setHealth }: {
  health: HealthProfile;
  energy: ReturnType<typeof computeEnergy>;
  setHealth: (h: HealthProfile) => void;
}) {
  const trafficColor = energy.overall >= 7 ? "#22c55e" : energy.overall >= 4 ? "#f59e0b" : "#ef4444";
  const trafficLabel = energy.overall >= 7 ? "High energy" : energy.overall >= 4 ? "Moderate" : "Low energy";

  function cycleSleep() {
    const next = health.sleepQuality === "bad" ? "moderate" : health.sleepQuality === "moderate" ? "good" : "bad";
    setHealth({ ...health, sleepQuality: next });
  }
  function cycleExercise() {
    const cur = health.sessionsPerWeek ?? 0;
    const next = cur === 0 ? 2 : cur <= 2 ? 4 : cur <= 4 ? 6 : 0;
    setHealth({ ...health, sessionsPerWeek: next });
  }
  function cycleStress() {
    const next = health.stressLevel === "High" ? "Mid" : health.stressLevel === "Mid" ? "Low" : "High";
    setHealth({ ...health, stressLevel: next });
  }
  function cycleJoyFreq(key: keyof JoyProfile) {
    const cur = health.joy?.[key]?.frequency ?? "rarely";
    const idx = FREQ_CYCLE.indexOf(cur);
    const next = FREQ_CYCLE[(idx + 1) % FREQ_CYCLE.length];
    const section = health.joy?.[key] ?? { types: [], frequency: "rarely" as FrequencyType };
    setHealth({
      ...health,
      joy: {
        hobbies: { types: [], frequency: "rarely" as FrequencyType },
        sports:  { types: [], frequency: "rarely" as FrequencyType },
        social:  { types: [], frequency: "rarely" as FrequencyType },
        rest:    { types: [], frequency: "rarely" as FrequencyType },
        ...health.joy,
        [key]: { ...section, frequency: next },
      },
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <span className="text-4xl font-bold tabular-nums" style={{ color: trafficColor }}>
          {energy.overall}
        </span>
        <div>
          <p className="text-sm font-semibold leading-tight" style={{ color: trafficColor }}>{trafficLabel}</p>
          <p className="text-xs text-gray-500">out of 10</p>
        </div>
      </div>
      <div className="space-y-2.5">
        <EBar label="Physical"   value={energy.physical} color="#22c55e" />
        <EBar label="Mental"     value={energy.mental}   color="#4ade80" />
        <EBar label="Joy & Life" value={energy.joy}      color="#22d3ee" />
      </div>
      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2.5">Health factors</p>
        <div className="flex flex-wrap gap-2">
          <FactorPill label="Sleep"     value={energy.factors.sleep}     onClick={cycleSleep}    />
          <FactorPill label="Exercise"  value={energy.factors.exercise}  onClick={cycleExercise} />
          <FactorPill label="Stress"    value={energy.factors.stress}    onClick={cycleStress}   />
          <FactorPill label="Nutrition" value={energy.factors.nutrition} />
        </div>
        <p className="text-[10px] text-gray-600 mt-2">Tap to cycle · Nutrition editable in Health panel</p>
      </div>
      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2.5">Joy factors</p>
        <div className="flex flex-wrap gap-2">
          <FactorPill label="Hobbies" value={joySectionScore(health.joy?.hobbies)} onClick={() => cycleJoyFreq("hobbies")} />
          <FactorPill label="Sports"  value={joySectionScore(health.joy?.sports)}  onClick={() => cycleJoyFreq("sports")}  />
          <FactorPill label="Social"  value={joySectionScore(health.joy?.social)}  onClick={() => cycleJoyFreq("social")}  />
          <FactorPill label="Rest"    value={joySectionScore(health.joy?.rest)}    onClick={() => cycleJoyFreq("rest")}    />
        </div>
        <p className="text-[10px] text-gray-600 mt-2">Tap to cycle · More in Health → Joy & Life</p>
      </div>
      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2.5">Context factors</p>
        <div className="space-y-2.5">
          <EBar label="Environment" value={energy.environment} color="#9ca3af" />
          <EBar label="Time load"   value={energy.time}        color="#22d3ee" />
          <EBar label="Funds"       value={energy.funds}       color="#fbbf24" />
          <EBar label="Network"     value={energy.network}     color="#a78bfa" />
        </div>
      </div>
      <button type="button"
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
          bg-orange-900/30 border border-orange-500/30 text-orange-300 hover:bg-orange-900/50 transition-colors">
        <Sparkles className="w-4 h-4" />
        Boost my energy
      </button>
    </div>
  );
}

// ─── Daily work ───────────────────────────────────────────────────────────────

function DailyWork({ schedule }: { schedule: WeekSchedule }) {
  const tasks = (schedule.tasks ?? []).filter(t => t.day === TODAY_KEY);
  const todayLabel = DAY_LABELS[TODAY_IDX];

  if (tasks.length === 0) return null;

  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{
        borderColor: "rgba(255,255,255,0.07)",
        background: "rgb(10,12,16)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.5)",
      }}>
      <div className="px-5 py-3 border-b border-white/[0.05] flex items-center gap-2">
        <span className="text-sm leading-none">📋</span>
        <span className="text-xs font-semibold text-gray-300 tracking-wide">Today</span>
        <span className="text-[10px] text-gray-600 ml-auto">{todayLabel}</span>
      </div>
      <div className="p-4 space-y-1">
        {tasks.map(task => (
          <div key={task.id}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl
              bg-gray-800/30 border border-gray-800/60
              ${task.done ? "opacity-50" : ""}`}>
            <span className="flex-shrink-0 text-sm leading-none"
              style={{ color: task.done ? "#22c55e" : "#6b7280" }}>
              {task.done ? "●" : "○"}
            </span>
            <span className={`text-sm flex-1 ${task.done ? "line-through text-gray-500" : "text-gray-200"}`}>
              {task.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Expanded panel wrapper ───────────────────────────────────────────────────

function ExpandedPanel({
  id, onClose,
  health, goals, generalSkills, skillsLoading,
  weekSchedule, fundsProfile, environmentProfile, highlightGoalId, highlightGeneral,
  energy, activeHealthFlags,
  drives, pages,
  setHealth, onUpdateGeneralSkills, onUpdateGoalSkills, onSuggestSkills,
  onWeekScheduleChange, onFundsChange, onEnvironmentChange,
  timelineGoal, onTimelineModalClosed,
}: {
  id: PartnerId; onClose: () => void;
  health: HealthProfile; goals: GoalEntry[];
  generalSkills: SkillEntry[]; skillsLoading: Record<string, boolean>;
  weekSchedule: WeekSchedule; fundsProfile: FundsProfile;
  environmentProfile: EnvironmentProfile; highlightGoalId: string | null; highlightGeneral?: boolean;
  energy: ReturnType<typeof computeEnergy>;
  activeHealthFlags: string[];
  drives: DriveType[];
  pages: PageItem[];
  setHealth: (h: HealthProfile) => void;
  onUpdateGeneralSkills: (s: SkillEntry[]) => void;
  onUpdateGoalSkills: (goalId: string, s: SkillEntry[]) => void;
  onSuggestSkills: (goalId: string) => void;
  onWeekScheduleChange: (s: WeekSchedule) => void;
  onFundsChange: (f: FundsProfile) => void;
  onEnvironmentChange: (e: EnvironmentProfile) => void;
  timelineGoal: { id: string; title: string } | null;
  onTimelineModalClosed: () => void;
}) {
  const cfg = PARTNER_CFG[id];
  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{
        borderColor: `${cfg.border}40`,
        background: "rgb(17,24,39)",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 24px rgba(0,0,0,0.5)`,
        animation: "panelIn 280ms ease both",
      }}>
      {id !== "time" && (
        <div className="flex justify-end px-4 pt-3 pb-0">
          <button type="button" onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <div className={id === "time" ? "" : "p-5"}>
        {id === "health"      && <HealthSection health={health} setHealth={setHealth} />}
        {id === "skills"      && (
          <SkillsSection
            generalSkills={generalSkills} goals={goals}
            skillsLoading={skillsLoading}
            onUpdateGeneralSkills={onUpdateGeneralSkills}
            onUpdateGoalSkills={onUpdateGoalSkills}
            onSuggestSkills={onSuggestSkills}
            highlightGoalId={highlightGoalId}
            highlightGeneral={highlightGeneral}
            schedule={weekSchedule}
            onScheduleChange={onWeekScheduleChange}
          />
        )}
        {id === "network"     && <CirclesPanel />}
        {id === "funds"       && <FundsSection funds={fundsProfile} goals={goals} generalSkills={generalSkills} pages={pages} drives={drives} onChange={onFundsChange} />}
        {id === "environment" && (
          <EnvironmentSection
            env={environmentProfile}
            onChange={onEnvironmentChange}
            goals={goals}
            activeHealthFlags={activeHealthFlags}
          />
        )}
        {id === "energy"      && (
          <EnergyPanel health={health} energy={energy} setHealth={setHealth} />
        )}
        {id === "time"        && (
          <div className="space-y-2.5 p-5">
            <GoalExecuteSection />
            <TimeSection schedule={weekSchedule} goals={goals} onChange={onWeekScheduleChange} defaultOpen={true} />
            <CollapsibleSection
              title="Project Timelines"
              subtitle="Goal-driven projects with phases & milestones"
              defaultOpen={false}
            >
              <TimelineList
                goals={goals}
                createFromGoalId={timelineGoal?.id}
                createFromGoalTitle={timelineGoal?.title}
                onCreateModalClosed={onTimelineModalClosed}
              />
            </CollapsibleSection>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main SelfCanvas ──────────────────────────────────────────────────────────

export interface SelfCanvasProps {
  health: HealthProfile;
  goals: GoalEntry[];
  generalSkills: SkillEntry[];
  skillsLoading: Record<string, boolean>;
  weekSchedule: WeekSchedule;
  fundsProfile: FundsProfile;
  environmentProfile: EnvironmentProfile;
  highlightGoalId: string | null;
  highlightGeneral?: boolean;
  drives: DriveType[];
  pages: PageItem[];
  setHealth: (h: HealthProfile) => void;
  onUpdateGeneralSkills: (skills: SkillEntry[]) => void;
  onUpdateGoalSkills: (goalId: string, skills: SkillEntry[]) => void;
  onSuggestSkills: (goalId: string) => void;
  onWeekScheduleChange: (s: WeekSchedule) => void;
  onFundsChange: (f: FundsProfile) => void;
  onEnvironmentChange: (e: EnvironmentProfile) => void;
}

export function SelfCanvas(props: SelfCanvasProps) {
  const {
    health, goals, generalSkills, skillsLoading,
    weekSchedule, fundsProfile, environmentProfile, highlightGoalId, highlightGeneral,
    drives, pages,
    setHealth, onUpdateGeneralSkills, onUpdateGoalSkills, onSuggestSkills,
    onWeekScheduleChange, onFundsChange, onEnvironmentChange,
  } = props;

  const [activePartner, setActivePartner] = useState<PartnerId>("time");
  const [goalsExpanded, setGoalsExpanded] = useState(false);
  const [timelineGoal, setTimelineGoal]   = useState<{ id: string; title: string } | null>(null);

  // Open Time panel when a new AI goal is created
  useEffect(() => {
    const handler = () => { setGoalsExpanded(false); setActivePartner("time"); };
    window.addEventListener("charaivati:goalCreated", handler);
    return () => window.removeEventListener("charaivati:goalCreated", handler);
  }, []);

  useEffect(() => {
    if (highlightGoalId) { setGoalsExpanded(false); setActivePartner("time"); }
  }, [highlightGoalId]);

  useEffect(() => {
    if (highlightGeneral) { setGoalsExpanded(false); setActivePartner("skills"); }
  }, [highlightGeneral]);

  const energy = computeEnergy(health, environmentProfile, weekSchedule, fundsProfile);

  const activeHealthFlags = useMemo(() => {
    const flags: string[] = [];
    if (health.sleepQuality) flags.push(`sleep:${health.sleepQuality}`);
    if (health.mood)         flags.push(`mood:${health.mood}`);
    if (health.stressLevel)  flags.push(`stress:${health.stressLevel}`);
    return flags;
  }, [health.sleepQuality, health.mood, health.stressLevel]);

  function partnerStatus(id: PartnerId): { text: string; type: "good" | "neutral" | "warning" } {
    switch (id) {
      case "health": {
        const s = energy.overall;
        return s > 0 || health.heightCm
          ? { text: `${s}/10`, type: s >= 7 ? "good" : s >= 4 ? "neutral" : "warning" }
          : { text: "Not set up", type: "warning" };
      }
      case "skills": {
        const n = goals.reduce((a, g) => a + g.skills.filter(s => s.name.trim()).length, 0)
          + generalSkills.filter(s => s.name.trim()).length;
        return n > 0 ? { text: `${n} tracked`, type: "neutral" } : { text: "None yet", type: "warning" };
      }
      case "energy": {
        const s = energy.overall;
        return { text: `${s}/10`, type: s >= 7 ? "good" : s >= 4 ? "neutral" : "warning" };
      }
      case "environment": {
        const displayCity = environmentProfile.location?.city || environmentProfile.city;
        return displayCity
          ? { text: displayCity, type: "neutral" }
          : { text: "Not set up", type: "warning" };
      }
      case "time": {
        const n = (weekSchedule.tasks ?? []).length;
        return n > 0
          ? { text: `${n} task${n !== 1 ? "s" : ""}`, type: "neutral" }
          : { text: "No tasks yet", type: "warning" };
      }
      case "funds": {
        const n = fundsProfile.sources.length;
        return n > 0
          ? { text: `${n} source${n !== 1 ? "s" : ""}`, type: "neutral" }
          : { text: "Not set up", type: "warning" };
      }
      case "network":
        return { text: "Tap to view", type: "neutral" };
    }
  }

  return (
    <div className="space-y-2.5">
      <style>{`
        @keyframes panelIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* ── Row 1: Goals compact OR Goals expanded ── */}
      {goalsExpanded ? (
        <GoalsExpanded onClose={() => setGoalsExpanded(false)} activeDrives={drives} />
      ) : (
        <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1.7fr 1fr", minHeight: "140px" }}>
          <TopBlock
            id="health"
            status={partnerStatus("health").text}
            statusType={partnerStatus("health").type}
            active={activePartner === "health"}
            onClick={() => setActivePartner("health")}
          />
          <GoalsCompact onExpand={() => setGoalsExpanded(true)} profileGoals={goals} />
          <TopBlock
            id="skills"
            status={partnerStatus("skills").text}
            statusType={partnerStatus("skills").type}
            active={activePartner === "skills"}
            onClick={() => setActivePartner("skills")}
          />
        </div>
      )}

      {/* ── Partners row ── */}
      <div className={`grid gap-2 ${
        goalsExpanded ? "grid-cols-4 sm:grid-cols-7" : "grid-cols-3 sm:grid-cols-5"
      }`}>
        {(goalsExpanded ? ALL_PARTNERS : MIDDLE_PARTNERS).map(id => {
          const { text, type } = partnerStatus(id);
          const MOBILE_PLACEMENT: Partial<Record<PartnerId, string>> = {
            environment: "col-start-3 row-start-1 sm:col-auto sm:row-auto",
            funds:       "col-start-1 row-start-2 sm:col-auto sm:row-auto",
            time:        "col-start-2 row-start-2 sm:col-auto sm:row-auto",
            network:     "col-start-3 row-start-2 sm:col-auto sm:row-auto",
          };
          const cls = !goalsExpanded ? MOBILE_PLACEMENT[id] : undefined;
          return (
            <div key={id} className={cls}>
              <PartnerCard
                id={id}
                status={text} statusType={type}
                active={activePartner === id}
                onClick={() => setActivePartner(id)}
              />
            </div>
          );
        })}
      </div>

      {/* ── Expanded panel (always open, Time by default) ── */}
      <ExpandedPanel
        key={activePartner}
        id={activePartner}
        onClose={() => setActivePartner("time")}
        health={health} goals={goals}
        generalSkills={generalSkills} skillsLoading={skillsLoading}
        weekSchedule={weekSchedule} fundsProfile={fundsProfile}
        environmentProfile={environmentProfile} highlightGoalId={highlightGoalId} highlightGeneral={highlightGeneral}
        energy={energy}
        activeHealthFlags={activeHealthFlags}
        drives={drives}
        pages={pages}
        setHealth={setHealth}
        onUpdateGeneralSkills={onUpdateGeneralSkills}
        onUpdateGoalSkills={onUpdateGoalSkills}
        onSuggestSkills={onSuggestSkills}
        onWeekScheduleChange={onWeekScheduleChange}
        onFundsChange={onFundsChange}
        onEnvironmentChange={onEnvironmentChange}
        timelineGoal={timelineGoal}
        onTimelineModalClosed={() => setTimelineGoal(null)}
      />

    </div>
  );
}
