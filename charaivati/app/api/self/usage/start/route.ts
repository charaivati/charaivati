// app/api/self/usage/start/route.ts
import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/session";
import { createUsageLog } from "@/lib/analytics";

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  const body = await req.json().catch(()=>({}));
  const section = String(body.section ?? "unknown").slice(0, 64);

  const rec = await createUsageLog({ userId: user?.id ?? null, section, startedAt: body.startedAt ? new Date(body.startedAt) : undefined });
  return NextResponse.json({ ok: true, data: { id: rec.id, startedAt: rec.startedAt } });
}
