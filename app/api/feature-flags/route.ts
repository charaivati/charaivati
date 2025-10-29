// app/api/feature-flags/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const rows = await prisma.featureFlag.findMany({
      select: { key: true, enabled: true, meta: true },
    });

    const map: Record<string, { enabled: boolean; meta?: any }> = {};
    for (const r of rows) {
      map[r.key] = { enabled: !!r.enabled, meta: r.meta ?? null };
    }

    return NextResponse.json({ ok: true, flags: map }, { status: 200 });
  } catch (err) {
    console.error("feature-flags GET error:", err);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
