// app/api/admin/users/route.ts
// Feature B — admin direct-create path.
// Restricted to emails in ADMIN_EMAILS env var (comma-separated).
// Creates a lite user with a temporary password; mustChangePassword = true.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";
import { hashPassword } from "@/lib/hash";
import { checkRateLimit } from "@/lib/rateLimit";

function getAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function POST(req: Request) {
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Server-side admin gate — never trust a client flag
  const admin = await db.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true },
  });
  const adminEmails = getAdminEmails();
  if (!admin?.email || !adminEmails.has(admin.email.toLowerCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Rate limit admin creation: max 50 per 24h per admin session
  const rl = await checkRateLimit(`admin-create:${admin.id}`, 50, 86400);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Admin creation limit reached for today." },
      { status: 429 }
    );
  }

  let body: { email?: string; tempPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawEmail = String(body.email || "").trim().toLowerCase();
  const tempPassword = String(body.tempPassword || "");

  if (!rawEmail || !rawEmail.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (tempPassword.length < 8) {
    return NextResponse.json(
      { error: "Temporary password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const existing = await db.user.findUnique({
    where: { email: rawEmail },
    select: { id: true },
  });
  if (existing) {
    // Enumeration-safe: don't say "email taken"
    return NextResponse.json({ error: "Could not create account." }, { status: 409 });
  }

  const passwordHash = await hashPassword(tempPassword);
  await db.user.create({
    data: {
      email: rawEmail,
      passwordHash,
      status: "lite",
      emailVerified: false,
      contactVerified: false,
      mustChangePassword: true,
      createdByAdminId: admin.id,
    },
  });

  console.info("[admin-create] account created", {
    byAdminId: admin.id,
    targetEmail: rawEmail,
    at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
