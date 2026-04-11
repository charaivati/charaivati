// app/(with-nav)/self/tabs/SelfTab.tsx — orchestrator
"use client";

import React, { useEffect, useRef, useState } from "react";
import { CollapsibleSection } from "@/components/self/shared";
import { OnboardingBanner, DrivePickerStateB } from "@/blocks/DriveBlock";
import { DriveColumn } from "@/blocks/GoalBlock";
import { SkillsSection } from "@/blocks/SkillBlock";
import { HealthSection } from "@/blocks/HealthBlock";
import { FundsSection } from "@/blocks/FundsBlock";
import { TimeSection } from "@/blocks/TimeBlock";
import { EnergySection } from "@/blocks/EnergyBlock";
import { EnvironmentSection } from "@/blocks/EnvironmentBlock";
import CirclesPanel from "@/components/CirclesPanel";
import { useSelfState, DRIVES, DRIVE_QUESTION, defaultGoal } from "@/hooks/useSelfState";
import type { DriveType, GoalEntry } from "@/types/self";

export default function SelfTab({ profile }: { profile?: any }) {
  const s = useSelfState(profile);

  // ── Delayed content reveal after drive picker collapses ──────────────────────
  const [showContent, setShowContent] = useState(s.drives.length > 0);

  // ── Onboarding open — set once profile is ready so we don't open on every refresh
  //    before async drives load. After that, user explicitly opens/closes it.
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const onboardingInitialized = useRef(false);
  useEffect(() => {
    if (!s.profileReady || onboardingInitialized.current) return;
    onboardingInitialized.current = true;
    setOnboardingOpen(s.drives.length === 0);
  }, [s.profileReady, s.drives.length]);

  // Buffer completions during the onboarding flow so we can apply them atomically
  const pendingGoalsRef = useRef<GoalEntry[]>([]);

  // ── Goal save → open skills + scroll + shimmer ────────────────────────────────
  const [skillsOpenTrigger, setSkillsOpenTrigger] = useState(0);
  const [highlightGoalId, setHighlightGoalId] = useState<string | null>(null);
  const skillsSectionRef = useRef<HTMLDivElement>(null);

  const [obMode, setObMode] = useState<"focused" | "zoomed">(() => {
    try { return (localStorage.getItem("charaivati_onboarding_mode") as "focused" | "zoomed") ?? "focused"; }
    catch { return "focused"; }
  });

  useEffect(() => {
    try { localStorage.setItem("charaivati_onboarding_mode", obMode); } catch {}
  }, [obMode]);

  function handleOnboardingComplete(driveId: DriveType, statement: string, description: string) {
    // Buffer the new goal — don't touch state yet, apply atomically in onDone
    // If already buffered for this drive (back+re-answer), replace it
    pendingGoalsRef.current = [
      ...pendingGoalsRef.current.filter(g => g.driveId !== driveId),
      { ...defaultGoal(driveId), statement, description, saved: !!statement },
    ];
  }

  function handleSaveGoal(id: string) {
    s.saveGoal(id);
    setSkillsOpenTrigger(t => t + 1);
    // Scroll first
    setTimeout(() => {
      const el = skillsSectionRef.current;
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 116;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }
    }, 700);
    // Start highlight after scroll lands (~700ms start + ~700ms scroll)
    setTimeout(() => setHighlightGoalId(id), 1400);
    setTimeout(() => setHighlightGoalId(null), 1400 + 2900);
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

      {/* Drive picker — slow fade transition between states */}
      <div style={{ opacity: s.profileReady ? 1 : 0, transition: "opacity 600ms ease" }}>
        {onboardingOpen ? (
          <OnboardingBanner
            isGuest={s.isGuest}
            saveState={s.saveState}
            onComplete={handleOnboardingComplete}
            onDone={(finalDrives) => {
              // Keep ALL existing goals (including for deselected drives — hidden, not deleted).
              // Only replace empty/placeholder goals for drives being newly answered.
              const existingWithStatements = s.goals.filter(g => g.statement.trim() !== "");
              const existingEmpty = s.goals.filter(g => g.statement.trim() === "");
              // Add buffered goals for drives that don't already have a real saved goal
              const newGoals = pendingGoalsRef.current.filter(
                g => !existingWithStatements.some(k => k.driveId === g.driveId)
              );
              // Drop empty placeholders for drives that now have a real goal (from buffer)
              const filteredEmpty = existingEmpty.filter(
                g => !newGoals.some(n => n.driveId === g.driveId)
              );
              const firstNewId = newGoals[0]?.id ?? null;
              pendingGoalsRef.current = [];
              s.applyOnboardingResult(finalDrives, [...existingWithStatements, ...filteredEmpty, ...newGoals]);
              setOnboardingOpen(false);
              // After content reveals (700ms showContent delay + 700ms animation), open skills + highlight
              if (firstNewId) {
                setTimeout(() => {
                  setSkillsOpenTrigger(t => t + 1);
                  const el = skillsSectionRef.current;
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

      {/* Content sections — hidden while banner is open so drive changes don't show mid-flow */}
      {showContent && !onboardingOpen && (
        <div style={{ animation: "fadeSlideUp 600ms ease both" }}>
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

          <div className="space-y-5">

            {/* ── Goals ── */}
            <CollapsibleSection
              title="Your Goals"
              defaultOpen={s.filledGoals === 0}
              collapsedPreview={
                s.filledGoals > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {s.visibleGoals.filter(g => g.statement).slice(0, 3).map(g => (
                      <span key={g.id} className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full truncate max-w-[160px]">
                        {g.statement}
                      </span>
                    ))}
                    {s.visibleGoals.filter(g => g.statement).length > 3 && (
                      <span className="text-xs text-gray-600">+{s.visibleGoals.filter(g => g.statement).length - 3} more</span>
                    )}
                  </div>
                ) : undefined
              }
            >
              <div className={`gap-4 pt-1 ${s.drives.length === 2 ? "grid grid-cols-1 sm:grid-cols-2" : "flex flex-col"}`}>
                {s.drives.map(driveId => {
                  const driveInfo  = DRIVES.find(d => d.id === driveId)!;
                  const driveGoals = s.goals.filter(g => g.driveId === driveId);
                  return (
                    <div key={driveId}>
                      {/* Per-drive question header when 2 drives selected */}
                      {s.drives.length === 2 && (
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                          {DRIVE_QUESTION[driveId] ?? driveInfo.label}
                        </p>
                      )}
                      <DriveColumn
                        drive={driveInfo}
                        goals={driveGoals}
                        pages={s.pages}
                        onUpdateGoal={s.updateGoal}
                        onSaveGoal={handleSaveGoal}
                        onEditGoal={s.editGoal}
                        onRemoveGoal={s.removeGoal}
                        onAddGoal={s.addGoal}
                        planLoading={s.planLoading}
                        onGeneratePlan={s.generateGoalPlan}
                        onSavePlan={s.saveGoalPlan}
                        onRegenerate={s.generateGoalPlan}
                      />
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>

            {/* ── Skills & Health — single box, shown after goals are set ── */}
            {s.filledGoals > 0 && (
              <div ref={skillsSectionRef} style={{ animation: "fadeSlideUp 500ms ease both" }}>
                <CollapsibleSection
                  title="Skills, Health & Network"
                  subtitle="Your foundation across all goals"
                  defaultOpen={false}
                  triggerOpen={skillsOpenTrigger}
                >
                  <div className="space-y-6 pt-1">

                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        Skills · general &amp; goal-specific
                      </p>
                      <SkillsSection
                        generalSkills={s.generalSkills}
                        goals={s.visibleGoals}
                        skillsLoading={s.skillsLoading}
                        onUpdateGeneralSkills={s.handleGeneralSkillsChange}
                        onUpdateGoalSkills={s.handleGoalSkillsChange}
                        onSuggestSkills={s.suggestGoalSkills}
                        highlightGoalId={highlightGoalId}
                      />
                    </div>

                    <div className="h-px bg-gray-800" />

                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        Time · your ideal week
                      </p>
                      <TimeSection schedule={s.weekSchedule} goals={s.visibleGoals} onChange={s.handleWeekScheduleChange} />
                    </div>

                    <div className="h-px bg-gray-800" />

                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        Health · applies to all goals
                      </p>
                      <HealthSection health={s.health} setHealth={s.handleHealthChange} />
                    </div>

                    <div className="h-px bg-gray-800" />

                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        Energy · derived from health
                      </p>
                      <EnergySection health={s.health} />
                    </div>

                    <div className="h-px bg-gray-800" />

                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        Network · people &amp; organizations
                      </p>
                      <CollapsibleSection title="Network" subtitle="Your people and organizations">
                        <CirclesPanel />
                      </CollapsibleSection>
                    </div>

                    <div className="h-px bg-gray-800" />

                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        Funds · resources for your projects
                      </p>
                      <FundsSection funds={s.fundsProfile} goals={s.visibleGoals} onChange={s.handleFundsChange} />
                    </div>

                    <div className="h-px bg-gray-800" />

                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        Environment · your context and constraints
                      </p>
                      <EnvironmentSection env={s.environmentProfile} onChange={s.handleEnvironmentChange} />
                    </div>

                  </div>
                </CollapsibleSection>
              </div>
            )}



          </div>
        </div>
      )}
    </div>
  );
}
