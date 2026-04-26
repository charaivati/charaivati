// app/api/skills/route.ts
// GET — returns all unique skill names across all users (no auth required)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const profiles = await prisma.profile.findMany({
      select: { generalSkills: true, goals: true },
    });

    const seen = new Set<string>();
    const skills: { id: string; name: string }[] = [];

    for (const profile of profiles) {
      // General skills — profile.generalSkills is Prisma.JsonValue, must guard
      const generalSkills = Array.isArray(profile.generalSkills)
        ? profile.generalSkills
        : [];

      for (const entry of generalSkills) {
        if (!entry || typeof entry !== "object") continue;
        const name = String((entry as any).name ?? "").trim();
        if (name && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          skills.push({ id: `skill-${name}`, name });
        }
      }

      // Goal-specific skills
      const goals = Array.isArray(profile.goals) ? profile.goals : [];

      for (const goal of goals) {
        if (!goal || typeof goal !== "object") continue;
        const goalSkills = Array.isArray((goal as any).skills)
          ? (goal as any).skills
          : [];

        for (const entry of goalSkills) {
          if (!entry || typeof entry !== "object") continue;
          const name = String((entry as any).name ?? "").trim();
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
