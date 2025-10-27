// app/api/tab-translations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type IncomingRow = {
  tabId: string; // Prisma Tab.id is a string (cuid)
  title?: string | null;
  description?: string | null;
  autoTranslated?: boolean | null;
};

function normalizeStr(s: any): string {
  if (s == null) return "";
  return String(s).trim();
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const locale = normalizeStr(url.searchParams.get("locale") || "en");
    const slugsParam = url.searchParams.get("slugs") || "";
    const search = normalizeStr(url.searchParams.get("search") || "");

    // Validate locale exists (Language.code)
    const langExists = await prisma.language.findUnique({ where: { code: locale } });
    if (!langExists && locale !== "en") {
      return NextResponse.json({ ok: false, error: "Unknown locale" }, { status: 400 });
    }

    const where: any = {};
    if (slugsParam) {
      const slugs = slugsParam.split(",").map((s) => String(s).trim()).filter(Boolean);
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

    const mapBySlug: Record<string, { title: string | null; description: string | null; tabId: string }> = {};
    for (const p of payload) {
      mapBySlug[p.slug] = {
        title: p.translation?.title ?? null,
        description: p.translation?.description ?? null,
        tabId: p.tabId,
      };
    }

    return NextResponse.json(
      { ok: true, locale, data: payload, translations: mapBySlug },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    console.error("GET /api/tab-translations error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const locale = normalizeStr(body.locale || "");
    const rows = Array.isArray(body.rows) ? (body.rows as IncomingRow[]) : [];

    if (!locale) return NextResponse.json({ ok: false, error: "Missing locale" }, { status: 400 });
    if (!rows.length) return NextResponse.json({ ok: false, error: "No rows provided" }, { status: 400 });

    // Ensure locale exists in Language table (optional)
    const lang = await prisma.language.findUnique({ where: { code: locale } });
    if (!lang && locale !== "en") {
      return NextResponse.json({ ok: false, error: "Unknown locale" }, { status: 400 });
    }

    // Local duplicate title check
    const titleCounts = new Map<string, number>();
    for (const r of rows) {
      const t = normalizeStr(r.title);
      if (t) titleCounts.set(t, (titleCounts.get(t) || 0) + 1);
    }
    const localDups = Array.from(titleCounts.entries()).filter(([_, c]) => c > 1).map(([t]) => t);
    if (localDups.length) {
      return NextResponse.json({ ok: false, error: "Duplicate titles in payload", duplicates: localDups }, { status: 400 });
    }

    // DB conflict check (existing translations with same title for this locale)
    const incomingTitles = rows.map((r) => normalizeStr(r.title)).filter(Boolean);
    if (incomingTitles.length) {
      const existing = await prisma.tabTranslation.findMany({
        where: { locale, title: { in: incomingTitles } },
        select: { tabId: true, title: true },
      });
      const existingByTitle = new Map(existing.map((e) => [e.title, e.tabId]));
      const conflicts: Array<{ title: string; existingTabId: string; incomingTabId: string }> = [];
      for (const r of rows) {
        const t = normalizeStr(r.title);
        const exTabId = existingByTitle.get(t);
        if (exTabId && exTabId !== r.tabId) conflicts.push({ title: t, existingTabId: exTabId, incomingTabId: r.tabId });
      }
      if (conflicts.length) {
        return NextResponse.json({ ok: false, error: "Title conflicts with existing translations", conflicts }, { status: 409 });
      }
    }

    // Prepare upserts (tabId is string)
    const upserts = rows.map((r) => {
      const safeTitle = r.title ?? "";
      const safeDescription = r.description ?? null;
      return prisma.tabTranslation.upsert({
        where: { tabId_locale: { tabId: r.tabId, locale } },
        update: {
          title: safeTitle,
          description: safeDescription,
          autoTranslated: !!r.autoTranslated,
          status: "published",
          updatedAt: new Date(),
        },
        create: {
          tabId: r.tabId,
          locale,
          title: safeTitle,
          description: safeDescription,
          autoTranslated: !!r.autoTranslated,
          status: "published",
        },
      });
    });

    await prisma.$transaction(upserts);
    return NextResponse.json({ ok: true, rows: rows.length }, { status: 200 });
  } catch (e: any) {
    console.error("POST /api/tab-translations error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
