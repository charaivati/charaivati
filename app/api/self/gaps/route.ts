// app/api/self/gaps/route.ts — top "what should this user set up next?" gap for the
// floating chat's active-guide card. Read-only; safe to call on every chat open.
import { NextRequest, NextResponse } from "next/server";
import getServerUser from "@/lib/serverAuth";
import { db } from "@/lib/db";
import { detectGap } from "@/lib/companion/gapDetector";

export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.status === "guest") return NextResponse.json({ gap: null });

  const dismissed = (new URL(req.url).searchParams.get("dismissed") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const profile = await db.profile.findUnique({
    where: { userId: user.id },
    select: {
      drives: true, goals: true, health: true,
      fundsProfile: true, weekSchedule: true,
    },
  });

  return NextResponse.json({ gap: detectGap(profile, dismissed) });
}
