import { NextRequest, NextResponse } from "next/server";
import getServerUser from "@/lib/serverAuth";
import { mergeGuestToReal } from "@/lib/mergeGuest";

export async function POST(req: NextRequest) {
  const realUser = await getServerUser(req);
  if (!realUser)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { guestId } = await req.json().catch(() => ({}));
  if (!guestId)
    return NextResponse.json({ error: "guestId required" }, { status: 400 });

  try {
    await mergeGuestToReal(guestId, realUser.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[claim-guest] merge failed:", err);
    return NextResponse.json({ error: "Merge failed" }, { status: 500 });
  }
}
