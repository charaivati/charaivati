// app/api/user/profile/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

// ── Types ─────────────────────────────────────────────
type DriveType = "learning" | "helping" | "building" | "doing";

type SkillEntry = {
  id: string;
  name: string;
  level: string;
  monetize: boolean;
};

type GoalEntry = {
  id: string;
  driveId?: DriveType;
  statement: string;
  horizon: string;
  skills: SkillEntry[];
  linkedBusinessIds: string[];
  saved?: boolean;
  plan?: unknown;
};

type HealthInput = {
  food?: string;
  exercise?: string;
  sessionsPerWeek?: number;
  heightCm?: string;
  weightKg?: string;
  age?: string;
  // Extended health fields — passed through as-is
  [key: string]: unknown;
};

const VALID_DRIVES = new Set<string>(["learning", "helping", "building", "doing"]);
const VALID_LEVELS = new Set(["Beginner", "Intermediate", "Advanced"]);

// ── GET ───────────────────────────────────────────────
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
    console.error("GET profile error:", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

// ── PATCH ─────────────────────────────────────────────
export async function PATCH(req: Request) {
  try {
    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const patch: Record<string, any> = {};

    // ── DRIVES (accept array from body.drives or body.drive)
    const rawDrives = Array.isArray(body.drives) ? body.drives
      : Array.isArray(body.drive)                ? body.drive
      : typeof body.drive === "string"           ? [body.drive]
      : null;

    if (rawDrives !== null) {
      const drives = rawDrives.filter((d: string) => VALID_DRIVES.has(d)) as DriveType[];
      patch.drives = drives;
      patch.drive  = drives[0] ?? null; // keep legacy field in sync
    }

    // ── GOALS (flat array with driveId on each entry)
    if ("goals" in body && Array.isArray(body.goals)) {
      patch.goals = body.goals.slice(0, 20).map((g: GoalEntry) => ({
        id:               String(g.id || ""),
        driveId:          VALID_DRIVES.has(g.driveId ?? "") ? g.driveId : "learning",
        statement:        String(g.statement || "").slice(0, 500),
        description:      String(g.description || "").slice(0, 2000),
        saved:            Boolean(g.saved),
        skills: Array.isArray(g.skills)
          ? g.skills.slice(0, 10).map((s: SkillEntry) => ({
              id:       String(s.id || ""),
              name:     String(s.name || "").slice(0, 100),
              level:    VALID_LEVELS.has(s.level) ? s.level : "Beginner",
              monetize: Boolean(s.monetize),
            }))
          : [],
        linkedBusinessIds: Array.isArray(g.linkedBusinessIds)
          ? g.linkedBusinessIds.map(String).slice(0, 20)
          : [],
        // Preserve AI-generated plan as-is — no validation needed
        plan: (g.plan && typeof g.plan === "object") ? g.plan : null,
      }));
    }

    // ── GENERAL SKILLS
    if ("generalSkills" in body && Array.isArray(body.generalSkills)) {
      patch.generalSkills = body.generalSkills.slice(0, 50).map((s: SkillEntry) => ({
        id:       String(s.id || ""),
        name:     String(s.name || "").slice(0, 100),
        level:    VALID_LEVELS.has(s.level) ? s.level : "Beginner",
        monetize: Boolean(s.monetize),
      }));
    }

    // ── AI PLAN (cached roadmap — save as-is, no validation needed)
    if ("aiPlan" in body && body.aiPlan && typeof body.aiPlan === "object") {
      patch.aiPlan = body.aiPlan;
    }

    // ── SIMPLE FIELDS
    if ("displayName" in body) {
      patch.displayName = String(body.displayName || "").slice(0, 80);
    }
    if ("desiredMonthlyIncome" in body) {
      const v = Number(body.desiredMonthlyIncome);
      if (Number.isFinite(v)) patch.desiredMonthlyIncome = v;
    }
    if ("stepsToday"  in body) patch.stepsToday  = Number(body.stepsToday)  || 0;
    if ("sleepHours"  in body) patch.sleepHours  = Number(body.sleepHours)  || 0;
    if ("waterLitres" in body) patch.waterLitres = Number(body.waterLitres) || 0;

    // ── WEEK SCHEDULE
    if ("weekSchedule" in body && body.weekSchedule && typeof body.weekSchedule === "object") {
      const ws = body.weekSchedule as Record<string, unknown>;
      patch.weekSchedule = {
        slots: Array.isArray(ws.slots) ? ws.slots : [],
        tasks: Array.isArray(ws.tasks) ? ws.tasks : [],
      };
    }

    // ── FUNDS PROFILE
    if ("fundsProfile" in body && body.fundsProfile && typeof body.fundsProfile === "object") {
      patch.fundsProfile = body.fundsProfile;
    }

    // ── ENVIRONMENT PROFILE
    if ("environmentProfile" in body && body.environmentProfile && typeof body.environmentProfile === "object") {
      patch.environmentProfile = body.environmentProfile;
    }

    // ── HEALTH (global, not per-drive)
    if ("health" in body && body.health && typeof body.health === "object") {
      const h = body.health as HealthInput;
      // Spread all fields first (preserves healthPlan, availableFoods, etc.)
      // then override the known scalar fields with sanitized values
      patch.health = {
        ...h,
        food:            String(h.food     || "Vegetarian").slice(0, 50),
        exercise:        String(h.exercise || "Mixed").slice(0, 50),
        sessionsPerWeek: Math.min(Math.max(Number(h.sessionsPerWeek) || 3, 1), 7),
        heightCm:        String(h.heightCm || "").slice(0, 10),
        weightKg:        String(h.weightKg || "").slice(0, 10),
        age:             String(h.age      || "").slice(0, 5),
      };
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: true, message: "nothing_to_update" });
    }

    const updated = await prisma.profile.upsert({
      where:  { userId: user.id },
      create: { userId: user.id, ...patch },
      update: patch,
    });

    return NextResponse.json({ ok: true, profile: updated });
  } catch (err: any) {
    console.error("PATCH profile error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
