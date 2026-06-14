import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public, read-only — powers the owner-side category/tag picker (and, later,
// the customer-facing discovery filter). No auth required.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const locale = (url.searchParams.get("locale") || "en").trim() || "en";

  const [categories, tags] = await Promise.all([
    prisma.storeCategory.findMany({
      orderBy: { order: "asc" },
      include: {
        translations: { where: { locale: { in: [locale, "en"] } } },
      },
    }),
    prisma.storeTag.findMany({
      orderBy: { order: "asc" },
      include: {
        translations: { where: { locale: { in: [locale, "en"] } } },
      },
    }),
  ]);

  const categoriesOut = categories.map((c) => {
    const t = c.translations.find((tr) => tr.locale === locale);
    const en = c.translations.find((tr) => tr.locale === "en");
    return {
      id: c.id,
      slug: c.slug,
      title: t?.title ?? en?.title ?? c.slug,
      description: t?.description ?? en?.description ?? null,
    };
  });

  const tagsOut = tags.map((tg) => {
    const t = tg.translations.find((tr) => tr.locale === locale);
    const en = tg.translations.find((tr) => tr.locale === "en");
    return {
      id: tg.id,
      slug: tg.slug,
      title: t?.title ?? en?.title ?? tg.slug,
    };
  });

  return NextResponse.json(
    { categories: categoriesOut, tags: tagsOut },
    { headers: { "Cache-Control": "no-store" } }
  );
}
