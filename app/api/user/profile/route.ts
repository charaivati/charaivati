// app/api/user/profile/route.ts
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
  statement: string;
  horizon: string;
  skills: SkillEntry[];
  linkedBusinessIds: string[];
};

type HealthInput = {
  food?: string;
  exercise?: string;
  sessionsPerWeek?: number;
  heightCm?: string;
  weightKg?: string;
  age?: string;
};

const DRIVES: DriveType[] = ["learning", "helping", "building", "doing"];
const VALID_HORIZONS = new Set(["This year", "3 Years", "Lifetime"]);
const VALID_LEVELS = new Set(["Beginner", "Intermediate", "Advanced"]);

// ── Helpers ───────────────────────────────────────────
function emptyDriveMap<T>() {
  return {
    learning: [] as T[],
    helping: [] as T[],
    building: [] as T[],
    doing: [] as T[],
  };
}

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

    // ── CURRENT DRIVE (important for tab behavior)
    const currentDrive: DriveType = DRIVES.includes(body.drive)
      ? body.drive
      : "learning";

    patch.drive = currentDrive;

    // ── FETCH EXISTING PROFILE
    const existing = await prisma.profile.findUnique({
      where: { userId: user.id },
    });

    // Parse stored JSON safely
    const existingGoals = existing?.goals || emptyDriveMap<GoalEntry>();

    // ── HANDLE GOALS (TAB SPECIFIC)
    if ("goals" in body && Array.isArray(body.goals)) {
      const cleanedGoals: GoalEntry[] = body.goals.slice(0, 5).map((g: GoalEntry) => ({
        id: String(g.id || ""),
        statement: String(g.statement || "").slice(0, 500),
        horizon: VALID_HORIZONS.has(g.horizon) ? g.horizon : "This year",
        skills: Array.isArray(g.skills)
          ? g.skills.slice(0, 10).map((s: SkillEntry) => ({
              id: String(s.id || ""),
              name: String(s.name || "").slice(0, 100),
              level: VALID_LEVELS.has(s.level) ? s.level : "Beginner",
              monetize: Boolean(s.monetize),
            }))
          : [],
        linkedBusinessIds: Array.isArray(g.linkedBusinessIds)
          ? g.linkedBusinessIds.map(String).slice(0, 20)
          : [],
      }));

      // 💡 KEY LOGIC: only update current tab
      existingGoals[currentDrive] = cleanedGoals;

      patch.goals = existingGoals;
    }

    // ── SIMPLE FIELDS (unchanged)
    if ("displayName" in body) {
      patch.displayName = String(body.displayName || "").slice(0, 80);
    }

    if ("desiredMonthlyIncome" in body) {
      const v = Number(body.desiredMonthlyIncome);
      if (Number.isFinite(v)) patch.desiredMonthlyIncome = v;
    }

    if ("stepsToday" in body) patch.stepsToday = Number(body.stepsToday) || 0;
    if ("sleepHours" in body) patch.sleepHours = Number(body.sleepHours) || 0;
    if ("waterLitres" in body) patch.waterLitres = Number(body.waterLitres) || 0;

    // ── HEALTH (GLOBAL, NOT TAB SPECIFIC)
    if ("health" in body && body.health && typeof body.health === "object") {
      const h = body.health as HealthInput;

      patch.health = {
        food: String(h.food || "Vegetarian").slice(0, 50),
        exercise: String(h.exercise || "Mixed").slice(0, 50),
        sessionsPerWeek: Math.min(Math.max(Number(h.sessionsPerWeek) || 3, 1), 7),
        heightCm: String(h.heightCm || "").slice(0, 10),
        weightKg: String(h.weightKg || "").slice(0, 10),
        age: String(h.age || "").slice(0, 5),
      };
    }

    // ── NOTHING TO UPDATE
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: true, message: "nothing_to_update" });
    }

    // ── UPSERT
    const updated = await prisma.profile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...patch },
      update: patch,
    });

    return NextResponse.json({ ok: true, profile: updated });
  } catch (err: any) {
    console.error("PATCH profile error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
