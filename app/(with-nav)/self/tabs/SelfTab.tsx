// app/(with-nav)/self/tabs/SelfTab.tsx — orchestrator
"use client";

import React, { useEffect, useRef, useState } from "react";
import { OnboardingBanner, DrivePickerStateB } from "@/blocks/DriveBlock";
import { SelfCanvas } from "@/components/self/SelfCanvas";
import { useSelfState, defaultGoal } from "@/hooks/useSelfState";
import { useSelfSkills } from "@/lib/SelfSkillsContext";
import type { DriveType, GoalEntry } from "@/types/self";

export default function SelfTab({ profile }: { profile?: any }) {
  const s = useSelfState(profile);
  const { setSkillsSnapshot } = useSelfSkills();

  // Keep shared context in sync with live state
  useEffect(() => {
    setSkillsSnapshot(s.goals, s.generalSkills);
  }, [s.goals, s.generalSkills, setSkillsSnapshot]);

  // ── Delayed content reveal after drive picker collapses ──────────────────────
  const [showContent, setShowContent] = useState(s.drives.length > 0);

  // ── Onboarding open ───────────────────────────────────────────────────────────
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const onboardingInitialized = useRef(false);
  useEffect(() => {
    if (!s.profileReady || onboardingInitialized.current) return;
    onboardingInitialized.current = true;
    setOnboardingOpen(s.drives.length === 0);
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

  function handleOnboardingComplete(driveId: DriveType, statement: string, description: string) {
    pendingGoalsRef.current = [
      ...pendingGoalsRef.current.filter(g => g.driveId !== driveId),
      { ...defaultGoal(driveId), statement, description, saved: !!statement },
    ];
  }

  function handleAddGoal(driveId: DriveType, statement: string, description: string): string {
    const goal = { ...defaultGoal(driveId), statement, description, saved: true };
    s.addGoalDirect(goal);
    return goal.id;
  }

  function handleGoalAdded(goalId: string) {
    setTimeout(() => setHighlightGoalId(goalId), 400);
    setTimeout(() => setHighlightGoalId(null), 400 + 2900);
  }

  useEffect(() => {
    if (s.drives.length > 0) {
      const t = setTimeout(() => setShowContent(true), 700);
      return () => clearTimeout(t);
    } else {
      setShowContent(false);
    }
  }, [s.drives.length]);

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
              s.applyOnboardingResult(finalDrives, [...existingWithStatements, ...filteredEmpty, ...newGoals]);
              setOnboardingOpen(false);
              if (firstNewId) {
                setTimeout(() => {
                  const el = canvasRef.current;
                  if (el) {
                    const top = el.getBoundingClientRect().top + window.scrollY - 116;
                    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
                  }
                }, 1400);
                setTimeout(() => setHighlightGoalId(firstNewId), 1800);
                setTimeout(() => setHighlightGoalId(null), 1800 + 2900);
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

      {/* ── Content — revealed after drive is picked ── */}
      {showContent && !onboardingOpen && (
        <div style={{ animation: "fadeSlideUp 600ms ease both" }}>
          <div className="space-y-5">

            {/* ── Visual canvas ── */}
            {s.filledGoals > 0 && (
              <div ref={canvasRef} style={{ animation: "fadeSlideUp 500ms ease both" }}>
                <SelfCanvas
                  health={s.health}
                  goals={s.visibleGoals}
                  drives={s.drives}
                  generalSkills={s.generalSkills}
                  skillsLoading={s.skillsLoading}
                  weekSchedule={s.weekSchedule}
                  fundsProfile={s.fundsProfile}
                  environmentProfile={s.environmentProfile}
                  highlightGoalId={highlightGoalId}
                  setHealth={s.handleHealthChange}
                  onUpdateGeneralSkills={s.handleGeneralSkillsChange}
                  onUpdateGoalSkills={s.handleGoalSkillsChange}
                  onSuggestSkills={s.suggestGoalSkills}
                  onWeekScheduleChange={s.handleWeekScheduleChange}
                  onFundsChange={s.handleFundsChange}
                  onEnvironmentChange={s.handleEnvironmentChange}
                  onAddGoal={handleAddGoal}
                  onUpdateGoal={s.updateGoal}
                  onRemoveGoal={s.removeGoal}
                  onGoalAdded={handleGoalAdded}
                />
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
