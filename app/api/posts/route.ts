// app/api/posts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json();
    const {
      content,
      imageFileIds = [],
      videoFileId,
      youtubeLinks = [],
      slugTags = [],
      pageId,
      visibility = "public",
      gdriveFolder,
    } = body;

    if (!content?.trim() && imageFileIds.length === 0 && !videoFileId && youtubeLinks.length === 0) {
      return NextResponse.json({ error: "Post must have content or media" }, { status: 400 });
    }

    // Validate slugTags
    const incomingSlugs = Array.isArray(slugTags) ? slugTags.map(String) : [];
    let validSlugs: string[] = [];
    if (incomingSlugs.length > 0) {
      const foundTabs = await prisma.tab.findMany({
        where: { slug: { in: incomingSlugs } },
        select: { slug: true },
      });
      validSlugs = foundTabs.map((t) => t.slug);
      if (validSlugs.length === 0) {
        return NextResponse.json({ error: "No valid tab slugs provided" }, { status: 400 });
      }
    }

    const post = await prisma.post.create({
      data: {
        userId: user.id,
        pageId: pageId || null,
        content: content?.trim() || null,
        imageFileIds,
        videoFileId,
        youtubeLinks,
        slugTags: validSlugs,
        visibility,
        gdriveFolder: gdriveFolder || null,
      },
    });

    if (validSlugs.length > 0) {
      await prisma.tab.updateMany({
        where: { slug: { in: validSlugs } },
        data: { usageCount: { increment: 1 } },
      });
    }

    return NextResponse.json({ ok: true, post }, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/posts error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * GET /api/posts
 * Query params:
 *  - limit, offset, sortBy (recent|popular)
 *  - tabSlug (single) OR tabSlugs (comma separated list)
 *  - media=video
 */
export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const limit = Math.min(Number(url.searchParams.get("limit") || 20), 200);
    const offset = Number(url.searchParams.get("offset") || 0);
    const sortBy = url.searchParams.get("sortBy") || "recent";
    const media = url.searchParams.get("media") || null;

    // new: accept either tabSlug (single) or tabSlugs (comma-separated)
    const singleTab = url.searchParams.get("tabSlug");
    const tabSlugsParam = url.searchParams.get("tabSlugs"); // comma separated

    const orderBy: any = sortBy === "popular" ? { likes: "desc" } : { createdAt: "desc" };

    // Base filter
    const where: any = {
      visibility: "public",
      status: "active",
    };

    if (singleTab) {
      where.slugTags = { has: singleTab };
    } else if (tabSlugsParam) {
      const slugs = tabSlugsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (slugs.length) {
        // Prisma operator 'hasSome' returns rows where slugTags has any of the provided values
        where.slugTags = { hasSome: slugs };
      }
    }

    if (media === "video") {
      where.AND = [
        {
          OR: [
            { youtubeLinks: { not: [] } },
            { videoFileId: { not: null } },
          ],
        },
      ];
    }

    const posts = await prisma.post.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({ ok: true, data: posts, count: posts.length });
  } catch (e: any) {
    console.error("GET /api/posts error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
