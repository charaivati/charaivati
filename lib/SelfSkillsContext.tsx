"use client";
// lib/SelfSkillsContext.tsx — shares live skill/goal state from SelfTab with sibling tabs

import React, { createContext, useContext, useState, useCallback } from "react";
import type { GoalEntry, SkillEntry } from "@/types/self";

type SelfSkillsValue = {
  goals: GoalEntry[];
  generalSkills: SkillEntry[];
  setSkillsSnapshot: (goals: GoalEntry[], generalSkills: SkillEntry[]) => void;
};

const SelfSkillsContext = createContext<SelfSkillsValue>({
  goals: [],
  generalSkills: [],
  setSkillsSnapshot: () => {},
});

export function SelfSkillsProvider({ children }: { children: React.ReactNode }) {
  const [goals, setGoals] = useState<GoalEntry[]>([]);
  const [generalSkills, setGeneralSkills] = useState<SkillEntry[]>([]);

  const setSkillsSnapshot = useCallback((g: GoalEntry[], gs: SkillEntry[]) => {
    setGoals(g);
    setGeneralSkills(gs);
  }, []);

  return (
    <SelfSkillsContext.Provider value={{ goals, generalSkills, setSkillsSnapshot }}>
      {children}
    </SelfSkillsContext.Provider>
  );
}

export function useSelfSkills() {
  return useContext(SelfSkillsContext);
}
