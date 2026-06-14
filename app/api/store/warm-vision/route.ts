import { NextRequest, NextResponse } from "next/server";
import getServerUser from "@/lib/serverAuth";

// LOCAL-AI-FIX-1: menu-photo vision extraction now runs on cloud
// (MENU_VISION_MODEL via OpenRouter) — there is no local model to pre-warm.
// Kept as a no-op endpoint since the client fires this fire-and-forget on
// upload-start; removing it would require a client change for no benefit.
export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ warming: false });
}
