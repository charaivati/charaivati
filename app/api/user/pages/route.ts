// app/api/user/pages/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || url.searchParams.get("query") || "").trim();

    // If a query is provided, perform a public search to power suggestions.
    if (q) {
      const pages = await prisma.page.findMany({
        where: {
          title: { contains: q, mode: "insensitive" },
          // add additional filters here if needed (e.g. only published pages)
        },
        select: { id: true, title: true, description: true, avatarUrl: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      return NextResponse.json({ ok: true, pages });
    }

    // No search query — return the authenticated user's pages (same behavior as before)
    const user = await getServerUser(req);
    if (!user) {
      // If not authenticated and no query, return an empty list (or a 401 if you prefer).
      return NextResponse.json({ ok: true, pages: [] });
    }

    const pages = await prisma.page.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, description: true, avatarUrl: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, pages });
  } catch (err: any) {
    console.error("GET /api/user/pages error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const title = (body.title || "").trim();
    const description = (body.description || "").trim();

    if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });

    const page = await prisma.page.create({
      data: { ownerId: user.id, title, description: description || null },
      select: { id: true, title: true, description: true, avatarUrl: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, page }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/user/pages error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
