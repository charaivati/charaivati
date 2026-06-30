// CHAKRA-1: per-user chakra openness scores for the landing view.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { computeChakraScores } from "@/lib/chakra/score";

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  try {
    const scores = await computeChakraScores(user.id);
    return NextResponse.json({ ok: true, scores });
  } catch (err) {
    console.error("chakra scores error", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
