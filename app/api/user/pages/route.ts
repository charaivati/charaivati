// app/api/user/pages/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { softDeleteStore } from "@/lib/store/softDeleteStore";

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
      where: { ownerId: user.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, description: true, avatarUrl: true, createdAt: true, type: true, pageType: true },
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
    const rawType = (body.type || "").trim();
    const type = rawType === "health" ? "health" : "standard";
    const rawPageType = (body.pageType || "").trim();
    const pageType = ["store", "learning", "service", "helping", "community_group", "fleet"].includes(rawPageType) ? rawPageType : "store";

    if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });

    const page = await prisma.page.create({
      data: { ownerId: user.id, title, description: description || null, type, pageType },
      select: { id: true, title: true, description: true, avatarUrl: true, createdAt: true, type: true, pageType: true },
    });

    return NextResponse.json({ ok: true, page }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/user/pages error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const pageId = (body.id || body.pageId || "").trim();

    if (!pageId) {
      return NextResponse.json({ error: "page_id_required" }, { status: 400 });
    }

    // Check if page exists and belongs to user
    const page = await prisma.page.findUnique({
      where: { id: pageId },
      select: { ownerId: true },
    });

    if (!page) {
      return NextResponse.json({ error: "page_not_found" }, { status: 404 });
    }

    if (page.ownerId !== user.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    // If this page backs a Store, this is a whole-venture delete — soft-delete
    // both rows (refuses while orders are open). See lib/store/softDeleteStore.ts.
    const store = await prisma.store.findFirst({
      where: { pageId },
      select: { id: true },
    });
    if (store) {
      const result = await softDeleteStore(store.id, user.id);
      if (!result.ok) {
        if (result.reason === "not_found") return NextResponse.json({ error: "store_not_found" }, { status: 404 });
        if (result.reason === "forbidden") return NextResponse.json({ error: "unauthorized" }, { status: 403 });
        return NextResponse.json(
          { error: "open_orders", message: "This store has open orders — settle or cancel them before deleting.", blockingOrders: result.blockingOrders },
          { status: 409 }
        );
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // No linked Store — out of soft-delete scope (no orders can exist). Hard-delete as before.
    await prisma.page.delete({
      where: { id: pageId },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("DELETE /api/user/pages error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}