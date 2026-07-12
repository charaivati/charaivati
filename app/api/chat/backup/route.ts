// app/api/chat/backup/route.ts
//
// Server-side message backup for recovery when the client's ECDH keypair rotates.
// Each user's backups are encrypted with a per-user AES-256-GCM key derived from
// the server secret — the server can decrypt, but only for the authenticated user.
//
// POST /api/chat/backup
//   Body: { items: Array<{ messageId: string, plaintext: string }> }
//   Saves server-encrypted backups (fire-and-forget from the client).
//
// GET  /api/chat/backup?ids=id1,id2,...
//   Returns decrypted plaintext for each messageId the caller owns.
//   Only called when primary + history-key decryption have both failed.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { deriveUserKey, encryptWithUserKey, decryptWithUserKey } from "@/lib/server-crypto";

// ── POST — save backups ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentUser(req);
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const items: Array<{ messageId: string; plaintext: string }> = body?.items ?? [];

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ ok: false, error: "items[] required" }, { status: 400 });
    }

    const key = deriveUserKey(me.id);

    await db.$transaction(
      items
        .filter(it => it.messageId && typeof it.plaintext === "string")
        .map(it => {
          const { encrypted, iv } = encryptWithUserKey(key, it.plaintext);
          return db.chatMessageBackup.upsert({
            where:  { userId_messageId: { userId: me.id, messageId: it.messageId } },
            update: { encrypted, iv },
            create: { userId: me.id, messageId: it.messageId, encrypted, iv },
          });
        })
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("POST /api/chat/backup error:", err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}

// ── GET — recover backups ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const me = await getCurrentUser(req);
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const idsParam = req.nextUrl.searchParams.get("ids") ?? "";
    const ids = idsParam
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 100); // cap

    if (ids.length === 0) {
      return NextResponse.json({ ok: true, results: {} });
    }

    const rows = await db.chatMessageBackup.findMany({
      where: { userId: me.id, messageId: { in: ids } },
      select: { messageId: true, encrypted: true, iv: true },
    });

    const key     = deriveUserKey(me.id);
    const results: Record<string, string> = {};

    for (const row of rows) {
      try {
        results[row.messageId] = decryptWithUserKey(key, row.encrypted, row.iv);
      } catch { /* corrupt backup — skip */ }
    }

    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    console.error("GET /api/chat/backup error:", err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
