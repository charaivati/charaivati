import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { ok: false, error: "feature flags are no longer used" },
    { status: 410 },
  );
}
