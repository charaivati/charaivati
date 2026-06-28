// app/api/admin/reviews/route.ts — read-only admin view of per-user profile
// reviews (UserContext kind="profile-review"). Gate mirrors /api/admin/context.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? process.env.ADMIN_ALERT_EMAIL;

export async function GET(req: Request) {
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await db.user.findUnique({ where: { id: payload.userId }, select: { email: true } });
  if (!ADMIN_EMAIL || !admin?.email || admin.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const reviews = await db.$queryRaw<{ userId: string; email: string | null; body: string; updatedAt: Date }[]>`
    SELECT uc."userId", u.email, uc."body", uc."updatedAt"
    FROM "UserContext" uc
    JOIN "User" u ON u.id = uc."userId"
    WHERE uc."kind" = 'profile-review'
    ORDER BY uc."updatedAt" DESC
    LIMIT 100`;

  return NextResponse.json({ reviews });
}
