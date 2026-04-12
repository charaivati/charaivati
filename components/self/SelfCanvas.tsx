"use client";
// components/self/SelfCanvas.tsx — visual grid layout

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X, Pencil, Trash2 } from "lucide-react";
import { computeEnergy } from "@/blocks/EnergyBlock";
import { OB_QS_FOCUSED, OB_QS_ZOOMED, DRIVE_TO_CAT } from "@/blocks/DriveBlock";
import type { OBMode } from "@/blocks/DriveBlock";
import { SkillsSection } from "@/blocks/SkillBlock";
import { HealthSection } from "@/blocks/HealthBlock";
import { FundsSection } from "@/blocks/FundsBlock";
import { TimeSection } from "@/blocks/TimeBlock";
import { EnvironmentSection } from "@/blocks/EnvironmentBlock";
import CirclesPanel from "@/components/CirclesPanel";
import type {
  GoalEntry, HealthProfile, SkillEntry, DriveType,
  WeekSchedule, FundsProfile, EnvironmentProfile,
  FrequencyType, JoyProfile, DayKey,
} from "@/types/self";

// ─── Types ────────────────────────────────────────────────────────────────────

type PartnerId = "health" | "skills" | "energy" | "environment" | "time" | "funds" | "network";

// ─── Drive colors / labels ────────────────────────────────────────────────────

const DRIVE_DOT: Record<DriveType, string> = {
  learning: "#38bdf8",
  helping:  "#fb7185",
  building: "#818cf8",
  doing:    "#fbbf24",
};

const DRIVE_LABEL: Record<DriveType, string> = {
  learning: "Learn",
  helping:  "Help",
  building: "Build",
  doing:    "Do",
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
const ALL_PARTNERS:    PartnerId[] = ["health", "skills", "energy", "environment", "time", "funds", "network"];

// ─── Today ────────────────────────────────────────────────────────────────────

const JS_TO_IDX: Record<number, number> = { 0: 6, 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 };
const TODAY_IDX = JS_TO_IDX[new Date().getDay()] ?? 0;
const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TODAY_KEY = DAY_KEYS[TODAY_IDX];

// ─── Joy section score ────────────────────────────────────────────────────────

function joySectionScore(sec: { types: string[]; frequency: FrequencyType } | undefined): number {
  if (!sec) return 4;
  const m: Record<FrequencyType, number> = { daily: 9, few_per_week: 7, weekly: 5, rarely: 3 };
  return m[sec.frequency] ?? 4;
}

// ─── Goal progress helper ─────────────────────────────────────────────────────

function goalPct(g: GoalEntry): number {
  let p = 0;
  if (g.saved) p += 25;
  const sk = g.skills.filter(s => s.name.trim()).length;
  if (sk > 0) p += Math.min(35, sk * 12);
  if (g.plan && !g.plan.fallback) p += 40;
  return Math.min(100, Math.round(p));
}

// ─── Goals compact card (clickable, two drive tabs) ───────────────────────────

function GoalsCompact({
  goals, drives, onExpand,
}: {
  goals: GoalEntry[]; drives: DriveType[]; onExpand: () => void;
}) {
  const [tab, setTab] = useState<DriveType>(drives[0] ?? "learning");
  const tabGoals = goals.filter(g => g.driveId === tab && g.statement.trim());

  return (
    <div role="button" tabIndex={0}
      onClick={onExpand}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onExpand(); } }}
      className="rounded-xl border flex flex-col h-full w-full text-left transition-all duration-150
        hover:border-indigo-500/40 hover:shadow-indigo-500/10 group cursor-pointer select-none"
      style={{
        background: "rgba(17,24,39,0.85)",
        borderColor: "rgba(255,255,255,0.14)",
        boxShadow: "0 0 24px rgba(99,102,241,0.10), inset 0 1px 0 rgba(255,255,255,0.07)",
        minHeight: "140px",
      }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2 flex-shrink-0">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
          style={{ background: "#1e1b4b", color: "#a5b4fc" }}>
          🎯
        </div>
        <span className="text-sm font-semibold text-white flex-1">Goals</span>
        <span className="text-[9px] text-gray-600 group-hover:text-indigo-400 transition-colors">expand ↓</span>
      </div>

      {/* Drive tabs */}
      {drives.length > 1 ? (
        <div className="flex px-3 gap-1 mb-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {drives.map(d => (
            <button key={d} type="button"
              onClick={e => { e.stopPropagation(); setTab(d); }}
              className="flex-1 py-1 rounded-md text-[10px] font-semibold transition-colors"
              style={{
                background: tab === d ? `${DRIVE_DOT[d]}25` : "transparent",
                color: tab === d ? DRIVE_DOT[d] : "#4b5563",
              }}>
              {DRIVE_LABEL[d]}
            </button>
          ))}
        </div>
      ) : drives.length === 1 ? (
        <div className="px-4 mb-2">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: `${DRIVE_DOT[drives[0]]}20`, color: DRIVE_DOT[drives[0]] }}>
            {DRIVE_LABEL[drives[0]]}
          </span>
        </div>
      ) : null}

      {/* Goals list */}
      <div className="px-4 pb-4 flex-1 min-h-0 space-y-2 overflow-hidden">
        {tabGoals.length === 0 ? (
          <p className="text-xs text-gray-600">No goals set yet</p>
        ) : (
          tabGoals.slice(0, 3).map(g => (
            <div key={g.id} className="space-y-1">
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                  style={{ background: DRIVE_DOT[g.driveId] }} />
                <span className="text-xs text-gray-200 leading-snug line-clamp-2 flex-1">
                  {g.statement}
                </span>
              </div>
              <div className="ml-3.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${goalPct(g)}%`, background: DRIVE_DOT[g.driveId] }} />
              </div>
            </div>
          ))
        )}
        {tabGoals.length > 3 && (
          <p className="text-[10px] text-gray-600">+{tabGoals.length - 3} more</p>
        )}
      </div>
    </div>
  );
}

// ─── Goal edit modal ─────────────────────────────────────────────────────────

function GoalEditModal({
  goal, driveId, onSave, onCancel,
}: {
  goal?: GoalEntry;
  driveId: DriveType;
  onSave: (statement: string, description: string) => void;
  onCancel: () => void;
}) {
  const isEditing = !!goal;
  const cat = DRIVE_TO_CAT[driveId];

  const [mode, setMode] = useState<OBMode>("focused");

  // Pre-fill from existing goal when editing (parse back if possible, else put in first answer)
  const [answers, setAnswers] = useState<string[]>(() => {
    if (!goal) return [];
    // Restore: statement → q[0], description lines → rest
    const lines = (goal.description ?? "").split("\n").filter(Boolean);
    return [goal.statement ?? "", ...lines];
  });

  const firstRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { firstRef.current?.focus(); }, []);

  const qSet = mode === "focused" ? OB_QS_FOCUSED[cat] : OB_QS_ZOOMED[cat];
  const qs   = qSet.qs;

  function setAnswer(i: number, val: string) {
    setAnswers(prev => {
      const next = [...prev];
      next[i] = val;
      return next;
    });
  }

  function handleSave() {
    const statement = (answers[0] ?? "").trim();
    if (!statement) return;
    const description = qs
      .slice(1)
      .map((q, i) => {
        const a = (answers[i + 1] ?? "").trim();
        return a ? `${q.q}\n${a}` : "";
      })
      .filter(Boolean)
      .join("\n\n");
    onSave(statement, description);
  }

  const canSave = (answers[0] ?? "").trim().length > 0;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onKeyDown={e => { if (e.key === "Escape") onCancel(); }}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl
        flex flex-col max-h-[90vh]"
        style={{ animation: "panelIn 200ms ease both" }}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 flex-shrink-0
          border-b border-gray-800">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: DRIVE_DOT[driveId] }} />
              <span className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: DRIVE_DOT[driveId] }}>{DRIVE_LABEL[driveId]}</span>
            </div>
            <p className="text-base font-semibold text-white">
              {isEditing ? "Edit goal" : "Add goal"}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Focused / Zoomed toggle */}
            {!isEditing && (
              <div className="flex rounded-full border border-gray-700 bg-gray-800 p-0.5 text-xs">
                {(["focused", "zoomed"] as OBMode[]).map(m => (
                  <button key={m} type="button" onClick={() => { setMode(m); setAnswers([]); }}
                    className={`px-3 py-1 rounded-full transition-colors ${
                      mode === m
                        ? "bg-white text-gray-950 font-medium"
                        : "text-gray-400 hover:text-gray-200"
                    }`}>
                    {m === "focused" ? "Focused" : "Zoomed out"}
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={onCancel}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Prompt */}
        <p className="px-6 pt-4 pb-2 text-sm font-medium text-gray-400 flex-shrink-0">
          {qSet.prompt}
        </p>

        {/* Questions — scrollable */}
        <div className="px-6 pb-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          {qs.map((q, i) => (
            <div key={`${mode}-${i}`}>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                {i + 1}. {q.q}
              </label>
              <textarea
                ref={i === 0 ? firstRef : undefined}
                rows={2}
                value={answers[i] ?? ""}
                onChange={e => setAnswer(i, e.target.value)}
                placeholder={q.ph}
                className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm
                  text-white placeholder-gray-600 outline-none focus:border-indigo-500
                  transition-colors resize-none"
              />
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-800 flex-shrink-0">
          <button type="button" onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 bg-gray-800/50
              text-sm text-gray-400 hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={!canSave}
            className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500
              text-sm text-white font-medium transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed">
            {isEditing ? "Save changes" : "Add goal"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Goals expanded card (full width) ─────────────────────────────────────────

function GoalsExpanded({
  goals, drives, onClose, onAddGoal, onUpdateGoal, onRemoveGoal,
}: {
  goals: GoalEntry[]; drives: DriveType[];
  onClose: () => void;
  onAddGoal: (driveId: DriveType, statement: string, description: string) => string;
  onUpdateGoal: (id: string, goal: GoalEntry) => void;
  onRemoveGoal: (id: string) => void;
}) {
  const [tab, setTab] = useState<DriveType>(drives[0] ?? "learning");
  // modal state: null = closed, "new" = adding, GoalEntry = editing
  const [modal, setModal] = useState<"new" | GoalEntry | null>(null);
  const tabGoals = goals.filter(g => g.driveId === tab && g.statement.trim());

  return (
    <>
      {/* Goal edit modal (portal-style fixed overlay) */}
      {modal !== null && (
        <GoalEditModal
          goal={modal === "new" ? undefined : modal}
          driveId={tab}
          onCancel={() => setModal(null)}
          onSave={(statement, description) => {
            if (modal === "new") {
              onAddGoal(tab, statement, description);
            } else {
              onUpdateGoal(modal.id, { ...modal, statement, description, saved: true });
            }
            setModal(null);
          }}
        />
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
          {/* Drive tabs */}
          {drives.length > 1 && (
            <div className="flex gap-2">
              {drives.map(d => (
                <button key={d} type="button"
                  onClick={() => setTab(d)}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold border transition-all"
                  style={{
                    background: tab === d ? `${DRIVE_DOT[d]}20` : "transparent",
                    borderColor: tab === d ? `${DRIVE_DOT[d]}60` : "rgba(255,255,255,0.1)",
                    color: tab === d ? DRIVE_DOT[d] : "#6b7280",
                  }}>
                  {DRIVE_LABEL[d]}
                </button>
              ))}
            </div>
          )}

          {/* Goals list */}
          <div className="space-y-2">
            {tabGoals.length === 0 ? (
              <p className="text-sm text-gray-600">No goals for this drive yet.</p>
            ) : (
              tabGoals.map(g => {
                const pct = goalPct(g);
                return (
                  <div key={g.id} className="group flex items-center gap-3 px-3 py-2.5
                    rounded-xl bg-gray-800/40 border border-gray-700/30 hover:border-gray-600/50
                    transition-colors">
                    <span className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: DRIVE_DOT[g.driveId] }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate">{g.statement}</p>
                      {g.description && (
                        <p className="text-[10px] text-gray-500 truncate mt-0.5">{g.description}</p>
                      )}
                    </div>
                    {/* Progress */}
                    <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden flex-shrink-0">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: DRIVE_DOT[g.driveId] }} />
                    </div>
                    <span className="text-[10px] text-gray-500 w-7 text-right flex-shrink-0 tabular-nums">
                      {pct}%
                    </span>
                    {/* Actions (visible on hover) */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button type="button" onClick={() => setModal(g)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-400
                          hover:bg-indigo-500/10 transition-colors">
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button type="button" onClick={() => onRemoveGoal(g.id)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400
                          hover:bg-red-500/10 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModal("new")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-700
                text-xs text-gray-400 hover:border-gray-500 hover:text-gray-300 transition-colors">
              + Add goal
            </button>
            <button type="button"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium
                bg-violet-900/30 border border-violet-500/30 text-violet-300
                hover:bg-violet-900/50 transition-colors">
              <Sparkles className="w-3 h-3" /> AI Suggest
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
  weekSchedule, fundsProfile, environmentProfile, highlightGoalId,
  energy,
  setHealth, onUpdateGeneralSkills, onUpdateGoalSkills, onSuggestSkills,
  onWeekScheduleChange, onFundsChange, onEnvironmentChange,
}: {
  id: PartnerId; onClose: () => void;
  health: HealthProfile; goals: GoalEntry[];
  generalSkills: SkillEntry[]; skillsLoading: Record<string, boolean>;
  weekSchedule: WeekSchedule; fundsProfile: FundsProfile;
  environmentProfile: EnvironmentProfile; highlightGoalId: string | null;
  energy: ReturnType<typeof computeEnergy>;
  setHealth: (h: HealthProfile) => void;
  onUpdateGeneralSkills: (s: SkillEntry[]) => void;
  onUpdateGoalSkills: (goalId: string, s: SkillEntry[]) => void;
  onSuggestSkills: (goalId: string) => void;
  onWeekScheduleChange: (s: WeekSchedule) => void;
  onFundsChange: (f: FundsProfile) => void;
  onEnvironmentChange: (e: EnvironmentProfile) => void;
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
      <div className="flex items-center gap-2 px-5 py-3.5 border-b"
        style={{ borderColor: `${cfg.border}20` }}>
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0"
          style={{ background: cfg.iconBg }}>
          {cfg.icon}
        </div>
        <span className="text-sm font-semibold flex-1" style={{ color: cfg.iconText }}>
          {cfg.label === "Environ." ? "Environment" : cfg.label}
        </span>
        {id !== "time" && (
          <button type="button" onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="p-5">
        {id === "health"      && <HealthSection health={health} setHealth={setHealth} />}
        {id === "skills"      && (
          <SkillsSection
            generalSkills={generalSkills} goals={goals}
            skillsLoading={skillsLoading}
            onUpdateGeneralSkills={onUpdateGeneralSkills}
            onUpdateGoalSkills={onUpdateGoalSkills}
            onSuggestSkills={onSuggestSkills}
            highlightGoalId={highlightGoalId}
            schedule={weekSchedule}
            onScheduleChange={onWeekScheduleChange}
          />
        )}
        {id === "network"     && <CirclesPanel />}
        {id === "funds"       && <FundsSection funds={fundsProfile} goals={goals} onChange={onFundsChange} />}
        {id === "environment" && <EnvironmentSection env={environmentProfile} onChange={onEnvironmentChange} />}
        {id === "energy"      && (
          <EnergyPanel health={health} energy={energy} setHealth={setHealth} />
        )}
        {id === "time"        && (
          <TimeSection schedule={weekSchedule} goals={goals} onChange={onWeekScheduleChange} defaultOpen={true} />
        )}
      </div>
    </div>
  );
}

// ─── Main SelfCanvas ──────────────────────────────────────────────────────────

export interface SelfCanvasProps {
  health: HealthProfile;
  goals: GoalEntry[];
  drives: DriveType[];
  generalSkills: SkillEntry[];
  skillsLoading: Record<string, boolean>;
  weekSchedule: WeekSchedule;
  fundsProfile: FundsProfile;
  environmentProfile: EnvironmentProfile;
  highlightGoalId: string | null;
  setHealth: (h: HealthProfile) => void;
  onUpdateGeneralSkills: (skills: SkillEntry[]) => void;
  onUpdateGoalSkills: (goalId: string, skills: SkillEntry[]) => void;
  onSuggestSkills: (goalId: string) => void;
  onWeekScheduleChange: (s: WeekSchedule) => void;
  onFundsChange: (f: FundsProfile) => void;
  onEnvironmentChange: (e: EnvironmentProfile) => void;
  onAddGoal: (driveId: DriveType, statement: string, description: string) => string;
  onUpdateGoal: (id: string, goal: GoalEntry) => void;
  onRemoveGoal: (id: string) => void;
  onGoalAdded?: (goalId: string) => void;
}

export function SelfCanvas(props: SelfCanvasProps) {
  const {
    health, goals, drives, generalSkills, skillsLoading,
    weekSchedule, fundsProfile, environmentProfile, highlightGoalId,
    setHealth, onUpdateGeneralSkills, onUpdateGoalSkills, onSuggestSkills,
    onWeekScheduleChange, onFundsChange, onEnvironmentChange,
    onAddGoal, onUpdateGoal, onRemoveGoal, onGoalAdded,
  } = props;

  // Time is default — always a panel open
  const [activePartner, setActivePartner] = useState<PartnerId>("time");
  const [goalsExpanded, setGoalsExpanded] = useState(false);

  // Switch to Skills whenever a new goal is added (count increase)
  const prevGoalCountRef = useRef(goals.length);
  useEffect(() => {
    if (goals.length > prevGoalCountRef.current) {
      setGoalsExpanded(false);
      setActivePartner("skills");
    }
    prevGoalCountRef.current = goals.length;
  }, [goals.length]);

  // Also switch to Skills when highlightGoalId is set from outside
  // (covers first-goal case where canvas mounts after goals already exist)
  useEffect(() => {
    if (highlightGoalId) {
      setGoalsExpanded(false);
      setActivePartner("skills");
    }
  }, [highlightGoalId]);

  const energy = computeEnergy(health);

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
      case "environment":
        return environmentProfile.city
          ? { text: environmentProfile.city, type: "neutral" }
          : { text: "Not set up", type: "warning" };
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

  function handleClosePanel() {
    setActivePartner("time");
  }

  function handleGoalAdded(driveId: DriveType, statement: string, description: string): string {
    const goalId = onAddGoal(driveId, statement, description);
    onGoalAdded?.(goalId);
    return goalId;
  }

  return (
    <div className="space-y-2.5">
      <style>{`
        @keyframes panelIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* ── Row 1: Goals compact OR Goals expanded ── */}
      {goalsExpanded ? (
        <GoalsExpanded
          goals={goals}
          drives={drives}
          onClose={() => setGoalsExpanded(false)}
          onAddGoal={handleGoalAdded}
          onUpdateGoal={onUpdateGoal}
          onRemoveGoal={onRemoveGoal}
        />
      ) : (
        <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1.7fr 1fr", minHeight: "140px" }}>
          <TopBlock
            id="health"
            {...partnerStatus("health")}
            active={activePartner === "health"}
            onClick={() => setActivePartner("health")}
          />
          <GoalsCompact
            goals={goals}
            drives={drives}
            onExpand={() => setGoalsExpanded(true)}
          />
          <TopBlock
            id="skills"
            {...partnerStatus("skills")}
            active={activePartner === "skills"}
            onClick={() => setActivePartner("skills")}
          />
        </div>
      )}

      {/* ── Partners row ── */}
      {/* Collapsed: 5 middle partners · Expanded: all 7 (Health + Skills join) */}
      <div className={`grid gap-2 ${
        goalsExpanded ? "grid-cols-4 sm:grid-cols-7" : "grid-cols-3 sm:grid-cols-5"
      }`}>
        {(goalsExpanded ? ALL_PARTNERS : MIDDLE_PARTNERS).map(id => {
          const { text, type } = partnerStatus(id);
          return (
            <PartnerCard
              key={id} id={id}
              status={text} statusType={type}
              active={activePartner === id}
              onClick={() => setActivePartner(id)}
            />
          );
        })}
      </div>

      {/* ── Expanded panel (always open, Time by default) ── */}
      <ExpandedPanel
        key={activePartner}
        id={activePartner}
        onClose={handleClosePanel}
        health={health} goals={goals}
        generalSkills={generalSkills} skillsLoading={skillsLoading}
        weekSchedule={weekSchedule} fundsProfile={fundsProfile}
        environmentProfile={environmentProfile} highlightGoalId={highlightGoalId}
        energy={energy}
        setHealth={setHealth}
        onUpdateGeneralSkills={onUpdateGeneralSkills}
        onUpdateGoalSkills={onUpdateGoalSkills}
        onSuggestSkills={onSuggestSkills}
        onWeekScheduleChange={onWeekScheduleChange}
        onFundsChange={onFundsChange}
        onEnvironmentChange={onEnvironmentChange}
      />

      {/* ── Daily work (always visible, connected to Time) ── */}
      <DailyWork schedule={weekSchedule} />

    </div>
  );
}
