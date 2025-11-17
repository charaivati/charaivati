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
    });

    return NextResponse.json({ ok: true, post }, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/posts error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}