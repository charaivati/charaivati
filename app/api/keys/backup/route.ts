// app/api/keys/backup/route.ts
//
// Server-side backup of the user's chat ECDH keypair, so a new device or a
// cleared browser (private windows, storage wipes) restores the SAME chat
// identity instead of rotating to a fresh keypair — rotation is what makes
// old messages undecryptable ("Encrypted with a previous key").
//
// The blob { privkey, publicJwk, history } is encrypted per-user with a key
// derived from the server secret (see lib/server-crypto.ts). Like
// ChatMessageBackup this is recoverable encryption, not strict E2E: the
// server can decrypt, but a database leak alone cannot.
//
// POST /api/keys/backup
//   Body: { privkey: string (base64 pkcs8), publicJwk: JsonWebKey, history?: string[] }
//   Merges with any existing backup: if the stored private key differs from
//   the incoming one, the stored key is preserved in history so no key that
//   ever encrypted a message is lost.
//
// GET /api/keys/backup
//   Returns { ok, backup: { privkey, publicJwk, history } } or 404.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { deriveUserKey, encryptWithUserKey, decryptWithUserKey } from "@/lib/server-crypto";

const MAX_HISTORY = 10;
const MAX_KEY_LEN = 4096; // base64 pkcs8 for P-256 is ~250 chars — generous cap

type KeyBackupBlob = {
  privkey: string;        // base64-encoded pkcs8
  publicJwk: JsonWebKey;  // matching public key
  history: string[];      // previous base64 pkcs8 keys, newest first
};

function _readBlob(key: Buffer, encrypted: string, iv: string): KeyBackupBlob | null {
  try {
    const blob = JSON.parse(decryptWithUserKey(key, encrypted, iv));
    if (typeof blob?.privkey !== "string") return null;
    return {
      privkey: blob.privkey,
      publicJwk: blob.publicJwk ?? {},
      history: Array.isArray(blob.history) ? blob.history : [],
    };
  } catch {
    return null; // corrupt / secret changed — treat as no backup
  }
}

export async function GET(req: NextRequest) {
  try {
    const me = await getCurrentUser(req);
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const row = await db.userKeyBackup.findUnique({ where: { userId: me.id } });
    if (!row) return NextResponse.json({ ok: false, error: "No backup" }, { status: 404 });

    const blob = _readBlob(deriveUserKey(me.id), row.encrypted, row.iv);
    if (!blob) return NextResponse.json({ ok: false, error: "No backup" }, { status: 404 });

    return NextResponse.json({ ok: true, backup: blob });
  } catch (err: any) {
    console.error("GET /api/keys/backup error:", err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentUser(req);
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const privkey = typeof body?.privkey === "string" ? body.privkey.trim() : "";
    const publicJwk = body?.publicJwk;
    const incomingHistory: string[] = Array.isArray(body?.history)
      ? body.history.filter((h: unknown) => typeof h === "string" && (h as string).length <= MAX_KEY_LEN)
      : [];

    if (!privkey || privkey.length > MAX_KEY_LEN || !publicJwk || typeof publicJwk !== "object") {
      return NextResponse.json({ ok: false, error: "privkey and publicJwk required" }, { status: 400 });
    }

    const key = deriveUserKey(me.id);

    // Merge with the existing backup so a stale device overwriting the blob
    // can never drop a private key that other messages still depend on.
    const existing = await db.userKeyBackup.findUnique({ where: { userId: me.id } });
    const prev = existing ? _readBlob(key, existing.encrypted, existing.iv) : null;

    const history: string[] = [];
    const seen = new Set<string>([privkey]);
    for (const h of [
      ...(prev && prev.privkey !== privkey ? [prev.privkey] : []),
      ...incomingHistory,
      ...(prev?.history ?? []),
    ]) {
      if (!seen.has(h)) { seen.add(h); history.push(h); }
      if (history.length >= MAX_HISTORY) break;
    }

    const blob: KeyBackupBlob = { privkey, publicJwk, history };
    const { encrypted, iv } = encryptWithUserKey(key, JSON.stringify(blob));

    await db.userKeyBackup.upsert({
      where:  { userId: me.id },
      update: { encrypted, iv },
      create: { userId: me.id, encrypted, iv },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("POST /api/keys/backup error:", err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
