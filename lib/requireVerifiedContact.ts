// lib/requireVerifiedContact.ts
// Guard for Earn-layer money actions (store payout setup, GST invoicing).
// contactVerified = true means the user's inbox ownership has been proven:
//   - Invite claim sets it immediately (clicked emailed link)
//   - Admin-created accounts leave it false until a future OTP/verification flow
// Usage:
//   const block = await requireVerifiedContact(req);
//   if (block) return block;
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";

export async function requireVerifiedContact(
  req: Request
): Promise<NextResponse | null> {
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { contactVerified: true },
  });

  if (!user?.contactVerified) {
    return NextResponse.json(
      {
        error: "contact_unverified",
        message: "Please verify your contact details before accessing this feature.",
      },
      { status: 403 }
    );
  }

  return null;
}
