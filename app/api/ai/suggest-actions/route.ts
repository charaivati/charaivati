import { NextResponse } from "next/server";

type SuggestionType = "skill" | "health" | "network" | "execution";
type Priority = "low" | "medium" | "high";

type GoalEntry = {
  title?: string;
  skill?: string;
  drive?: string;
};

type Body = {
  currentPhase?: string;
  recentActivity?: string[];
  goals?: GoalEntry[];
  skills?: string[];
};

type Suggestion = {
  id: string;
  text: string;
  type: SuggestionType;
  priority: Priority;
};

function makeSuggestion(text: string, type: SuggestionType, priority: Priority): Suggestion {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    text,
    type,
    priority,
  };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const goals = Array.isArray(body.goals) ? body.goals : [];
  const explicitSkills = Array.isArray(body.skills)
    ? body.skills.filter((value): value is string => Boolean(value?.trim()))
    : [];
  const skillsFromGoals = goals
    .map((goal) => goal.skill?.trim())
    .filter((value): value is string => Boolean(value));
  const skills = [...new Set([...explicitSkills, ...skillsFromGoals])];
  const recent = new Set((body.recentActivity ?? []).map((item) => item.toLowerCase()));

  const pool: Suggestion[] = [];

  if (skills.length > 0) {
    pool.push(makeSuggestion(`Practice ${skills[0]} for 25 minutes with one measurable output`, "skill", "high"));
  }

  if (goals[0]?.title) {
    pool.push(makeSuggestion(`Break "${goals[0].title}" into a single 45-minute execution sprint`, "execution", "high"));
  }

  pool.push(makeSuggestion("Do a 10-minute recovery reset (walk + water) before next deep session", "health", "medium"));
  pool.push(makeSuggestion("Send one concise progress update to a peer or mentor today", "network", "medium"));

  if (body.currentPhase === "foundation") {
    pool.push(makeSuggestion("Define success criteria for this week in one checklist", "execution", "high"));
  } else if (body.currentPhase === "growth") {
    pool.push(makeSuggestion("Publish one public artifact that demonstrates your progress", "network", "high"));
  } else if (body.currentPhase === "mastery") {
    pool.push(makeSuggestion("Create a repeatable system document for your current workflow", "execution", "medium"));
  }

  if (!recent.has("stretching")) {
    pool.push(makeSuggestion("Add 5 minutes of mobility work after your main task block", "health", "low"));
  }

  const suggestions = pool.slice(0, 6);

  return NextResponse.json({ suggestions });
}
