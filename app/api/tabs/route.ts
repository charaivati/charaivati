// app/api/tabs/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const tabs = await prisma.tab.findMany({
      orderBy: { position: "asc" },
      include: {
        translations: true,
      },
      take: 1000,
    });

    const payload = tabs.map((t) => ({
      id: t.id,
      slug: t.slug,
      title: t.title,
      description: t.description,
      category: t.category,
      position: t.position,
      is_default: t.is_default,
      is_custom: t.is_custom,
      translations: t.translations.map((tr) => ({
        id: tr.id,
        locale: tr.locale,
        title: tr.title,
        description: tr.description,
        slug: tr.slug,
      })),
    }));

    return NextResponse.json({ ok: true, tabs: payload });
  } catch (err) {
    console.error("GET /api/tabs error", err);
    return NextResponse.json({ ok: false, error: "Failed to read tabs" }, { status: 500 });
  }
}
