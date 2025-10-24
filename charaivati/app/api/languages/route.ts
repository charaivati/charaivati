// app/api/languages/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const langs = await prisma.language.findMany({
    where: { enabled: true },
    orderBy: { id: "asc" },
    select: { id: true, code: true, name: true },
  });

  return NextResponse.json({ ok: true, data: langs });
}

// Optional POST to add new language from UI
export async function POST(req: Request) {
  try {
    const { code, name } = await req.json();
    if (!code || !name) {
      return NextResponse.json({ ok: false, error: "Missing code or name" }, { status: 400 });
    }
    const existing = await prisma.language.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ ok: false, error: "Language already exists" }, { status: 409 });
    }
    const lang = await prisma.language.create({ data: { code, name } });
    return NextResponse.json({ ok: true, data: lang });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
