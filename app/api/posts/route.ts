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
    const sortBy = req.nextUrl.searchParams.get("sortBy") || "recent"; // recent | popular
    const userId = req.nextUrl.searchParams.get("userId"); // ✅ NEW: Filter by user

    const orderBy: any = sortBy === "popular" 
      ? { likes: "desc" } 
      : { createdAt: "desc" };

    // ✅ UPDATED: Build visibility filter based on authentication
    let visibilityFilter: any = { visibility: "public" };

    if (user?.id) {
      // ✅ If authenticated, also show:
      // 1. Own posts (any visibility)
      // 2. Friends' "friends" posts
      // 3. Public posts

      // Get user's friends
      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [
            { userAId: user.id },
            { userBId: user.id },
          ],
        },
        select: {
          userAId: true,
          userBId: true,
        },
      });

      const friendIds = friendships.flatMap((f) => 
        f.userAId === user.id ? [f.userBId] : [f.userAId]
      );

      visibilityFilter = {
        OR: [
          // Own posts (all visibility levels)
          { userId: user.id },
          // Friends' "friends-only" posts
          {
            AND: [
              { userId: { in: friendIds } },
              { visibility: "friends" },
            ],
          },
          // Public posts from anyone
          { visibility: "public" },
        ],
      };
    }

    // ✅ Filter by specific user if provided
    let whereClause: any = visibilityFilter;
    if (userId) {
      whereClause = {
        AND: [
          visibilityFilter,
          { userId },
        ],
      };
    }

    const posts = await prisma.post.findMany({
      where: whereClause,
      orderBy,
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
          } 
        },
      },
    });

    // ✅ Get total count for pagination
    const count = await prisma.post.count({
      where: whereClause,
    });

    return NextResponse.json({
      ok: true,
      data: posts,
      count: posts.length,
      total: count,
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