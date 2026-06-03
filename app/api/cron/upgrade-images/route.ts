import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveImageFresh } from "@/lib/imageCache";

const MAX_BLOCKS      = 20;
const MAX_UNSPLASH    = 15;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find up to 20 blocks with low imageQuality that weren't uploaded by the user,
  // ordered by the store's most-recently-created first.
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    mediaUrl: string | null;
    imageQuality: number;
    imageProvider: string | null;
    blockTitle: string;
  }>>`
    SELECT
      b.id,
      b."mediaUrl",
      b."imageQuality",
      b."imageProvider",
      b.title AS "blockTitle"
    FROM "Block" b
    JOIN "Section" s  ON s.id = b."sectionId"
    JOIN "Store"   st ON st.id = s."storeId"
    WHERE b."imageQuality" < 2
      AND (b."imageProvider" IS NULL OR b."imageProvider" != 'user')
      AND b."mediaUrl" IS NOT NULL
    ORDER BY st."createdAt" DESC
    LIMIT ${MAX_BLOCKS}
  `;

  let upgraded  = 0;
  let skipped   = 0;
  let unsplashCallsThisRun = 0;

  for (const block of rows) {
    if (unsplashCallsThisRun >= MAX_UNSPLASH) {
      skipped += rows.length - upgraded - skipped;
      break;
    }

    // Find the original query via ImageCache keyed by the current imageUrl
    const cacheEntry = await prisma.imageCache.findFirst({
      where: { imageUrl: block.mediaUrl! },
      select: { query: true, quality: true },
    });

    const query = cacheEntry?.query ?? block.blockTitle;
    const currentQuality = block.imageQuality;

    try {
      const fresh = await resolveImageFresh(query);

      if (fresh.quality <= currentQuality) {
        skipped++;
        continue;
      }

      await prisma.storeBlock.update({
        where: { id: block.id },
        data: {
          mediaUrl:      fresh.url,
          imageProvider: fresh.provider,
          imageQuality:  fresh.quality,
        },
      });

      if (fresh.provider === "unsplash") unsplashCallsThisRun++;
      upgraded++;
    } catch (err) {
      console.error(`[upgrade-images] block ${block.id} failed:`, err);
      skipped++;
    }
  }

  return NextResponse.json({ upgraded, skipped });
}
