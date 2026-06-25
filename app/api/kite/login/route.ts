import { NextResponse } from "next/server";
import { kiteLoginUrl, kiteConfigured } from "@/lib/kite";

export async function GET() {
  if (!kiteConfigured()) {
    return NextResponse.json({ error: "Kite is not configured." }, { status: 500 });
  }
  return NextResponse.redirect(kiteLoginUrl());
}
