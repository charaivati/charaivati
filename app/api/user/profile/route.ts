// app/api/user/profile/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

// ── Inline types ──────────────────────────────────────────────────
type DriveType = "learning" | "helping" | "building" | "doing";
type SkillEntry   = { id: string; name: string; level: string; monetize: boolean };
type GoalEntry    = { id: string; statement: string; horizon: string; skills: SkillEntry[]; linkedBusinessIds: string[] };
type HealthInput  = { food?: string; exercise?: string; sessionsPerWeek?: number; heightCm?: string; weightKg?: string; age?: string };

const VALID_DRIVES   = new Set<string>(["learning", "helping", "building", "doing"]);
const VALID_HORIZONS = new Set<string>(["This year", "3 Years", "Lifetime"]);
const VALID_LEVELS   = new Set<string>(["Beginner", "Intermediate", "Advanced"]);

// ── GET ───────────────────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
    });

    return NextResponse.json({ ok: true, profile: profile ?? null });
  } catch (err) {
    console.error("GET /api/user/profile error:", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

// ── PATCH ─────────────────────────────────────────────────────────
export async function PATCH(req: Request) {
  try {
    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const patch: Record<string, unknown> = {};

    // Existing scalar fields
    if ("desiredMonthlyIncome" in body) {
      const v = Number(body.desiredMonthlyIncome);
      if (Number.isFinite(v) && v >= 0) patch.desiredMonthlyIncome = v;
    }
    if ("stepsToday"  in body) patch.stepsToday  = Number(body.stepsToday)  || 0;
    if ("sleepHours"  in body) patch.sleepHours  = Number(body.sleepHours)  || 0;
    if ("waterLitres" in body) patch.waterLitres = Number(body.waterLitres) || 0;
    if ("displayName" in body) patch.displayName = String(body.displayName || "").trim().slice(0, 80);

    // drive — accepts string or string[] (SelfTab sends array)
    if ("drive" in body) {
      if (body.drive === null) {
        patch.drive = null;
      } else {
        // Normalise: could be array ["learning","helping"] or single string
        const raw = Array.isArray(body.drive) ? body.drive : [body.drive];
        const valid = raw.filter((d: unknown) => VALID_DRIVES.has(String(d)));
        if (raw.length > 0 && valid.length === 0) {
          return NextResponse.json({ error: "invalid_drive" }, { status: 400 });
        }
        // Store as JSON string so it fits the String? column
        patch.drive = JSON.stringify(valid);
      }
    }

    // goals
    if ("goals" in body) {
      if (body.goals === null) {
        patch.goals = null;
      } else if (Array.isArray(body.goals)) {
        patch.goals = (body.goals as GoalEntry[]).slice(0, 2).map((g) => ({
          id:        String(g.id        || ""),
          statement: String(g.statement || "").slice(0, 500),
          horizon:   VALID_HORIZONS.has(g.horizon) ? g.horizon : "This year",
          skills: Array.isArray(g.skills)
            ? g.skills.slice(0, 10).map((s: SkillEntry) => ({
                id:       String(s.id   || ""),
                name:     String(s.name || "").slice(0, 100),
                level:    VALID_LEVELS.has(s.level) ? s.level : "Beginner",
                monetize: Boolean(s.monetize),
              }))
            : [],
          linkedBusinessIds: Array.isArray(g.linkedBusinessIds)
            ? (g.linkedBusinessIds as unknown[]).map(String).slice(0, 20)
            : [],
        }));
      } else {
        return NextResponse.json({ error: "goals_must_be_array" }, { status: 400 });
      }
    }

    // health
    if ("health" in body) {
      if (body.health === null) {
        patch.health = null;
      } else if (body.health && typeof body.health === "object") {
        const h = body.health as HealthInput;
        patch.health = {
          food:            String(h.food     || "Vegetarian").slice(0, 50),
          exercise:        String(h.exercise || "Mixed").slice(0, 50),
          sessionsPerWeek: Math.min(Math.max(Number(h.sessionsPerWeek) || 3, 1), 7),
          heightCm:        String(h.heightCm || "").slice(0, 10),
          weightKg:        String(h.weightKg || "").slice(0, 10),
          age:             String(h.age      || "").slice(0, 5),
        };
      } else {
        return NextResponse.json({ error: "health_must_be_object" }, { status: 400 });
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: true, message: "nothing_to_update" });
    }

    const updated = await prisma.profile.upsert({
      where:  { userId: user.id },
      create: { userId: user.id, ...patch },
      update: patch,
      select: {
        drive: true, goals: true, health: true,
        desiredMonthlyIncome: true, displayName: true,
        stepsToday: true, sleepHours: true, waterLitres: true,
      },
    });

    return NextResponse.json({ ok: true, profile: updated });
  } catch (err: unknown) {
    console.error("PATCH /api/user/profile error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}