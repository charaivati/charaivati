// app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/session";

type ApiEnvelope = { ok?: boolean; error?: string };

export async function POST(): Promise<NextResponse<ApiEnvelope>> {
  const response = new NextResponse<ApiEnvelope>(
    JSON.stringify({ ok: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );

  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}