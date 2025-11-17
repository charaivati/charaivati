import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get("slug");
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 10, 50);

    if (!slug) {
      return NextResponse.json({ error: "slug required" }, { status: 400 });
    }

    // Calculate dislike percentage and filter
    const posts = await prisma.post.findMany({
      where: {
        slugTags: { has: slug },
        status: "active",
        visibility: "public",
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Filter out posts with >50% dislikes (if total votes >= 10)
    const filtered = posts.filter((p) => {
      const totalVotes = p.likes + p.dislikes;
      if (totalVotes < 10) return true; // Keep posts with < 10 votes
      const dislikePercent = p.dislikes / totalVotes;
      return dislikePercent <= 0.5; // Keep if <= 50% dislikes
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