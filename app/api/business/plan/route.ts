// app/api/business/plan/route.ts
// Retired — BusinessPlan model removed in BIZDOC-1b. Use /api/business/documents instead.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "This endpoint is retired. Use POST /api/business/documents instead." },
    { status: 410 }
  );
}
