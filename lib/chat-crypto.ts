/**
 * lib/chat-crypto.ts — Client-side singleton crypto module.
 *
 * Design goals (per performance review):
 *  1. ensureKeyPair()      — runs once at startup; no-ops if key already exists.
 *  2. loadPrivateKey()     — imports pkcs8 from localStorage exactly once per
 *                            session; caches the CryptoKey in a module variable.
 *  3. getSharedKey()       — derives the AES-GCM shared key via ECDH and caches
 *                            it in a Map<friendId, CryptoKey>; never re-derives.
 *  4. getFriendPublicKey() — fetches /api/keys?userId=X and caches the result
 *                            in localStorage for 24 hours.
 *
 * Wire format is unchanged: ciphertext + iv as base64 strings.
 * Algorithm is unchanged:   ECDH P-256 + AES-GCM 256.
 * The server remains zero-knowledge.
 */

const ECDH_ALGO    = { name: "ECDH", namedCurve: "P-256" } as const;
const LS_PRIVKEY   = "charaivati_privkey_pkcs8";  // base64-encoded pkcs8
const LS_OLD_KP    = "charaivati_chat_keypair";   // legacy JWK format (migration)
const LS_PUB_PFX   = "pubkey_";                  // pubkey_{friendId}
const TTL_MS       = 24 * 60 * 60 * 1000;        // 24 h friend-key cache

// ── Module-level singletons ────────────────────────────────────────────────────
let _privateKey: CryptoKey | null = null;
const _sharedKeys = new Map<string, CryptoKey>();

// ── ensureKeyPair ──────────────────────────────────────────────────────────────
/**
 * Call once at startup (e.g. in the ChatPanel mount effect).
 * • Migrates old JWK-based key to pkcs8 format if present.
 * • Generates a new keypair only when nothing is stored.
 * • Uploads the public key to /api/keys (idempotent upsert on the server).
 * • Warms the private-key cache so the first message send has no cold start.
 */
export async function ensureKeyPair(): Promise<void> {
  await _migrateOldKey();

  if (localStorage.getItem(LS_PRIVKEY)) {
    // Already set up — warm the cache so sendMessage has no cold start.
    await loadPrivateKey();
    return;
  }

  // Generate fresh P-256 keypair.
  const pair = await crypto.subtle.generateKey(ECDH_ALGO, true, ["deriveKey"]);

  // Store private key as pkcs8 (more compact / standard than JWK).
  const pkcs8Buf = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
  localStorage.setItem(LS_PRIVKEY, _toBase64(pkcs8Buf));
  _privateKey = pair.privateKey; // cache immediately

  // Upload public key (JWK) to server — server never sees private key.
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  await fetch("/api/keys", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicKey: publicJwk }),
  });
}

// ── loadPrivateKey ─────────────────────────────────────────────────────────────
/**
 * Imports the pkcs8 private key from localStorage exactly once per session.
 * Subsequent calls return the in-memory CryptoKey without touching localStorage.
 */
export async function loadPrivateKey(): Promise<CryptoKey> {
  if (_privateKey) return _privateKey;

  const stored = localStorage.getItem(LS_PRIVKEY);
  if (!stored) throw new Error("No private key found. Call ensureKeyPair() first.");

  const pkcs8Bytes = _fromBase64(stored);
  _privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8Bytes,
    ECDH_ALGO,
    false,          // not extractable — stays in memory only
    ["deriveKey"]
  );
  return _privateKey;
}

// ── getFriendPublicKey ─────────────────────────────────────────────────────────
/**
 * Returns the friend's ECDH public key (JWK).
 * Cache: localStorage entry `pubkey_{friendId}` with a 24-hour TTL.
 * Only hits the network on cache miss or expiry.
 */
export async function getFriendPublicKey(friendId: string): Promise<JsonWebKey> {
  const cacheKey = `${LS_PUB_PFX}${friendId}`;

  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      const { jwk, ts } = JSON.parse(raw) as { jwk: JsonWebKey; ts: number };
      if (Date.now() - ts < TTL_MS) return jwk;
    }
  } catch { /* stale / corrupt — fall through to network */ }

  const res  = await fetch(`/api/keys?userId=${friendId}`, { credentials: "include" });
  const data = await res.json().catch(() => null);
  if (!data?.ok || !data.publicKey) throw new Error("Friend public key unavailable");

  const jwk = data.publicKey as JsonWebKey;
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ jwk, ts: Date.now() }));
  } catch { /* quota exceeded — non-fatal */ }
  return jwk;
}

// ── getSharedKey ───────────────────────────────────────────────────────────────
/**
 * Derives an AES-GCM-256 shared key from our private key and the friend's
 * public key using ECDH. The result is cached per friendId; derivation runs
 * exactly once per session regardless of how many messages are sent.
 */
export async function getSharedKey(
  friendId: string,
  theirPublicJwk: JsonWebKey
): Promise<CryptoKey> {
  const cached = _sharedKeys.get(friendId);
  if (cached) return cached;

  console.time("crypto:derive");
  const myPrivate   = await loadPrivateKey();
  const theirPublic = await crypto.subtle.importKey(
    "jwk",
    theirPublicJwk,
    ECDH_ALGO,
    false,
    []
  );
  const sk = await crypto.subtle.deriveKey(
    { name: "ECDH", public: theirPublic },
    myPrivate,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  console.timeEnd("crypto:derive");

  _sharedKeys.set(friendId, sk);
  return sk;
}

// ── encryptMessage ─────────────────────────────────────────────────────────────
export async function encryptMessage(
  key: CryptoKey,
  plaintext: string
): Promise<{ ciphertext: string; iv: string }> {
  console.time("crypto:encrypt");
  const iv        = crypto.getRandomValues(new Uint8Array(12));
  const encoded   = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const result    = { ciphertext: _toBase64(encrypted), iv: _toBase64(iv) };
  console.timeEnd("crypto:encrypt");
  return result;
}

// ── decryptMessage ─────────────────────────────────────────────────────────────
export async function decryptMessage(
  key: CryptoKey,
  ciphertext: string,
  iv: string
): Promise<string> {
  console.time("crypto:decrypt");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: _fromBase64(iv) },
    key,
    _fromBase64(ciphertext)
  );
  const result = new TextDecoder().decode(decrypted);
  console.timeEnd("crypto:decrypt");
  return result;
}

// ── Migration: JWK → pkcs8 ────────────────────────────────────────────────────
async function _migrateOldKey(): Promise<void> {
  if (localStorage.getItem(LS_PRIVKEY)) return; // already on new format
  const oldRaw = localStorage.getItem(LS_OLD_KP);
  if (!oldRaw) return;

  try {
    const { privateJwk, publicJwk } = JSON.parse(oldRaw) as {
      privateJwk: JsonWebKey;
      publicJwk: JsonWebKey;
    };

    // Re-import and re-export as pkcs8.
    const privKey  = await crypto.subtle.importKey("jwk", privateJwk, ECDH_ALGO, true, ["deriveKey"]);
    const pkcs8Buf = await crypto.subtle.exportKey("pkcs8", privKey);
    localStorage.setItem(LS_PRIVKEY, _toBase64(pkcs8Buf));
    _privateKey = privKey;

    // Re-upload public key to ensure server has it (already idempotent).
    await fetch("/api/keys", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicKey: publicJwk }),
    });

    localStorage.removeItem(LS_OLD_KP);
  } catch {
    // Old key corrupt — remove it; ensureKeyPair will generate a new one.
    localStorage.removeItem(LS_OLD_KP);
  }
}

// ── Internal base64 helpers ────────────────────────────────────────────────────
function _toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes));
}

function _fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// ── Legacy exports (kept so any remaining callers don't break) ─────────────────
/** @deprecated Use ensureKeyPair() + getSharedKey() instead */
export type KeyPair = { publicJwk: JsonWebKey; privateJwk: JsonWebKey };

/** @deprecated */
export async function getOrCreateKeyPair(): Promise<KeyPair> {
  await ensureKeyPair();
  // Private JWK is no longer stored; return a stub so callers don't crash.
  return { publicJwk: {} as JsonWebKey, privateJwk: {} as JsonWebKey };
}

/** @deprecated Use getSharedKey() instead */
export async function deriveSharedKey(
  myPrivateJwk: JsonWebKey,
  theirPublicJwk: JsonWebKey
): Promise<CryptoKey> {
  const myPrivate   = await crypto.subtle.importKey("jwk", myPrivateJwk, ECDH_ALGO, false, ["deriveKey"]);
  const theirPublic = await crypto.subtle.importKey("jwk", theirPublicJwk, ECDH_ALGO, false, []);
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: theirPublic },
    myPrivate,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
