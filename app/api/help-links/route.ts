// app/api/help-links/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

/** safe admin check */
function isAdmin(user: any | null) {
  if (!user || !user.email) return false;
  const env = (process.env.EMAIL_USER || "").toLowerCase();
  return !!env && user.email.toLowerCase() === env;
}

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const pageSlug = url.searchParams.get("pageSlug")?.trim() || undefined;
    const tabSlug = url.searchParams.get("tabSlug")?.trim() || undefined;
    const tabSlugsParam = url.searchParams.get("tabSlugs")?.trim() || undefined;
    const country = url.searchParams.get("country")?.trim() || undefined;
    const q = url.searchParams.get("q")?.trim() || undefined;

    const where: any = {};
    if (pageSlug) where.pageSlug = pageSlug;
    if (country) where.country = country;
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { url: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
      ];
    }

    // ✅ FIXED: Handle both tabSlug (single) and tabSlugs (multiple) correctly
    if (tabSlug) {
      where.slugTags = { has: tabSlug };
    } else if (tabSlugsParam) {
      const slugs = tabSlugsParam
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);

      if (slugs.length) {
        // ✅ Use OR logic: match ANY of the slugs (not all)
        where.OR = slugs.map((slug: string) => ({
          slugTags: { has: slug },
        }));
      }
    }

    const links = await prisma.helpLink.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, data: links });
  } catch (e: any) {
    console.error("GET /api/help-links", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!isAdmin(user)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { pageSlug, country, title, url, notes, slugTags = [] } = body || {};

    if (!title || !url) {
      return NextResponse.json(
        { ok: false, error: "title and url are required" },
        { status: 400 }
      );
    }

    // Validate slugTags: only keep canonical Tab.slug
    const incoming = Array.isArray(slugTags)
      ? slugTags
          .map((s: any) => String(s))
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];

    let validTags: string[] = [];
    if (incoming.length) {
      const found = await prisma.tab.findMany({
        where: { slug: { in: incoming } },
        select: { slug: true },
      });
      validTags = found.map((t) => t.slug);
      if (incoming.length && validTags.length === 0) {
        return NextResponse.json(
          { ok: false, error: "No valid tab slugs provided in slugTags" },
          { status: 400 }
        );
      }
    }

    const created = await prisma.helpLink.create({
      data: {
        pageSlug: pageSlug || null,
        slugTags: validTags,
        country: country || "All",
        title,
        url,
        notes: notes ?? null,
        createdBy: user?.id ?? null,
      },
    });

    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/help-links", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}