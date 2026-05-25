import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const defaultAddress = await db.address.findFirst({
      where: { userId: user.id, isDefault: true },
      select: { pincode: true },
    });

    if (!defaultAddress?.pincode) {
      return NextResponse.json({ ok: true, posts: [], userPincode: null });
    }

    const targetPincode = defaultAddress.pincode;

    const nearbyAddresses = await db.address.findMany({
      where: { pincode: targetPincode, isDefault: true },
      select: { userId: true },
    });
    const ownerIds = nearbyAddresses.map((a) => a.userId);

    if (ownerIds.length === 0) {
      return NextResponse.json({ ok: true, posts: [], userPincode: targetPincode });
    }

    const nearbyPages = await db.page.findMany({
      where: {
        ownerId: { in: ownerIds },
        pageType: { in: ["store", "service", "fleet"] },
      },
      select: { id: true, title: true, pageType: true },
    });

    if (nearbyPages.length === 0) {
      return NextResponse.json({ ok: true, posts: [], userPincode: targetPincode });
    }

    const pageIds = nearbyPages.map((p) => p.id);

    // Resolve store id + slug via raw SQL (Prisma client may be stale for slug field)
    const storePageIds = nearbyPages.filter((p) => p.pageType === "store").map((p) => p.id);
    const storeByPageId: Record<string, { id: string; slug: string | null }> = {};
    if (storePageIds.length > 0) {
      const rows = await db.$queryRaw<{ pageId: string; id: string; slug: string | null }[]>`
        SELECT "pageId", id, slug FROM "Store" WHERE "pageId" IN (${Prisma.join(storePageIds)})
      `;
      for (const row of rows) storeByPageId[row.pageId] = { id: row.id, slug: row.slug };
    }

    const pageMap = Object.fromEntries(
      nearbyPages.map((p) => [p.id, {
        title: p.title,
        pageType: p.pageType,
        storeId: storeByPageId[p.id]?.id ?? null,
        storeSlug: storeByPageId[p.id]?.slug ?? null,
      }])
    );

    const rawPosts = await db.post.findMany({
      where: {
        pageId: { in: pageIds },
        visibility: "public",
        status: "active",
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        content: true,
        imageUrls: true,
        videoUrl: true,
        youtubeLinks: true,
        createdAt: true,
        pageId: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    const posts = rawPosts.map((p) => ({
      ...p,
      page: p.pageId ? (pageMap[p.pageId] ?? null) : null,
    }));

    return NextResponse.json({ ok: true, posts, userPincode: targetPincode });
  } catch (err: any) {
    console.error("GET /api/posts/local error:", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
