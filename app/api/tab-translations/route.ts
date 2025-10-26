// app/api/tab-translations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const locale = (url.searchParams.get("locale") || "en").trim();
    const slugsParam = url.searchParams.get("slugs");
    const search = (url.searchParams.get("search") || "").trim();

    const where: any = {};
    if (slugsParam) {
      const slugs = slugsParam.split(",").map((s) => s.trim()).filter(Boolean);
      if (slugs.length) where.slug = { in: slugs };
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ];
    }

    const tabs = await prisma.tab.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { levelId: "asc" },
      take: 2000,
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        translations: {
          where: { locale },
          select: {
            id: true,
            locale: true,
            title: true,
            description: true,
            slug: true,
            autoTranslated: true,
            status: true,
          },
        },
      },
    });

    const payload = tabs.map((t) => ({
      tabId: t.id,
      slug: t.slug,
      enTitle: t.title,
      enDescription: t.description,
      translation: (t.translations && t.translations[0]) ?? null,
    }));

    const mapBySlug: Record<string, any> = {};
    payload.forEach((p) => {
      mapBySlug[p.slug] = { title: p.translation?.title ?? null, description: p.translation?.description ?? null, tabId: p.tabId };
    });

    return NextResponse.json({ ok: true, locale, data: payload, translations: mapBySlug }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    console.error("GET /api/tab-translations error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const locale = (body.locale || "").trim();
    const rows = Array.isArray(body.rows) ? (body.rows) : [];

    if (!locale) return NextResponse.json({ ok: false, error: "Missing locale" }, { status: 400 });
    if (rows.length === 0) return NextResponse.json({ ok: false, error: "No rows provided" }, { status: 400 });

    // local duplicate check
    const titleCounts = new Map();
    for (const r of rows) {
      const t = (r.title || "").trim();
      if (t) titleCounts.set(t, (titleCounts.get(t) || 0) + 1);
    }
    const localDups = Array.from(titleCounts.entries()).filter(([_, c]) => c > 1).map(([t]) => t);
    if (localDups.length) return NextResponse.json({ ok: false, error: "Duplicate titles in payload", duplicates: localDups }, { status: 400 });

    // conflict check vs DB
    const incomingTitles = rows.map((r) => (r.title || "").trim()).filter(Boolean);
    if (incomingTitles.length) {
      const existing = await prisma.tabTranslation.findMany({
        where: { locale, title: { in: incomingTitles } },
        select: { tabId: true, title: true },
      });
      const existingByTitle = new Map(existing.map((e) => [e.title, e.tabId]));
      const conflicts = [];
      for (const r of rows) {
        const t = (r.title || "").trim();
        const exTabId = existingByTitle.get(t);
        if (exTabId && exTabId !== r.tabId) conflicts.push({ title: t, existingTabId: exTabId, incomingTabId: r.tabId });
      }
      if (conflicts.length) return NextResponse.json({ ok: false, error: "Title conflicts with existing translations", conflicts }, { status: 409 });
    }

    const upserts = rows.map((r) =>
      prisma.tabTranslation.upsert({
        where: { tabId_locale: { tabId: r.tabId, locale } },
        update: {
          title: r.title ?? undefined,
          description: r.description ?? null,
          autoTranslated: !!r.autoTranslated,
          status: "published",
          updatedAt: new Date(),
        },
        create: {
          tabId: r.tabId,
          locale,
          title: r.title ?? "",
          description: r.description ?? null,
          autoTranslated: !!r.autoTranslated,
          status: "published",
        },
      })
    );

    await prisma.$transaction(upserts);
    return NextResponse.json({ ok: true, rows: rows.length }, { status: 200 });
  } catch (e: any) {
    console.error("POST /api/tab-translations error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
