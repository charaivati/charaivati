import { NextResponse } from "next/server";

type GoalEntry = {
  id?: string;
  title?: string;
  skill?: string;
  drive?: string;
};

type HealthProfile = {
  note?: string;
};

type Body = {
  drives?: string[];
  goals?: GoalEntry[];
  health?: HealthProfile;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const drives = Array.isArray(body.drives) ? body.drives.filter(Boolean).slice(0, 2) : [];
  const goals = Array.isArray(body.goals) ? body.goals : [];
  const health = body.health ?? {};

  const goalTitles = goals
    .map((goal) => goal.title?.trim())
    .filter((value): value is string => Boolean(value));
  const skills = goals
    .map((goal) => goal.skill?.trim())
    .filter((value): value is string => Boolean(value));

  const foundationActions = [
    ...(drives.length ? [`Define baseline for ${drives.join(" + ")} focus`] : ["Define your primary focus"]),
    ...(skills.length ? [`Practice ${skills[0]} for 30 focused minutes`] : ["Identify one core skill to start"]),
    ...(health.note?.trim()
      ? [`Apply health support habit: ${health.note.trim()}`]
      : ["Add one health-supporting routine (sleep, hydration, movement)"]),
  ];

  const growthActions = [
    ...(goalTitles.length ? [`Ship first milestone for: ${goalTitles[0]}`] : ["Ship a visible mini-milestone"]),
    ...(skills[1] ? [`Upgrade ${skills[1]} through one guided project`] : ["Strengthen execution through one weekly project"]),
    "Share progress update with one accountability partner",
  ];

  const masteryActions = [
    ...(goalTitles[1] ? [`Scale second milestone for: ${goalTitles[1]}`] : ["Scale your strongest output channel"]),
    "Systemize weekly review and iteration loop",
    "Mentor or collaborate to compound outcomes",
  ];

  return NextResponse.json({
    phases: [
      {
        id: "foundation",
        name: "Foundation",
        duration: "2-4 weeks",
        actions: foundationActions,
      },
      {
        id: "growth",
        name: "Growth",
        duration: "4-8 weeks",
        actions: growthActions,
      },
      {
        id: "mastery",
        name: "Mastery",
        duration: "8+ weeks",
        actions: masteryActions,
      },
    ],
  });
}
