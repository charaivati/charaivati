// app/api/user/follows/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

// ------------------------------
// GET: List followed pages
// ------------------------------
export async function GET(req: Request) {
  try {
    const me = await getServerUser(req);
    if (!me)
      return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });

    const follows = await prisma.pageFollow.findMany({
      where: { userId: me.id },
      include: {
        page: {
          select: { id: true, title: true, description: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, follows });
  } catch (err: any) {
    console.error("GET /api/user/follows error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// ------------------------------
// POST: Follow a page by id or title
// ------------------------------
export async function POST(req: Request) {
  try {
    const me = await getServerUser(req);
    if (!me)
      return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    console.log("[/api/user/follows] POST body:", body);

    const pageId = (body.pageId || "").trim();
    if (!pageId)
      return NextResponse.json({ ok: false, error: "missing_pageId" }, { status: 400 });

    // Look up page either by ID or title
    let page = await prisma.page.findUnique({ where: { id: pageId } });
    if (!page) {
      page = await prisma.page.findFirst({
        where: { title: { equals: pageId, mode: "insensitive" } },
      });
    }

    if (!page) {
      console.warn("[/api/user/follows] page not found for:", pageId);
      return NextResponse.json({ ok: false, error: "page_not_found" }, { status: 404 });
    }

    // Upsert follow
    await prisma.pageFollow.upsert({
      where: { userId_pageId: { userId: me.id, pageId: page.id } },
      update: {},
      create: { userId: me.id, pageId: page.id },
    });

    console.log("[/api/user/follows] user", me.id, "followed page", page.id);
    return NextResponse.json({ ok: true, page });
  } catch (err: any) {
    console.error("POST /api/user/follows error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// ------------------------------
// DELETE: Unfollow a page
// ------------------------------
export async function DELETE(req: Request) {
  try {
    const me = await getServerUser(req);
    if (!me)
      return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    console.log("[/api/user/follows] DELETE body:", body);

    const pageId = (body.pageId || "").trim();
    if (!pageId)
      return NextResponse.json({ ok: false, error: "missing_pageId" }, { status: 400 });

    // Delete follows (by id or title)
    const deleted = await prisma.pageFollow.deleteMany({
      where: {
        userId: me.id,
        OR: [
          { pageId },
          { page: { title: { equals: pageId, mode: "insensitive" } } },
        ],
      },
    });

    console.log("[/api/user/follows] unfollowed count:", deleted.count);
    return NextResponse.json({ ok: true, removed: deleted.count });
  } catch (err: any) {
    console.error("DELETE /api/user/follows error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
