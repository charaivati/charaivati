// app/api/ai/types.ts
// Shared types across all AI routes

export type SuggestionType = "skill" | "health" | "network" | "execution";
export type Priority = "low" | "medium" | "high";

export type GoalEntry = {
  id?: string;
  title?: string;
  description?: string;
  skill?: string;
  drive?: string;
};

export type HealthProfile = {
  note?: string;
};

export type Phase = {
  id: string;
  name: string;
  duration: string;
  actions: string[];
};

export type Suggestion = {
  id: string;
  text: string;
  type: SuggestionType;
  priority: Priority;
};

export type DayPlan = {
  day: string;
  tasks: string[];
};