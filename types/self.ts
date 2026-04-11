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
  sleepQuality?: "bad" | "moderate" | "good";
  mood?: "😞" | "😐" | "🙂" | "😄";
  stressLevel?: "Low" | "Mid" | "High";
  bodyFatPct?: string;
  waistCm?: string;
  hipCm?: string;
  bicepCm?: string;
  chestCm?: string;
  medicalConditions?: string;
  focusClarity?: "Low" | "Mid" | "High";
  socialInteraction?: "Low" | "Mid" | "High";
  energyLevel?: "Low" | "Mid" | "High";
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

// ─── Funds ────────────────────────────────────────────────────────────────────
export type FundType = 'savings' | 'income' | 'investment' | 'grant' | 'loan';
export type FundSource = { id: string; name: string; type: FundType; amount: number; currency: string; linkedGoalIds: string[]; notes: string; };
export type FundsProfile = { sources: FundSource[]; monthlyBurn: number; targetRunway: number; fundsPlan: AIFundsPlan | null; };
export type AIFundsPlan = { savingsPlan: string; pitchGuidance: string; budgetAllocation: { goalId: string; goalName: string; amount: number; rationale: string }[]; fallback?: boolean; };

// ─── Time ─────────────────────────────────────────────────────────────────────
export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type TimeSlot = { id: string; day: DayKey; startHour: number; endHour: number; goalId: string; activity: string; isFlexible: boolean; };
export type WeekSchedule = { slots: TimeSlot[]; };

// ─── Environment ──────────────────────────────────────────────────────────────
export type WorkspaceType = 'home' | 'office' | 'coworking' | 'hybrid' | 'remote';
export type LivingWith = 'alone' | 'family' | 'roommates' | 'partner';
export type EnvironmentProfile = { city: string; country: string; timezone: string; workspace: WorkspaceType | ''; livingWith: LivingWith | ''; constraints: string[]; assets: string[]; };
