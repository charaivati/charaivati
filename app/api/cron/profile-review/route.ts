// app/api/cron/profile-review/route.ts — periodic per-user profile reviewer.
// Mirrors app/api/cron/upgrade-images (Bearer CRON_SECRET). Reviews a small
// capped batch of the stalest/never-reviewed users each run, sequentially
// (the local model keeps one resident — do not parallelize).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildProfileReview } from "@/lib/self/buildProfileReview";

// ponytail: small batch backfills over days; move to a queue if the user base
// outgrows one daily sweep. maxDuration covers ~6 sequential local AI passes.
export const maxDuration = 300;
const BATCH = 6;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Stalest first; never-reviewed (NULL) first of all. Only users with a non-empty
  // drive or goal — empty profiles have nothing to review and would otherwise
  // monopolize the NULLS-FIRST batch forever (buildProfileReview writes nothing for them).
  const rows = await db.$queryRaw<{ userId: string }[]>`
    SELECT p."userId"
    FROM "Profile" p
    LEFT JOIN "UserContext" uc ON uc."userId" = p."userId" AND uc."kind" = 'profile-review'
    WHERE (jsonb_typeof(p.drives) = 'array' AND jsonb_array_length(p.drives) > 0)
       OR (jsonb_typeof(p.goals) = 'array' AND jsonb_array_length(p.goals) > 0)
    ORDER BY uc."updatedAt" ASC NULLS FIRST
    LIMIT ${BATCH}`;

  let reviewed = 0;
  let skipped = 0;
  for (const { userId } of rows) {
    try {
      const r = await buildProfileReview(userId);
      if (r) reviewed++;
      else skipped++;
    } catch (err) {
      console.error(`[cron/profile-review] ${userId} failed:`, (err as Error).message);
      skipped++;
    }
  }

  return NextResponse.json({ reviewed, skipped });
}
