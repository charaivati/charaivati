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

    // Validate
    if (!content?.trim() && imageFileIds.length === 0 && !videoFileId && youtubeLinks.length === 0) {
      return NextResponse.json({ error: "Post must have content or media" }, { status: 400 });
    }

    // ✅ Validate visibility
    if (!["public", "friends", "private"].includes(visibility)) {
      return NextResponse.json({ error: "Invalid visibility setting" }, { status: 400 });
    }

    // Create post
    const post = await prisma.post.create({
      data: {
        userId: user.id,
        pageId,
        content: content?.trim() || null,
        imageFileIds,
        videoFileId,
        youtubeLinks,
        slugTags,
        visibility,
        gdriveFolder,
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    console.log(`[POST] Created post ${post.id} with visibility: ${visibility}`);

    return NextResponse.json({ ok: true, post }, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/posts error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);

    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 20, 100);
    const offset = Number(req.nextUrl.searchParams.get("offset")) || 0;

    // -----------------------
    // Guest Feed
    // -----------------------

    if (!user?.id) {
      const posts = await prisma.post.findMany({
        where: {
          visibility: "public",
          status: "active",
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              profile: {
                select: {
                  displayName: true,
                },
              },
            },
          },
        },
      });

      return NextResponse.json({
        ok: true,
        data: posts,
        count: posts.length,
      });
    }

    // -----------------------
    // Logged-in Feed
    // -----------------------

    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ userAId: user.id }, { userBId: user.id }],
      },
      select: {
        userAId: true,
        userBId: true,
      },
    });

    const friendIds = friendships.flatMap((f) =>
      f.userAId === user.id ? [f.userBId] : [f.userAId]
    );

    const follows = await prisma.pageFollow.findMany({
      where: { userId: user.id },
      select: { pageId: true },
    });

    const followedPageIds = follows.map((f) => f.pageId);

    const posts = await prisma.post.findMany({
      where: {
        status: "active",
        OR: [
          { userId: user.id },

          {
            AND: [
              { userId: { in: friendIds } },
              { visibility: { in: ["friends", "public"] } },
            ],
          },

          {
            AND: [
              { pageId: { in: followedPageIds } },
              { visibility: "public" },
            ],
          },

          { visibility: "public" },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            profile: {
              select: {
                displayName: true,
              },
            },
          },
        },
      },
      take: 200,
    });

    const ranked = posts.sort((a, b) => {
      const score = (p: any) => {
        if (p.userId === user.id) return 4;
        if (friendIds.includes(p.userId)) return 3;
        if (p.pageId && followedPageIds.includes(p.pageId)) return 2;
        return 1;
      };

      const sA = score(a);
      const sB = score(b);

      if (sA !== sB) return sB - sA;

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const paged = ranked.slice(offset, offset + limit);

    return NextResponse.json({
      ok: true,
      data: paged,
      count: paged.length,
      total: ranked.length,
      offset,
      limit,
    });
  } catch (e: any) {
    console.error("GET /api/posts error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ✅ NEW: DELETE endpoint to delete posts
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json();
    const { postId } = body;

    if (!postId) {
      return NextResponse.json({ error: "Missing postId" }, { status: 400 });
    }

    // Verify ownership
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.userId !== user.id) {
      return NextResponse.json({ error: "Not authorized to delete this post" }, { status: 403 });
    }

    // Delete post
    await prisma.post.delete({
      where: { id: postId },
    });

    console.log(`[DELETE] Post ${postId} deleted by user ${user.id}`);

    return NextResponse.json({ ok: true, message: "Post deleted" });
  } catch (e: any) {
    console.error("DELETE /api/posts error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ✅ NEW: PATCH endpoint to update post visibility or content
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json();
    const { postId, visibility, content } = body;

    if (!postId) {
      return NextResponse.json({ error: "Missing postId" }, { status: 400 });
    }

    // Verify ownership
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.userId !== user.id) {
      return NextResponse.json({ error: "Not authorized to update this post" }, { status: 403 });
    }

    // Validate visibility if provided
    if (visibility && !["public", "friends", "private"].includes(visibility)) {
      return NextResponse.json({ error: "Invalid visibility setting" }, { status: 400 });
    }

    // Update post
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        ...(visibility && { visibility }),
        ...(content && { content: content.trim() }),
      },
      include: {
        user: { 
          select: { 
            id: true, 
            name: true, 
            email: true, 
            avatarUrl: true,
          } 
        },
      },
    });

    console.log(`[PATCH] Post ${postId} updated`);

    return NextResponse.json({ ok: true, post: updatedPost });
  } catch (e: any) {
    console.error("PATCH /api/posts error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}