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
    // Scroll to canvas after it mounts (showContent fires at 700ms)
    setTimeout(() => {
      const el = canvasRef.current;
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 116;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }
    }, 1400);
    setTimeout(() => setHighlightGeneral(true), 1800);
    setTimeout(() => setHighlightGeneral(false), 1800 + 2900);
  }

  useEffect(() => {
    if (s.drives.length > 0 || skipped) {
      const t = setTimeout(() => setShowContent(true), 700);
      return () => clearTimeout(t);
    } else {
      setShowContent(false);
    }
  }, [s.drives.length, skipped]);

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
              s.applyOnboardingResult(finalDrives, [...existingWithStatements, ...filteredEmpty, ...newGoals]);
              setSkipped(false);
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

          </div>
        </div>
      )}
    </div>
  );
}
