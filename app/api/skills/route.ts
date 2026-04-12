// app/api/skills/route.ts
// GET — returns all unique skill names across all users (no auth required)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type SkillEntry = { name?: string };
type GoalEntry  = { skills?: SkillEntry[]; saved?: boolean };

export async function GET() {
  try {
    const profiles = await prisma.profile.findMany({
      select: { generalSkills: true, goals: true },
    });

    const seen = new Set<string>();
    const skills: { id: string; name: string }[] = [];

    for (const profile of profiles) {
      // General skills
      for (const s of (profile.generalSkills as SkillEntry[] | null) ?? []) {
        const name = (s.name ?? "").trim();
        if (name && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          skills.push({ id: `skill-${name}`, name });
        }
      }
      // Goal-specific skills
      for (const g of (profile.goals as GoalEntry[] | null) ?? []) {
        for (const s of g.skills ?? []) {
          const name = (s.name ?? "").trim();
          if (name && !seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase());
            skills.push({ id: `skill-${name}`, name });
          }
        }
      }
    }

    skills.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ ok: true, skills });
  } catch (err) {
    console.error("GET /api/skills error:", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
