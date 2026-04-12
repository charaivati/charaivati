//app/api/login/route.ts
// This unauthenticated login endpoint has been disabled.
// Use /api/auth/login which performs proper password verification.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
}
