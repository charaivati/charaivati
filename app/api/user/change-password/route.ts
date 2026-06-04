// app/api/user/change-password/route.ts
// Used for two cases:
//   1. mustChangePassword enforcement — admin-created accounts must set a new password on first login.
//   2. Voluntary password change by any authenticated user.
// Clears mustChangePassword on success.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/hash";

export async function POST(req: Request) {
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { newPassword?: string; currentPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const newPassword = String(body.newPassword || "");
  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, passwordHash: true, mustChangePassword: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // For voluntary change (not forced): require current password
  if (!user.mustChangePassword) {
    const currentPassword = String(body.currentPassword || "");
    if (!currentPassword) {
      return NextResponse.json(
        { error: "Current password required" },
        { status: 400 }
      );
    }
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "No password set on this account" },
        { status: 400 }
      );
    }
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Current password incorrect" }, { status: 403 });
    }
  }

  const newHash = await hashPassword(newPassword);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash, mustChangePassword: false },
  });

  return NextResponse.json({ ok: true });
}
