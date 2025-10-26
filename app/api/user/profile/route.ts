// app/api/user/profile/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

const ALLOWED = new Set([
  "heightCm","weightKg","stepsToday","sleepHours","waterLitres",
  "displayName","bio","socialHandles","topics","streakDays","learningNotes",
  "businesses","weeklyEarningsEstimate","preferredPayment",
]);

function pickAllowed(obj: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (ALLOWED.has(k)) out[k] = v;
  }
  return out;
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
    return NextResponse.json({ ok: true, profile: profile ?? null });
  } catch (err) {
    console.error("profile GET err", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json();
    const data = pickAllowed(body);
    if (Object.keys(data).length === 0) return NextResponse.json({ error: "nothing to set" }, { status: 400 });

    const profile = await prisma.profile.upsert({
      where: { userId: user.id },
      update: data,
      create: { userId: user.id, ...data },
    });
    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    console.error("profile POST err", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json();
    const data = pickAllowed(body);
    if (Object.keys(data).length === 0) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

    const profile = await prisma.profile.upsert({
      where: { userId: user.id },
      update: data,
      create: { userId: user.id, ...data },
    });
    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    console.error("profile PUT err", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
