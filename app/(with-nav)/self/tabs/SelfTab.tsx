// app/(with-nav)/self/tabs/SelfTab.tsx — orchestrator
"use client";

import React, { useEffect, useRef, useState } from "react";
import { CollapsibleSection } from "@/components/self/shared";
import { DrivePickerStateA, DrivePickerStateB } from "@/blocks/DriveBlock";
import { DriveColumn } from "@/blocks/GoalBlock";
import { SkillsSection } from "@/blocks/SkillBlock";
import { HealthSection } from "@/blocks/HealthBlock";
import CirclesPanel from "@/components/CirclesPanel";
import { useSelfState, DRIVES, DRIVE_QUESTION } from "@/hooks/useSelfState";

export default function SelfTab({ profile }: { profile?: any }) {
  const s = useSelfState(profile);

  // ── Delayed content reveal after drive picker collapses ──────────────────────
  const [showContent, setShowContent] = useState(s.drives.length > 0);

  // ── Goal save → open skills + scroll + shimmer ────────────────────────────────
  const [skillsOpenTrigger, setSkillsOpenTrigger] = useState(0);
  const [highlightGoalId, setHighlightGoalId] = useState<string | null>(null);
  const skillsSectionRef = useRef<HTMLDivElement>(null);

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
        {s.drives.length === 0 ? (
          <DrivePickerStateA
            typedLine1={s.typedLine1} typedLine2={s.typedLine2}
            line2Started={s.line2Started} typingDone={s.typingDone}
            drivesVisible={s.drivesVisible} drives={s.drives}
            isGuest={s.isGuest} saveState={s.saveState}
            onToggle={s.toggleDrive}
          />
        ) : (
          <div style={{ animation: "fadeSlideDown 700ms ease both" }}>
            <DrivePickerStateB
              drives={s.drives} isGuest={s.isGuest} saveState={s.saveState}
              pickerOpen={s.drivePickerOpen}
              onToggle={s.toggleDrive}
              onOpenPicker={() => s.setDrivePickerOpen(v => !v)}
            />
          </div>
        )}
      </div>

      {/* Content sections — slide in after picker collapses */}
      {showContent && (
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
              title={s.drives.length === 2 ? "Your Goals" : (DRIVE_QUESTION[s.drives[0]] ?? "What do you want to do?")}
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
                        Health · applies to all goals
                      </p>
                      <HealthSection health={s.health} setHealth={s.handleHealthChange} />
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
