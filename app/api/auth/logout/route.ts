// app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";

type ApiEnvelope = { ok?: boolean; error?: string; deletionScheduledAt?: string };

export async function POST(): Promise<NextResponse<ApiEnvelope>> {
  // use typed envelope everywhere so TS stays consistent across branches
  let res = NextResponse.json<ApiEnvelope>({ ok: true });
  res = clearSessionCookie(res);
  return res;
}
