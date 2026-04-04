import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const viewer = await getCurrentUser(req);

    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 20, 100);
    const offset = Number(req.nextUrl.searchParams.get("offset")) || 0;

    // Determine which visibilities the viewer can see
    let visibilityFilter: string[];

    if (viewer?.id === id) {
      // Own profile — see everything
      visibilityFilter = ["public", "friends", "private"];
    } else if (viewer?.id) {
      // Check if viewer is a friend
      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { userAId: viewer.id, userBId: id },
            { userAId: id, userBId: viewer.id },
          ],
        },
      });
      visibilityFilter = friendship ? ["public", "friends"] : ["public"];
    } else {
      visibilityFilter = ["public"];
    }

    const posts = await prisma.post.findMany({
      where: {
        userId: id,
        status: "active",
        visibility: { in: visibilityFilter as any },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            profile: { select: { displayName: true } },
          },
        },
      },
    });

    return NextResponse.json({ ok: true, data: posts, count: posts.length });
  } catch (e: any) {
    console.error("GET /api/users/[id]/posts error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
