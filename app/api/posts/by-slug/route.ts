// app/api/posts/by-slug/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/posts/by-slug?slug=...&limit=...
 * Returns posts with slugTags containing the slug, status active, visibility public.
 * Filters out posts with >50% dislikes when total votes >= 10.
 */
export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const slug = url.searchParams.get("slug");
    const limit = Math.min(Number(url.searchParams.get("limit") || 10), 50);

    if (!slug) {
      return NextResponse.json({ error: "slug required" }, { status: 400 });
    }

    const posts = await prisma.post.findMany({
      where: {
        slugTags: { has: slug },
        status: "active",
        visibility: "public",
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    // Filter out posts with >50% dislikes (if total votes >= 10)
    const filtered = posts.filter((p) => {
      const totalVotes = (p.likes || 0) + (p.dislikes || 0);
      if (totalVotes < 10) return true; // keep posts with fewer than 10 votes
      const dislikePercent = (p.dislikes || 0) / totalVotes;
      return dislikePercent <= 0.5;
    });

    return NextResponse.json({
      ok: true,
      data: filtered,
      count: filtered.length,
    });
  } catch (e: any) {
    console.error("GET /api/posts/by-slug error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
