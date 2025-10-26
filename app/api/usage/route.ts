// app/api/usage/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromReq } from "@/lib/auth";

export async function POST(req: NextRequest) {
  // Accept batch of usage records
  // body: { records: [{ section, durationMs, interactions, startedAt, endedAt }] }
  const user = await getUserFromReq(req);
  const body = await req.json();
  const records = body.records ?? [];

  // allow anonymous usage if user not signed in: set userId null
  const userId = user?.id ?? null;

  const createOps = records.map((r: any) =>
    prisma.usageLog.create({
      data: {
        userId,
        section: r.section,
        durationMs: r.durationMs ?? 0,
        interactions: r.interactions ?? 0,
        startedAt: r.startedAt ? new Date(r.startedAt) : new Date(),
        endedAt: r.endedAt ? new Date(r.endedAt) : new Date(),
      },
    })
  );

  try {
    await Promise.all(createOps);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("usage ingestion error", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
