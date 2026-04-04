// app/api/keys/route.ts — store and retrieve ECDH public keys for E2E encrypted chat
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * GET /api/keys?userId=xxx
 * Returns the stored ECDH public key (JWK) for the given userId.
 * Omit userId to get the current user's own key.
 */
export async function GET(req: NextRequest) {
  try {
    const me = await getCurrentUser(req);
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const targetId = req.nextUrl.searchParams.get("userId") ?? me.id;

    const row = await db.userPublicKey.findUnique({ where: { userId: targetId } });
    if (!row) return NextResponse.json({ ok: false, error: "No key found" }, { status: 404 });

    return NextResponse.json({ ok: true, publicKey: JSON.parse(row.publicKey) });
  } catch (err: any) {
    console.error("GET /api/keys error:", err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}

/**
 * POST /api/keys
 * Body: { publicKey: JsonWebKey }
 * Upserts the current user's ECDH public key.
 */
export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentUser(req);
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (!body?.publicKey || typeof body.publicKey !== "object") {
      return NextResponse.json({ ok: false, error: "publicKey required" }, { status: 400 });
    }

    await db.userPublicKey.upsert({
      where: { userId: me.id },
      create: { userId: me.id, publicKey: JSON.stringify(body.publicKey) },
      update: { publicKey: JSON.stringify(body.publicKey) },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("POST /api/keys error:", err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
