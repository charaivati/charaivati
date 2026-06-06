// app/api/business/plan/[token]/route.ts
// Retired — BusinessPlan model removed in BIZDOC-1b. Use /api/business/documents instead.
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "This endpoint is retired. Use GET /api/business/documents instead." },
    { status: 410 }
  );
}
