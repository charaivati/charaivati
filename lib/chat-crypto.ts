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
const LS_PUBKEY    = "charaivati_pubkey_jwk";     // JSON-stringified JWK (for re-upload)
const LS_OLD_KP    = "charaivati_chat_keypair";   // legacy JWK format (migration)
const LS_PUB_PFX   = "pubkey_";                  // pubkey_{friendId}
const TTL_MS       = 30 * 60 * 1000;             // 30 min friend-key cache (was 24 h)
const LS_CACHE_VER = "charaivati_cache_ver";
const CACHE_VERSION = "v3";                       // bump this after any key-format change

// ── Key history — keeps the last N private keys so old messages can still decrypt
//    after a keypair rotation (e.g. localStorage clear, migration, device change).
const LS_KEY_HISTORY  = "charaivati_privkey_history"; // JSON array of base64 pkcs8 strings
const MAX_KEY_HISTORY = 5;

// ── Module-level singletons ────────────────────────────────────────────────────
let _privateKey: CryptoKey | null = null;
const _sharedKeys = new Map<string, CryptoKey>();
// Cached shared keys derived from historical private keys — keyed as `friendId:histN`.
const _historicalSharedKeys = new Map<string, CryptoKey>();

// ── ensureKeyPair ──────────────────────────────────────────────────────────────
/**
 * Call once at startup (e.g. in the ChatPanel mount effect).
 * • Migrates old JWK-based key to pkcs8 format if present.
 * • Generates a new keypair only when nothing is stored.
 * • Uploads the public key to /api/keys (idempotent upsert on the server).
 * • Warms the private-key cache so the first message send has no cold start.
 */
export async function ensureKeyPair(): Promise<void> {
  // Version-gate: wipe stale friend key cache on version mismatch.
  if (localStorage.getItem(LS_CACHE_VER) !== CACHE_VERSION) {
    _clearFriendKeyCache();
    localStorage.setItem(LS_CACHE_VER, CACHE_VERSION);
  }

  await _migrateOldKey();

  const hasPriv = !!localStorage.getItem(LS_PRIVKEY);
  const hasPub  = !!localStorage.getItem(LS_PUBKEY);

  if (hasPriv && hasPub) {
    // Both keys present — warm private-key cache, re-upload public key to server.
    try {
      await loadPrivateKey();
    } catch {
      // Stored key is corrupt — wipe and regenerate.
      _wipeOwnKeys();
      return _generateAndUploadKeyPair();
    }
    _reuploadPublicKey().catch(() => {}); // non-blocking, best-effort
    return;
  }

  if (hasPriv && !hasPub) {
    // Private key exists but public key is missing from localStorage.
    // The CryptoKey is non-extractable so we can't recover the JWK.
    // Safest: regenerate so the server gets a fresh public key.
    _wipeOwnKeys();
    return _generateAndUploadKeyPair();
  }

  // No private key — fresh setup.
  return _generateAndUploadKeyPair();
}

// ── Internal helpers ───────────────────────────────────────────────────────────

async function _generateAndUploadKeyPair(): Promise<void> {
  const pair = await crypto.subtle.generateKey(ECDH_ALGO, true, ["deriveKey"]);

  const pkcs8Buf = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
  localStorage.setItem(LS_PRIVKEY, _toBase64(pkcs8Buf));
  _privateKey = pair.privateKey;

  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const body = JSON.stringify({ publicKey: publicJwk });
  localStorage.setItem(LS_PUBKEY, body);

  await fetch("/api/keys", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

/** Save current private key into the history ring before wiping it. */
function _archiveCurrentKey() {
  const current = localStorage.getItem(LS_PRIVKEY);
  if (!current) return;
  try {
    const raw  = localStorage.getItem(LS_KEY_HISTORY);
    const hist: string[] = raw ? JSON.parse(raw) : [];
    // Prepend, deduplicate, cap at MAX_KEY_HISTORY.
    const updated = [current, ...hist.filter(k => k !== current)].slice(0, MAX_KEY_HISTORY);
    localStorage.setItem(LS_KEY_HISTORY, JSON.stringify(updated));
  } catch { /* quota exceeded — non-fatal */ }
}

function _wipeOwnKeys() {
  _archiveCurrentKey(); // preserve old key before discarding
  localStorage.removeItem(LS_PRIVKEY);
  localStorage.removeItem(LS_PUBKEY);
  _privateKey = null;
  _sharedKeys.clear();
  _historicalSharedKeys.clear();
}

function _clearFriendKeyCache() {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(LS_PUB_PFX)) keys.push(k);
  }
  keys.forEach(k => localStorage.removeItem(k));
  _sharedKeys.clear();
}

async function _reuploadPublicKey() {
  const stored = localStorage.getItem(LS_PUBKEY);
  if (!stored) return;
  await fetch("/api/keys", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: stored,
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
  const iv        = crypto.getRandomValues(new Uint8Array(12));
  const encoded   = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return { ciphertext: _toBase64(encrypted), iv: _toBase64(iv) };
}

// ── decryptMessage ─────────────────────────────────────────────────────────────
export async function decryptMessage(
  key: CryptoKey,
  ciphertext: string,
  iv: string
): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: _fromBase64(iv) },
    key,
    _fromBase64(ciphertext)
  );
  return new TextDecoder().decode(decrypted);
}

// ── decryptWithFallback ────────────────────────────────────────────────────────
/**
 * Tries to decrypt a message with the current shared key first.
 * If that fails, derives shared keys from historical private keys (localStorage
 * ring buffer) and retries each one.  Returns the plaintext and a flag
 * indicating whether a fallback key was used so the caller can optionally
 * trigger a re-key on the server.
 *
 * @param currentKey   - AES-GCM key derived from the current keypair
 * @param friendId     - used as cache namespace for historical shared keys
 * @param theirJwk     - friend's current ECDH public key (JWK)
 * @param ciphertext   - base64 ciphertext
 * @param iv           - base64 IV
 */
export async function decryptWithFallback(
  currentKey: CryptoKey,
  friendId: string,
  theirJwk: JsonWebKey,
  ciphertext: string,
  iv: string
): Promise<{ text: string; failed: boolean; usedFallback: boolean }> {
  // 1. Current key
  try {
    const text = await decryptMessage(currentKey, ciphertext, iv);
    return { text, failed: false, usedFallback: false };
  } catch { /* fall through */ }

  // 2. Historical private keys
  const rawHist = localStorage.getItem(LS_KEY_HISTORY);
  if (!rawHist) return { text: "[Unable to decrypt]", failed: true, usedFallback: false };

  let history: string[];
  try { history = JSON.parse(rawHist) as string[]; }
  catch { return { text: "[Unable to decrypt]", failed: true, usedFallback: false }; }

  // Import friend's public key once (shared across all history attempts)
  let theirPublic: CryptoKey;
  try {
    theirPublic = await crypto.subtle.importKey("jwk", theirJwk, ECDH_ALGO, false, []);
  } catch { return { text: "[Unable to decrypt]", failed: true, usedFallback: false }; }

  for (let i = 0; i < history.length; i++) {
    const cacheKey = `${friendId}:hist${i}`;
    let hsk = _historicalSharedKeys.get(cacheKey);

    if (!hsk) {
      try {
        const pkcs8   = _fromBase64(history[i]);
        const histPriv = await crypto.subtle.importKey("pkcs8", pkcs8, ECDH_ALGO, false, ["deriveKey"]);
        hsk = await crypto.subtle.deriveKey(
          { name: "ECDH", public: theirPublic },
          histPriv,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"]
        );
        _historicalSharedKeys.set(cacheKey, hsk);
      } catch { continue; }
    }

    try {
      const text = await decryptMessage(hsk, ciphertext, iv);
      return { text, failed: false, usedFallback: true };
    } catch { /* try next */ }
  }

  return { text: "[Unable to decrypt]", failed: true, usedFallback: false };
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
    const body = JSON.stringify({ publicKey: publicJwk });
    localStorage.setItem(LS_PUBKEY, body); // store for re-upload on future sessions
    await fetch("/api/keys", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body,
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
