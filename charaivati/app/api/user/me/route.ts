// app/api/user/me/route.ts
import { NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/session";

export async function GET(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/session=([^;]+)/);
  const token = match ? decodeURIComponent(match[1]) : null;

  const payload = verifySessionToken(token);
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  return NextResponse.json({ ok: true, user: payload });
}
