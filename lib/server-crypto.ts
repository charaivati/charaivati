// lib/server-crypto.ts — per-user AES-256-GCM helpers for server-side backups.
//
// Used by /api/chat/backup (message plaintext backup) and /api/keys/backup
// (chat keypair backup). Each user's data is encrypted with a key derived
// from the server secret, so a database leak alone does not expose it, but
// the server itself CAN decrypt — this is recoverable encryption, not E2E.
//
// The derivation MUST stay `sha256(userId + ":" + secret)` — existing
// ChatMessageBackup rows were encrypted with exactly this key.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const BACKUP_SECRET = process.env.CHAT_BACKUP_SECRET;
if (!BACKUP_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("CHAT_BACKUP_SECRET environment variable must be set in production.");
  }
  console.warn("CHAT_BACKUP_SECRET is not set. Using insecure fallback — development only.");
}
const _backupSecret = BACKUP_SECRET ?? "dev_insecure_backup_fallback_not_for_prod";

/** SHA-256(userId + ":" + secret) → 32-byte AES key. */
export function deriveUserKey(userId: string): Buffer {
  return createHash("sha256").update(`${userId}:${_backupSecret}`).digest();
}

/** AES-256-GCM encrypt; 16-byte auth tag is appended to the ciphertext. */
export function encryptWithUserKey(key: Buffer, plaintext: string): { encrypted: string; iv: string } {
  const iv     = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc    = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return {
    encrypted: Buffer.concat([enc, tag]).toString("base64"),
    iv:        iv.toString("base64"),
  };
}

export function decryptWithUserKey(key: Buffer, encrypted: string, ivB64: string): string {
  const iv   = Buffer.from(ivB64, "base64");
  const data = Buffer.from(encrypted, "base64");
  const tag  = data.subarray(data.length - 16);
  const enc  = data.subarray(0, data.length - 16);
  const dec  = createDecipheriv("aes-256-gcm", key, iv);
  dec.setAuthTag(tag);
  return Buffer.concat([dec.update(enc), dec.final()]).toString("utf8");
}
