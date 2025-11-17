import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { action } = await req.json(); // "dislike" | "undislike"

    if (!action || !["dislike", "undislike"].includes(action)) {
      return NextResponse.json({ error: "action must be 'dislike' or 'undislike'" }, { status: 400 });
    }

    const post = await prisma.post.findUnique({ where: { id: params.id } });
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const updated = await prisma.post.update({
      where: { id: params.id },
      data: {
        dislikes: action === "dislike" ? post.dislikes + 1 : Math.max(0, post.dislikes - 1),
      },
    });

    return NextResponse.json({ ok: true, post: updated });
  } catch (e: any) {
    console.error("POST /api/posts/:id/dislike error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}