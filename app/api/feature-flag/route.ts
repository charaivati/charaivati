// app/api/feature-flag/route.ts
import { NextResponse } from "next/server";
import { getFeatureFlagValue } from "@/lib/featureFlags";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");
    if (!key) return NextResponse.json({ ok: false, error: "missing key" }, { status: 400 });

    const enabled = await getFeatureFlagValue(key);
    return NextResponse.json({ ok: true, key, enabled });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "error" }, { status: 500 });
  }
}
