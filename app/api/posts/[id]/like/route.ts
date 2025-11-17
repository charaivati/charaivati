import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { action } = await req.json(); // "like" | "unlike"

    if (!action || !["like", "unlike"].includes(action)) {
      return NextResponse.json({ error: "action must be 'like' or 'unlike'" }, { status: 400 });
    }

    const post = await prisma.post.findUnique({ where: { id: params.id } });
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const updated = await prisma.post.update({
      where: { id: params.id },
      data: {
        likes: action === "like" ? post.likes + 1 : Math.max(0, post.likes - 1),
      },
    });

    return NextResponse.json({ ok: true, post: updated });
  } catch (e: any) {
    console.error("POST /api/posts/:id/like error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}