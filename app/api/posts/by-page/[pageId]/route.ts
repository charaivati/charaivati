import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ pageId: string }> }) {
  try {
    const { pageId } = await params;
    const posts = await prisma.post.findMany({
      where: { pageId, status: "active", visibility: "public" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        content: true,
        imageUrls: true,
        videoUrl: true,
        youtubeLinks: true,
        createdAt: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    return NextResponse.json({ ok: true, posts });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
