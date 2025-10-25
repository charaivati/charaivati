// app/api/self/usage/end/route.ts
import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/session";
import { endUsageLog } from "@/lib/analytics";

export async function POST(req: Request) {
  const user = await getUserFromRequest(req); // optional
  const body = await req.json().catch(()=>({}));
  if (!body.usageId) return NextResponse.json({ ok: false, error: "usageId required" }, { status: 400 });

  try {
    const rec = await endUsageLog({ usageId: String(body.usageId), endedAt: body.endedAt ? new Date(body.endedAt) : undefined, interactions: body.interactions });
    return NextResponse.json({ ok: true, data: rec });
  } catch (err: any) {
    console.error("end usage error", err);
    return NextResponse.json({ ok: false, error: err?.message || "Server error" }, { status: 500 });
  }
}
