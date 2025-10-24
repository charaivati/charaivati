// app/api/social/posts/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const perPage = Math.min(50, Math.max(5, Number(url.searchParams.get("perPage") || "20")));
    const skip = (page - 1) * perPage;

    const posts = await prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      take: perPage,
      skip,
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({ ok: true, posts });
  } catch (err) {
    console.error("/api/social/posts error:", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
