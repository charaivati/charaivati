// app/api/social/limits/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
// adjust import path to the module that actually exports verifySessionToken
// If your project exposes verifySessionToken from "@/lib/session" then change accordingly.
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
    // 1) extract session token string from cookie or Authorization header
    const cookieHeader = req.headers.get("cookie");
    let token = getCookieFromHeader(cookieHeader, COOKIE_NAME || "session");

    // fallback to Authorization: Bearer <token>
    if (!token) {
      const auth = req.headers.get("authorization") || req.headers.get("Authorization");
      if (auth && auth.toLowerCase().startsWith("bearer ")) {
        token = auth.slice(7).trim();
      }
    }

    // If no token, treat as unauthenticated and return default limits (or you can return 401)
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

    // 2) verify token — verifySessionToken expects a string token (not Request)
    const session = await verifySessionToken(token);

    // Defensive check: verifySessionToken may return false or a payload
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

    const userId = (session as { userId: string }).userId;

    // 3) compute today's usage for this user
    const { start, end } = todayDateRange();

    const posts = await prisma.post.findMany({
      where: { authorId: userId, createdAt: { gte: start, lt: end } },
      select: { images: true, videoName: true },
    });

    let photosUsed = 0;
    let videosUsed = 0;
    for (const p of posts) {
      photosUsed += (p.images?.length || 0);
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
