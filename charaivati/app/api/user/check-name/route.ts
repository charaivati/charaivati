// app/api/user/check-name/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function sanitize(n?: string) {
  return (n || "").trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const nameRaw = sanitize(body?.name);
    if (!nameRaw) return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });

    // case-insensitive check
    const found = await prisma.user.findFirst({
      where: { name: { equals: nameRaw, mode: "insensitive" } },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, available: !found });
  } catch (err: any) {
    console.error("check-name error:", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
