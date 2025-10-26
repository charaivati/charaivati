// app/api/auth/csrf/route.ts
import { NextResponse } from "next/server";
import { setCsrfCookie } from "@/lib/csrf";

export async function GET() {
  const res = NextResponse.json({ ok: true });
  const token = setCsrfCookie(res); // sets cookie & returns token
  // Optionally return it too (useful for forms)
  return NextResponse.json({ csrfToken: token }, { headers: res.headers });
}
