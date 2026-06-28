// app/api/self/gaps/route.ts — returns the user's current structure focus
// (drive → goal → goal-skills → health → funds → time → null) so the floating
// chat can open the right conversational topic. Read-only; safe on every open.
import { NextRequest, NextResponse } from "next/server";
import getServerUser from "@/lib/serverAuth";
import { db } from "@/lib/db";
import { nextFocus } from "@/lib/companion/gapDetector";

export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.status === "guest") return NextResponse.json({ focus: null });

  const profile = await db.profile.findUnique({
    where: { userId: user.id },
    select: { drives: true, goals: true, health: true, fundsProfile: true, weekSchedule: true },
  });

  return NextResponse.json({ focus: nextFocus(profile, []) });
}
