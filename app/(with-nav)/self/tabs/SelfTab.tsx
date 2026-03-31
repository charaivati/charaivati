// app/(with-nav)/self/tabs/SelfTab.tsx — orchestrator
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { SectionCard, CollapsibleSection } from "@/components/self/shared";
import { DrivePickerStateA, DrivePickerStateB } from "@/blocks/DriveBlock";
import { DriveColumn } from "@/blocks/GoalBlock";
import { SkillsSection } from "@/blocks/SkillBlock";
import { HealthSection } from "@/blocks/HealthBlock";
import CirclesPanel from "@/components/CirclesPanel";
import { useSelfState, DRIVES, DRIVE_QUESTION } from "@/hooks/useSelfState";

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-3 px-1">
      <div className="h-px flex-1 bg-gray-800" />
      <span className="text-xs text-gray-600 uppercase tracking-wider">{label}</span>
      <div className="h-px flex-1 bg-gray-800" />
    </div>
  );
}

export default function SelfTab({ profile }: { profile?: any }) {
  const router = useRouter();
  const s      = useSelfState(profile);

  return (
    <div className="text-white space-y-5">

      {/* Drive picker */}
      <div style={{ opacity: s.profileReady ? 1 : 0, transition: "opacity 400ms ease" }}>
        {s.drives.length === 0 ? (
          <DrivePickerStateA
            typedLine1={s.typedLine1} typedLine2={s.typedLine2}
            line2Started={s.line2Started} typingDone={s.typingDone}
            drivesVisible={s.drivesVisible} drives={s.drives}
            isGuest={s.isGuest} saveState={s.saveState}
            onToggle={s.toggleDrive}
          />
        ) : (
          <DrivePickerStateB
            drives={s.drives} isGuest={s.isGuest} saveState={s.saveState}
            pickerOpen={s.drivePickerOpen}
            onToggle={s.toggleDrive}
            onOpenPicker={() => s.setDrivePickerOpen(v => !v)}
          />
        )}
      </div>

      {/* Content sections */}
      {s.drives.length > 0 && (
        <>
          {/* Goals */}
          <CollapsibleSection title={DRIVE_QUESTION[s.drives[0]] ?? "What do you want to do?"}>
            <div className={`gap-4 pt-1 ${s.drives.length === 2 ? "grid grid-cols-1 sm:grid-cols-2" : "flex flex-col"}`}>
              {s.drives.map(driveId => {
                const driveInfo  = DRIVES.find(d => d.id === driveId)!;
                const driveGoals = s.goals.filter(g => g.driveId === driveId);
                return (
                  <DriveColumn
                    key={driveId}
                    drive={driveInfo}
                    goals={driveGoals}
                    pages={s.pages}
                    onUpdateGoal={s.updateGoal}
                    onSaveGoal={s.saveGoal}
                    onEditGoal={s.editGoal}
                    onRemoveGoal={s.removeGoal}
                    onAddGoal={s.addGoal}
                    planLoading={s.planLoading}
                    onGeneratePlan={s.generateGoalPlan}
                    onSavePlan={s.saveGoalPlan}
                    onRegenerate={s.generateGoalPlan}
                  />
                );
              })}
            </div>
          </CollapsibleSection>

          {/* Skills */}
          <div>
            <Divider label="Skills · general &amp; goal-specific" />
            <SkillsSection
              generalSkills={s.generalSkills}
              goals={s.visibleGoals}
              skillsLoading={s.skillsLoading}
              onUpdateGeneralSkills={s.handleGeneralSkillsChange}
              onUpdateGoalSkills={s.handleGoalSkillsChange}
              onSuggestSkills={s.suggestGoalSkills}
            />
          </div>

          {/* Health */}
          <div>
            <Divider label="Your health · applies to all goals" />
            <HealthSection health={s.health} setHealth={s.handleHealthChange} />
          </div>

          {/* Friend Circles */}
          <div>
            <Divider label="Friend circles · people in your life" />
            <CollapsibleSection title="Friend Circles" subtitle="Organise the people in your world">
              <div className="pt-1">
                <CirclesPanel />
              </div>
            </CollapsibleSection>
          </div>

          {/* Summary CTA */}
          {s.filledGoals > 0 && s.allVisibleSaved && (
            <SectionCard className="px-5 py-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-sm font-semibold text-white">Foundation set</p>
                  <p className="text-xs text-gray-500 mt-0.5 flex gap-3 flex-wrap">
                    <span>{s.filledGoals} goal{s.filledGoals > 1 ? "s" : ""}</span>
                    <span>{s.totalSkills} skill{s.totalSkills !== 1 ? "s" : ""}</span>
                    {s.monetizable > 0 && <span className="text-indigo-400">{s.monetizable} monetizable</span>}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => router.push("/self?tab=learn")}
                    className="px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors">
                    Go to Learn →
                  </button>
                  <button onClick={() => router.push("/self?tab=earn")}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-medium transition-colors">
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
