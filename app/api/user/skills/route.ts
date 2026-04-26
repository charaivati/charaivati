// app/api/user/skills/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

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

    if (!profile) return NextResponse.json({ ok: true, skills: [] });

    const seen = new Set<string>();
    const skills: { id: string; name: string; source: string }[] = [];

    const generalSkills = Array.isArray(profile.generalSkills)
      ? profile.generalSkills
      : [];

    for (const entry of generalSkills) {
      if (!entry || typeof entry !== "object") continue;
      const s = entry as any;
      const name = String(s.name ?? "").trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        skills.push({ id: s.id || `gs-${name}`, name, source: "General" });
      }
    }

    const goals = Array.isArray(profile.goals) ? profile.goals : [];

    for (const goal of goals) {
      if (!goal || typeof goal !== "object") continue;
      const g = goal as any;
      if (!g.saved) continue;
      const goalSkills = Array.isArray(g.skills) ? g.skills : [];
      const label = String(g.statement ?? "").slice(0, 40) || "Goal";

      for (const entry of goalSkills) {
        if (!entry || typeof entry !== "object") continue;
        const s = entry as any;
        const name = String(s.name ?? "").trim();
        if (name && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          skills.push({ id: s.id || `gs-${g.id}-${name}`, name, source: label });
        }
      }
    }

    return NextResponse.json({ ok: true, skills });
  } catch (err) {
    console.error("GET /api/user/skills error:", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
