// app/api/posts/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const post = await prisma.post.findUnique({ where: { id: params.id } });
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    // Only author can delete
    if (post.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.post.delete({ where: { id: params.id } });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("DELETE /api/posts/:id error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
