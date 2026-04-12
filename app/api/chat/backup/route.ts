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
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// ── Server-side per-user AES-256-GCM key ──────────────────────────────────────

const BACKUP_SECRET = process.env.CHAT_BACKUP_SECRET;
if (!BACKUP_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("CHAT_BACKUP_SECRET environment variable must be set in production.");
  }
  console.warn("CHAT_BACKUP_SECRET is not set. Using insecure fallback — development only.");
}
const _backupSecret = BACKUP_SECRET ?? "dev_insecure_backup_fallback_not_for_prod";

function _deriveKey(userId: string): Buffer {
  // SHA-256(userId + ":" + secret) → 32-byte AES key.
  // Simple and fast; upgrade to HKDF if needed.
  return createHash("sha256").update(`${userId}:${_backupSecret}`).digest();
}

function _encrypt(key: Buffer, plaintext: string): { encrypted: string; iv: string } {
  const iv     = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc    = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag    = cipher.getAuthTag(); // 16-byte auth tag appended
  return {
    encrypted: Buffer.concat([enc, tag]).toString("base64"),
    iv:        iv.toString("base64"),
  };
}

function _decrypt(key: Buffer, encrypted: string, ivB64: string): string {
  const iv   = Buffer.from(ivB64, "base64");
  const data = Buffer.from(encrypted, "base64");
  const tag  = data.subarray(data.length - 16);
  const enc  = data.subarray(0, data.length - 16);
  const dec  = createDecipheriv("aes-256-gcm", key, iv);
  dec.setAuthTag(tag);
  return Buffer.concat([dec.update(enc), dec.final()]).toString("utf8");
}

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

    const key = _deriveKey(me.id);

    await db.$transaction(
      items
        .filter(it => it.messageId && typeof it.plaintext === "string")
        .map(it => {
          const { encrypted, iv } = _encrypt(key, it.plaintext);
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

    const key     = _deriveKey(me.id);
    const results: Record<string, string> = {};

    for (const row of rows) {
      try {
        results[row.messageId] = _decrypt(key, row.encrypted, row.iv);
      } catch { /* corrupt backup — skip */ }
    }

    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    console.error("GET /api/chat/backup error:", err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
