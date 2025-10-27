// app/api/social/limits/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";

const MAX_PHOTOS_PER_DAY = 4;
const MAX_VIDEOS_PER_DAY = 1;

function todayDateRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start, end };
}

function getCookieFromHeader(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  const match = parts.find((p) => p.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.split("=").slice(1).join("="));
}

export async function GET(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie");
    let token = getCookieFromHeader(cookieHeader, COOKIE_NAME || "session");

    if (!token) {
      const auth = req.headers.get("authorization") || req.headers.get("Authorization");
      if (auth && auth.toLowerCase().startsWith("bearer ")) {
        token = auth.slice(7).trim();
      }
    }

    if (!token) {
      return NextResponse.json({
        ok: true,
        limits: {
          photosRemaining: MAX_PHOTOS_PER_DAY,
          videosRemaining: MAX_VIDEOS_PER_DAY,
          photosUsed: 0,
          videosUsed: 0,
        },
      });
    }

    const session = await verifySessionToken(token as string);

    if (!session || typeof session === "boolean" || (session as any).userId == null) {
      return NextResponse.json({
        ok: true,
        limits: {
          photosRemaining: MAX_PHOTOS_PER_DAY,
          videosRemaining: MAX_VIDEOS_PER_DAY,
          photosUsed: 0,
          videosUsed: 0,
        },
      });
    }

    const userId = (session as any).userId as string;
    const { start, end } = todayDateRange();

    const posts = await prisma.post.findMany({
      where: { authorId: userId, createdAt: { gte: start, lt: end } },
      select: { images: true, videoName: true },
    });

    let photosUsed = 0;
    let videosUsed = 0;

    for (const p of posts) {
      // images might be null or a JSON array stored in DB. Use Array.isArray safely.
      if (Array.isArray((p as any).images)) {
        photosUsed += (p as any).images.length;
      } else if (typeof (p as any).images === "string") {
        // If you store JSON string, attempt parse safely
        try {
          const parsed = JSON.parse((p as any).images);
          if (Array.isArray(parsed)) photosUsed += parsed.length;
        } catch (_e) {}
      }
      if (p.videoName) videosUsed += 1;
    }

    const photosRemaining = Math.max(0, MAX_PHOTOS_PER_DAY - photosUsed);
    const videosRemaining = Math.max(0, MAX_VIDEOS_PER_DAY - videosUsed);

    return NextResponse.json({
      ok: true,
      limits: { photosRemaining, videosRemaining, photosUsed, videosUsed },
    });
  } catch (err) {
    console.error("/api/social/limits error:", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
