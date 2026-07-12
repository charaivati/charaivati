// app/api/keys/route.ts — store and retrieve ECDH public keys for E2E encrypted chat
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

const MAX_HISTORY = 10;

function _parseHistory(raw: string | null | undefined): string[] {
  try {
    const arr = JSON.parse(raw ?? "[]");
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

/**
 * GET /api/keys?userId=xxx[&history=1]
 * Returns the stored ECDH public key (JWK) for the given userId.
 * Omit userId to get the current user's own key.
 * With history=1 also returns previous public keys (newest first) so the
 * client can decrypt messages encrypted before this user rotated keys.
 */
export async function GET(req: NextRequest) {
  try {
    const me = await getCurrentUser(req);
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const targetId = req.nextUrl.searchParams.get("userId") ?? me.id;
    const wantHistory = req.nextUrl.searchParams.get("history") === "1";

    const row = await db.userPublicKey.findUnique({ where: { userId: targetId } });
    if (!row) return NextResponse.json({ ok: false, error: "No key found" }, { status: 404 });

    const payload: Record<string, unknown> = { ok: true, publicKey: JSON.parse(row.publicKey) };
    if (wantHistory) {
      payload.history = _parseHistory(row.keyHistory)
        .map((s) => { try { return JSON.parse(s); } catch { return null; } })
        .filter(Boolean);
    }
    return NextResponse.json(payload);
  } catch (err: any) {
    console.error("GET /api/keys error:", err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}

/**
 * POST /api/keys
 * Body: { publicKey: JsonWebKey }
 * Upserts the current user's ECDH public key. When the key actually changes
 * (rotation), the previous key is archived into keyHistory so friends can
 * still decrypt messages encrypted against it.
 */
export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentUser(req);
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (!body?.publicKey || typeof body.publicKey !== "object") {
      return NextResponse.json({ ok: false, error: "publicKey required" }, { status: 400 });
    }

    const publicKey = JSON.stringify(body.publicKey);
    const existing = await db.userPublicKey.findUnique({ where: { userId: me.id } });

    if (!existing) {
      await db.userPublicKey.create({ data: { userId: me.id, publicKey } });
    } else if (existing.publicKey !== publicKey) {
      // Key rotation — archive the old public key (dedup, cap history).
      const history = [
        existing.publicKey,
        ..._parseHistory(existing.keyHistory).filter((k) => k !== existing.publicKey),
      ]
        .filter((k) => k !== publicKey)
        .slice(0, MAX_HISTORY);
      await db.userPublicKey.update({
        where: { userId: me.id },
        data: { publicKey, keyHistory: JSON.stringify(history) },
      });
    }
    // Unchanged key — nothing to write.

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("POST /api/keys error:", err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
