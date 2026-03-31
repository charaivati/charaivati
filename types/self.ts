// types/self.ts — shared types for the Self tab and its blocks

export type DriveType = "learning" | "helping" | "building" | "doing";

export type SkillEntry = {
  id: string;
  name: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  monetize: boolean;
};

export type Phase = {
  id: string;
  name: string;
  duration: string;
  actions: string[];
};

export type DayPlan = {
  day: string;
  tasks: string[];
};

export type Suggestion = {
  id: string;
  text: string;
  type: "skill" | "health" | "network" | "execution";
  priority: "low" | "medium" | "high";
};

export type AIRoadmap = {
  phases: Phase[];
  suggestions: Suggestion[];
  weekPlans?: Record<string, DayPlan[]>;
  fallback?: boolean;
};

export type GoalEntry = {
  id: string;
  driveId: DriveType;
  statement: string;
  description: string;
  skills: SkillEntry[];
  linkedBusinessIds: string[];
  saved: boolean;
  plan?: AIRoadmap | null;
};

export type MealCard = {
  id: string;
  meal: "Breakfast" | "Lunch" | "Snack" | "Dinner";
  name: string;
  ingredients: string[];
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  prep_minutes: number;
};

export type AIHealthPlan = {
  meals: MealCard[];
  health_targets: {
    target_bmi: number;
    target_body_fat_pct: number | null;
    daily_calories_kcal: number;
    notes: string;
    insight?: string;
  };
  mealAlternatives?: Record<string, MealCard[]>;
  fallback?: boolean;
};

export type HealthProfile = {
  food: string;
  exercise: string;
  sessionsPerWeek: number;
  heightCm: string;
  weightKg: string;
  age: string;
  bodyFatPct?: string;
  waistCm?: string;
  hipCm?: string;
  bicepCm?: string;
  chestCm?: string;
  medicalConditions?: string;
  availableFoods?: string[];
  healthPlan?: AIHealthPlan | null;
  healthPlanGeneratedAt?: string | null;
};

export type PageItem = {
  id: string;
  title: string;
  description?: string | null;
};

export type SaveState = "idle" | "saving" | "saved" | "error";
