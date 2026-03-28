// app/api/social/post/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";

type ReqBody = {
  content?: string;
  images?: string[]; // data-urls or urls
  videoName?: string | null;
  videoSize?: number | null;
  videoUrl?: string | null;
};

export async function POST(req: Request) {
  try {
    // parse body
    const body = (await req.json().catch(() => ({} as ReqBody))) as ReqBody;

    // basic validation
    if ((!body.content || body.content.trim() === "") && !(body.images?.length) && !body.videoUrl) {
      return NextResponse.json({ ok: false, error: "empty_post" }, { status: 400 });
    }

    // Verify session token from cookie
    const cookieHeader = req.headers.get("cookie") ?? "";
    // Look for the session cookie name (COOKIE_NAME) — simple parse
    const cookieMatch = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${COOKIE_NAME}=`));
    const token = cookieMatch ? decodeURIComponent(cookieMatch.split("=")[1] || "") : null;

    if (!token) {
      return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
    }

    const payload = await verifySessionToken(token);
    // verifySessionToken returns false on invalid/expired — guard before using fields
    if (!payload || typeof payload === "boolean") {
      return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
    }
    if (payload.role === "guest") {
      return NextResponse.json({ ok: false, error: "guest_readonly" }, { status: 403 });
    }

    const userId = payload.userId;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
    }

    // Create DB record
    const created = await prisma.post.create({
      data: {
        // assumes Post.authorId is a string (matching User.id)
        authorId: userId,
        content: body.content ?? null,
        // if your schema uses Json for images, cast accordingly; here we assume String[] is allowed
        images: body.images ?? [],
        videoName: body.videoName ?? null,
        videoSize: body.videoSize ?? null,
        videoUrl: body.videoUrl ?? null,
      },
      select: {
        id: true,
        authorId: true,
        content: true,
        images: true,
        videoName: true,
        videoSize: true,
        videoUrl: true,
        likes: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, post: created }, { status: 201 });
  } catch (err) {
    console.error("[social/post] error", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
