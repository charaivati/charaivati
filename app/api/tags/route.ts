import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const tabs = await prisma.tab.findMany({
      select: { slug: true, title: true },
      where: { is_default: true },
      orderBy: { title: "asc" },
    });

    const tags = tabs.map((t) => ({
      value: t.slug,
      label: t.title,
    }));

    return NextResponse.json({ ok: true, data: tags });
  } catch (e: any) {
    console.error("GET /api/tags error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}