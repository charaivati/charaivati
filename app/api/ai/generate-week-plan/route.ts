import { NextResponse } from "next/server";

type Phase = {
  id?: string;
  name?: string;
  duration?: string;
  actions?: string[];
};

type Body = {
  phases?: Phase[];
  currentPhase?: string;
  availableDays?: number;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const phases = Array.isArray(body.phases) ? body.phases : [];
  const requestedDays = Number(body.availableDays);
  const availableDays = Number.isFinite(requestedDays)
    ? Math.max(1, Math.min(7, Math.floor(requestedDays)))
    : 5;

  const fallbackActions = ["Deep work session", "Skill rehearsal", "Recovery + review"];
  const chosenPhase = phases.find((phase) => phase.id === body.currentPhase) ?? phases[0];
  const sourceActions =
    chosenPhase && Array.isArray(chosenPhase.actions) && chosenPhase.actions.length > 0
      ? chosenPhase.actions
      : fallbackActions;

  const week = DAYS.slice(0, availableDays).map((day, index) => {
    const first = sourceActions[index % sourceActions.length];
    const second = sourceActions[(index + 1) % sourceActions.length];
    return {
      day,
      tasks: [first, second],
    };
  });

  return NextResponse.json({ week });
}
