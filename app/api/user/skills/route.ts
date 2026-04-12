// app/api/user/skills/route.ts
// GET — returns all unique skill names from the user's profile
// (combines generalSkills + all goal-specific skills)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

type SkillEntry = {
  id: string;
  name: string;
  level?: string;
  monetize?: boolean;
};

type GoalEntry = {
  id: string;
  statement?: string;
  skills?: SkillEntry[];
  saved?: boolean;
};

export async function GET(req: Request) {
  try {
    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: { generalSkills: true, goals: true },
    });

    if (!profile) {
      return NextResponse.json({ ok: true, skills: [] });
    }

    const seen = new Set<string>();
    const skills: { id: string; name: string; source: string }[] = [];

    // General skills
    const generalSkills = (profile.generalSkills as SkillEntry[] | null) ?? [];
    for (const s of generalSkills) {
      const name = (s.name ?? "").trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        skills.push({ id: s.id || `gs-${name}`, name, source: "General" });
      }
    }

    // Goal-specific skills
    const goals = (profile.goals as GoalEntry[] | null) ?? [];
    for (const g of goals) {
      if (!g.saved) continue;
      const goalSkills = g.skills ?? [];
      const goalLabel = g.statement?.slice(0, 40) || "Goal";
      for (const s of goalSkills) {
        const name = (s.name ?? "").trim();
        if (name && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          skills.push({ id: s.id || `gs-${g.id}-${name}`, name, source: goalLabel });
        }
      }
    }

    return NextResponse.json({ ok: true, skills });
  } catch (err) {
    console.error("GET /api/user/skills error:", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
