// app/(with-nav)/self/tabs/SelfTab.tsx — orchestrator
"use client";

import React, { useEffect, useRef, useState } from "react";
import { OnboardingBanner, DrivePickerStateB } from "@/blocks/DriveBlock";
import { SelfCanvas } from "@/components/self/SelfCanvas";
import { useSelfState, defaultGoal } from "@/hooks/useSelfState";
import { useSelfSkills } from "@/lib/SelfSkillsContext";
import type { DriveType, GoalEntry } from "@/types/self";
import TodoList from "@/components/self/TodoList";

const DRIVE_TO_ARCHETYPE: Record<DriveType, string> = {
  learning: "LEARN", building: "BUILD", doing: "EXECUTE", helping: "CONNECT",
};

async function saveGoalsToAiTable(
  goals: GoalEntry[],
  mode: "focused" | "zoomed"
) {
  const apiMode = mode === "zoomed" ? "ZOOMED_OUT" : "FOCUSED";
  await Promise.allSettled(
    goals
      .filter(g => g.statement.trim())
      .map(g =>
        fetch("/api/self/goals", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            archetype: DRIVE_TO_ARCHETYPE[g.driveId] ?? "LEARN",
            mode: apiMode,
            title: g.statement.trim(),
            whyNow: g.description?.trim() || null,
            riskFlags: [],
          }),
        }).catch(() => {})
      )
  );
  // Let SelfCanvas know to refresh goal count
  try { window.dispatchEvent(new CustomEvent("charaivati:goalCreated")); } catch {}
}

function SelfTabSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 14,
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.12)", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ width: "55%", height: 13, borderRadius: 4, background: "rgba(255,255,255,0.15)", marginBottom: 7 }} />
            <div style={{ width: "35%", height: 10, borderRadius: 4, background: "rgba(255,255,255,0.10)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SelfTab({ profile }: { profile?: any }) {
  const s = useSelfState(profile);
  const { setSkillsSnapshot } = useSelfSkills();

  // Keep shared context in sync with live state
  useEffect(() => {
    setSkillsSnapshot(s.goals, s.generalSkills);
  }, [s.goals, s.generalSkills, setSkillsSnapshot]);

  // ── Delayed content reveal after drive picker collapses ──────────────────────
  const OB_SKIP_KEY = "charaivati_ob_skipped";
  const [skipped, setSkipped] = useState(() => {
    try { return localStorage.getItem("charaivati_ob_skipped") === "1"; } catch { return false; }
  });
  const [showContent, setShowContent] = useState(() => {
    if (s.drives.length > 0) return true;
    try { return localStorage.getItem("charaivati_ob_skipped") === "1"; } catch { return false; }
  });
  const [highlightGeneral, setHighlightGeneral] = useState(false);

  // ── Onboarding open ───────────────────────────────────────────────────────────
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const onboardingInitialized = useRef(false);
  useEffect(() => {
    if (!s.profileReady || onboardingInitialized.current) return;
    onboardingInitialized.current = true;
    if (s.drives.length === 0) {
      const wasSkipped = (() => { try { return localStorage.getItem(OB_SKIP_KEY) === "1"; } catch { return false; } })();
      if (wasSkipped) {
        setSkipped(true); // stay in skipped state, don't open onboarding
      } else {
        setOnboardingOpen(true);
      }
    }
  }, [s.profileReady, s.drives.length]);

  // Buffer completions during the onboarding flow
  const pendingGoalsRef = useRef<GoalEntry[]>([]);

  // ── Highlight goal in skills canvas ──────────────────────────────────────────
  const [highlightGoalId, setHighlightGoalId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const [obMode, setObMode] = useState<"focused" | "zoomed">(() => {
    try { return (localStorage.getItem("charaivati_onboarding_mode") as "focused" | "zoomed") ?? "focused"; }
    catch { return "focused"; }
  });

  useEffect(() => {
    try { localStorage.setItem("charaivati_onboarding_mode", obMode); } catch {}
  }, [obMode]);

  function handleOnboardingComplete(driveId: DriveType, statement: string, description: string, hobbyFlag?: boolean) {
    pendingGoalsRef.current = [
      ...pendingGoalsRef.current.filter(g => g.driveId !== driveId),
      { ...defaultGoal(driveId), statement, description, saved: !!statement },
    ];
    if (hobbyFlag && driveId === "doing" && statement) {
      const existing = s.health.joy?.hobbies?.types ?? [];
      if (!existing.includes(statement)) {
        const freq = existing.length > 0
          ? (s.health.joy?.hobbies?.frequency ?? "weekly")
          : "weekly";
        s.handleHealthChange({
          ...s.health,
          joy: {
            ...(s.health.joy ?? { sports: { types: [], frequency: "weekly" as const }, social: { types: [], frequency: "weekly" as const }, rest: { types: [], frequency: "weekly" as const } }),
            hobbies: { types: [...existing, statement], frequency: freq },
          },
        });
      }
    }
  }

  function handleSkip() {
    pendingGoalsRef.current = [];
    s.applyOnboardingResult([], []);
    try { localStorage.setItem(OB_SKIP_KEY, "1"); } catch {}
    setSkipped(true);
    setOnboardingOpen(false);
    // Scroll to canvas after it mounts (showContent now fires immediately)
    setTimeout(() => {
      const el = canvasRef.current;
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 116;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }
    }, 100);
    setTimeout(() => setHighlightGeneral(true), 500);
    setTimeout(() => setHighlightGeneral(false), 500 + 2900);
  }

  useEffect(() => {
    setShowContent(s.drives.length > 0 || skipped);
  }, [s.drives.length, skipped]);

  // EXECPLAN-7: when a drive proposal is accepted in chat/Listen and the user
  // has no goals yet, nudge them once toward goal creation — closes the
  // clueless → drive → goal → plan loop.
  const [driveNudge, setDriveNudge] = useState(false);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const hasDrives = Array.isArray(detail?.drives) && detail.drives.length > 0;
      const hasGoals = Array.isArray(detail?.goals) && detail.goals.some((g: any) => g?.statement?.trim());
      if (hasDrives && !hasGoals) setDriveNudge(true);
    };
    window.addEventListener("charaivati:profile-updated", handler);
    return () => window.removeEventListener("charaivati:profile-updated", handler);
  }, []);

  return (
    <div className="text-white space-y-5">
      <style>{`
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Drive picker / identity banner ── */}
      <div style={{ opacity: s.profileReady ? 1 : 0, transition: "opacity 600ms ease" }}>
        {onboardingOpen ? (
          <OnboardingBanner
            isGuest={s.isGuest}
            saveState={s.saveState}
            onComplete={handleOnboardingComplete}
            onSkip={handleSkip}
            onDone={(finalDrives) => {
              const existingWithStatements = s.goals.filter(g => g.statement.trim() !== "");
              const existingEmpty          = s.goals.filter(g => g.statement.trim() === "");
              const newGoals = pendingGoalsRef.current.filter(
                g => !existingWithStatements.some(k => k.driveId === g.driveId)
              );
              const filteredEmpty = existingEmpty.filter(
                g => !newGoals.some(n => n.driveId === g.driveId)
              );
              const firstNewId = newGoals[0]?.id ?? null;
              pendingGoalsRef.current = [];
              try { localStorage.removeItem(OB_SKIP_KEY); } catch {}
              const mergedGoals = [...existingWithStatements, ...filteredEmpty, ...newGoals];
              s.applyOnboardingResult(finalDrives, mergedGoals);
              setSkipped(false);
              setOnboardingOpen(false);
              // Mirror new goals into the aiGoal table so SelfCanvas can display them
              // and execution plan generation works immediately
              if (!s.isGuest && newGoals.length > 0) {
                saveGoalsToAiTable(newGoals, obMode).catch(() => {});
              }
              if (firstNewId) {
                setTimeout(() => {
                  const el = canvasRef.current;
                  if (el) {
                    const top = el.getBoundingClientRect().top + window.scrollY - 116;
                    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
                  }
                }, 100);
                setTimeout(() => setHighlightGoalId(firstNewId), 500);
                setTimeout(() => setHighlightGoalId(null), 500 + 2900);
              }
            }}
            onCancel={s.drives.length > 0 ? () => { pendingGoalsRef.current = []; setOnboardingOpen(false); } : undefined}
            initialDrives={s.drives.length > 0 ? s.drives : undefined}
            drivesWithGoals={s.goals.filter(g => g.statement.trim() !== "").map(g => g.driveId)}
          />
        ) : (
          <div style={{ animation: "fadeSlideDown 700ms ease both" }}>
            <DrivePickerStateB
              drives={s.drives} isGuest={s.isGuest} saveState={s.saveState}
              pickerOpen={false}
              onToggle={s.toggleDrive}
              onOpenPicker={() => { pendingGoalsRef.current = []; setOnboardingOpen(true); }}
              mode={obMode}
              onModeChange={setObMode}
            />
          </div>
        )}
      </div>

      {/* ── Drive-set nudge (EXECPLAN-7) ── */}
      {driveNudge && !onboardingOpen && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-indigo-500/30"
          style={{ background: "rgba(49,46,129,0.25)", animation: "fadeSlideDown 400ms ease both" }}>
          <span className="text-sm text-indigo-200">Drive set ✓ — shape your first goal?</span>
          <div className="flex items-center gap-2">
            <button type="button"
              onClick={() => {
                setDriveNudge(false);
                try { window.dispatchEvent(new Event("charaivati:open-goal-creation")); } catch {}
                setTimeout(() => canvasRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
              }}
              className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition-colors">
              Create a goal →
            </button>
            <button type="button" onClick={() => setDriveNudge(false)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors">✕</button>
          </div>
        </div>
      )}

      {/* ── Canvas skeleton — fills blank space while profile loads ── */}
      {!s.profileReady && !onboardingOpen && <SelfTabSkeleton />}

      {/* ── Content — shown immediately when drives are available ── */}
      {showContent && !onboardingOpen && (
        <div style={{ animation: "fadeSlideUp 600ms ease both" }}>
          <div className="space-y-5">

            {/* ── Landing toggle (EXECPLAN-5) — same flow, chakra skin ── */}
            <div className="flex justify-end -mb-3">
              <a
                href="/chakra/landing"
                onClick={() => { try { localStorage.setItem("charaivati.landing", "chakra"); } catch {} }}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                🪷 Chakra view →
              </a>
            </div>

            {/* ── Visual canvas ── */}
            {(s.filledGoals > 0 || skipped) && (
              <div ref={canvasRef} style={{ animation: "fadeSlideUp 500ms ease both" }}>
                <SelfCanvas
                  health={s.health}
                  goals={s.visibleGoals}
                  drives={s.drives}
                  pages={s.pages}
                  generalSkills={s.generalSkills}
                  skillsLoading={s.skillsLoading}
                  weekSchedule={s.weekSchedule}
                  fundsProfile={s.fundsProfile}
                  environmentProfile={s.environmentProfile}
                  highlightGoalId={highlightGoalId}
                  highlightGeneral={highlightGeneral}
                  setHealth={s.handleHealthChange}
                  onUpdateGeneralSkills={s.handleGeneralSkillsChange}
                  onUpdateGoalSkills={s.handleGoalSkillsChange}
                  onSuggestSkills={s.suggestGoalSkills}
                  onWeekScheduleChange={s.handleWeekScheduleChange}
                  onFundsChange={s.handleFundsChange}
                  onEnvironmentChange={s.handleEnvironmentChange}
                />
              </div>
            )}

            {/* ── Todo list — shows all tasks including business validation tasks ── */}
            {!s.isGuest && (
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 16,
                  padding: "16px 16px 12px",
                }}
              >
                <h3 style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Tasks
                </h3>
                <TodoList />
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
