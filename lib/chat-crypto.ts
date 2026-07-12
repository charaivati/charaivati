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
 *                            in localStorage for 30 minutes.
 *
 * Key-rotation protection (why messages used to show
 * "Encrypted with a previous key" and how that is prevented now):
 *  • The keypair is backed up to the server (/api/keys/backup, encrypted with
 *    a per-user server-derived key). A new device or a cleared/private browser
 *    RESTORES the same keypair instead of generating a fresh one, so the chat
 *    identity is account-scoped, not browser-scoped.
 *  • When a rotation does happen, the old private key is archived locally AND
 *    in the server backup, and the old public key is archived server-side in
 *    UserPublicKey.keyHistory.
 *  • decryptWithFallback() tries every combination of (our current+historical
 *    private keys) × (friend's current+historical public keys), so messages
 *    survive a rotation on EITHER side of the conversation.
 *
 * Wire format is unchanged: ciphertext + iv as base64 strings.
 * Algorithm is unchanged:   ECDH P-256 + AES-GCM 256.
 * The server never sees message plaintext on the send path, but the key
 * backup (like the existing message backup) is recoverable by the server —
 * a deliberate trade-off so users don't lose their history.
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
const MAX_KEY_HISTORY = 10;

// ── Module-level singletons ────────────────────────────────────────────────────
let _privateKey: CryptoKey | null = null;
const _sharedKeys = new Map<string, CryptoKey>();
const _historicalSharedKeys = new Map<string, CryptoKey>();      // "{friendId}:{privId}:{pubId}"
const _histPrivImports = new Map<string, Promise<CryptoKey>>();  // base64 pkcs8 → imported key
const _friendHistoryCache = new Map<string, Promise<JsonWebKey[]>>();
let _ownHistoryPromise: Promise<string[]> | null = null;

/** Synchronous — true once ensureKeyPair() has loaded the private key into memory. */
export function isKeyReady(): boolean { return _privateKey !== null; }

// ── ensureKeyPair ──────────────────────────────────────────────────────────────
/**
 * Call once at startup (e.g. in the ChatPanel mount effect).
 * • Migrates old JWK-based key to pkcs8 format if present.
 * • Restores the keypair from the server backup when localStorage is empty
 *   (new device, cleared storage, private window) — no needless rotation.
 * • Generates a new keypair only when nothing is stored anywhere.
 * • Uploads the public key to /api/keys (idempotent upsert on the server)
 *   and keeps the server-side key backup fresh.
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
    _reuploadPublicKey().catch(() => {});
    _pushServerKeyBackup().catch(() => {}); // non-blocking, best-effort
    return;
  }

  if (hasPriv && !hasPub) {
    // Public key missing from localStorage — the pkcs8 blob contains the
    // public point, so recover it instead of rotating to a fresh keypair.
    try {
      return await _recoverPublicKeyFromPrivate();
    } catch {
      _wipeOwnKeys();
      return _generateAndUploadKeyPair();
    }
  }

  // No local private key — try to restore the account's keypair from the
  // server backup before generating. Generating a fresh pair is exactly what
  // makes old messages undecryptable, so it is the last resort.
  if (await _restoreFromServerBackup()) return;

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

  // Back up the new keypair server-side so other devices / future sessions
  // restore it instead of rotating again. The server merges histories, so a
  // key that another device already backed up is never lost.
  await _pushServerKeyBackup().catch(() => {});
}

/** Restore keypair + key history from the server backup. Returns true on success. */
async function _restoreFromServerBackup(): Promise<boolean> {
  try {
    const res = await fetch("/api/keys/backup", { credentials: "include" });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    const b = data?.backup;
    if (!data?.ok || typeof b?.privkey !== "string" || !b?.publicJwk) return false;

    // Validate the private key before committing anything to localStorage.
    _privateKey = await crypto.subtle.importKey(
      "pkcs8",
      _fromBase64(b.privkey),
      ECDH_ALGO,
      false,
      ["deriveKey"]
    );

    const body = JSON.stringify({ publicKey: b.publicJwk });
    localStorage.setItem(LS_PRIVKEY, b.privkey);
    localStorage.setItem(LS_PUBKEY, body);
    if (Array.isArray(b.history)) {
      try {
        localStorage.setItem(
          LS_KEY_HISTORY,
          JSON.stringify(b.history.filter((h: unknown) => typeof h === "string").slice(0, MAX_KEY_HISTORY))
        );
      } catch { /* quota exceeded — non-fatal */ }
    }

    // Align the server's current public key with the restored pair.
    await fetch("/api/keys", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return true;
  } catch {
    _privateKey = null;
    return false;
  }
}

/** Rebuild the public JWK from the stored pkcs8 private key (no rotation). */
async function _recoverPublicKeyFromPrivate(): Promise<void> {
  const stored = localStorage.getItem(LS_PRIVKEY);
  if (!stored) throw new Error("No private key found");

  // Import extractable so the public point (x, y) can be exported.
  const priv = await crypto.subtle.importKey(
    "pkcs8",
    _fromBase64(stored),
    ECDH_ALGO,
    true,
    ["deriveKey"]
  );
  const jwk = await crypto.subtle.exportKey("jwk", priv);
  const publicJwk: JsonWebKey = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, ext: true };

  const body = JSON.stringify({ publicKey: publicJwk });
  localStorage.setItem(LS_PUBKEY, body);
  _privateKey = priv;

  await fetch("/api/keys", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body,
  });
  _pushServerKeyBackup().catch(() => {});
}

/** Upload the current keypair + local key history to the server backup. */
async function _pushServerKeyBackup(): Promise<void> {
  const privkey = localStorage.getItem(LS_PRIVKEY);
  const pubBody = localStorage.getItem(LS_PUBKEY);
  if (!privkey || !pubBody) return;

  let publicJwk: JsonWebKey;
  try { publicJwk = (JSON.parse(pubBody) as { publicKey: JsonWebKey }).publicKey; }
  catch { return; }

  let history: string[] = [];
  try { history = JSON.parse(localStorage.getItem(LS_KEY_HISTORY) ?? "[]"); }
  catch { /* corrupt history — send without it */ }

  await fetch("/api/keys/backup", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ privkey, publicJwk, history }),
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
  _ownHistoryPromise = null;
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
 * Cache: localStorage entry `pubkey_{friendId}` with a 30-minute TTL.
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

  const myPrivate   = await loadPrivateKey();
  const theirPublic = await _importPublicJwk(theirPublicJwk);
  const sk = await _deriveAesKey(myPrivate, theirPublic);

  _sharedKeys.set(friendId, sk);
  return sk;
}

// ── prewarmFriends ─────────────────────────────────────────────────────────────
/**
 * Pre-fetches each friend's public key and pre-derives the shared AES-GCM key
 * so that opening a conversation has zero crypto cold-start delay.
 * All work is fire-and-forget — any individual failure is silently swallowed.
 * Call this from WithNavClient after the friends list is loaded.
 */
export async function prewarmFriends(friendIds: string[]): Promise<void> {
  if (!_privateKey) return; // private key not ready yet — skip; ChatPanel will warm on open
  await Promise.allSettled(
    friendIds.map(async (id) => {
      if (_sharedKeys.has(id)) return; // already warmed
      try {
        const jwk = await getFriendPublicKey(id);
        await getSharedKey(id, jwk);
      } catch {
        // friend hasn't uploaded a key yet — normal, not an error
      }
    })
  );
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

// ── Fallback key sources ───────────────────────────────────────────────────────

/**
 * Our historical private keys (base64 pkcs8, excluding the current one):
 * localStorage ring buffer merged with the server key backup — the backup is
 * what makes recovery work when localStorage was wiped (private windows).
 * Fetched lazily on the first decrypt failure, once per session.
 */
function _getOwnHistoricalKeys(): Promise<string[]> {
  if (!_ownHistoryPromise) {
    _ownHistoryPromise = (async () => {
      const current = localStorage.getItem(LS_PRIVKEY);

      let local: string[] = [];
      try { local = JSON.parse(localStorage.getItem(LS_KEY_HISTORY) ?? "[]"); }
      catch { /* corrupt — server copy below still applies */ }

      let server: string[] = [];
      try {
        const res = await fetch("/api/keys/backup", { credentials: "include" });
        const d   = res.ok ? await res.json().catch(() => null) : null;
        if (d?.ok && d.backup) {
          server = [d.backup.privkey, ...(d.backup.history ?? [])];
        }
      } catch { /* offline / no backup — local history still applies */ }

      const seen = new Set<string>(current ? [current] : []);
      const merged: string[] = [];
      for (const k of [...local, ...server]) {
        if (typeof k === "string" && k && !seen.has(k)) { seen.add(k); merged.push(k); }
      }
      return merged;
    })();
  }
  return _ownHistoryPromise;
}

/** Friend's previous public keys (JWKs, newest first) — cached per session. */
function _getFriendKeyHistory(friendId: string): Promise<JsonWebKey[]> {
  let p = _friendHistoryCache.get(friendId);
  if (!p) {
    p = (async () => {
      const res  = await fetch(`/api/keys?userId=${encodeURIComponent(friendId)}&history=1`, { credentials: "include" });
      const data = await res.json().catch(() => null);
      return data?.ok && Array.isArray(data.history) ? (data.history as JsonWebKey[]) : [];
    })().catch(() => [] as JsonWebKey[]);
    _friendHistoryCache.set(friendId, p);
  }
  return p;
}

function _importPublicJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, ECDH_ALGO, false, []);
}

function _importHistoricalPrivate(b64: string): Promise<CryptoKey> {
  let p = _histPrivImports.get(b64);
  if (!p) {
    p = crypto.subtle.importKey("pkcs8", _fromBase64(b64), ECDH_ALGO, false, ["deriveKey"]);
    _histPrivImports.set(b64, p);
  }
  return p;
}

function _deriveAesKey(priv: CryptoKey, pub: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: pub },
    priv,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ── decryptWithFallback ────────────────────────────────────────────────────────
/**
 * Tries to decrypt a message with the current shared key first. If that
 * fails, tries every combination of (our current + historical private keys)
 * × (friend's current + historical public keys), so a rotation on EITHER
 * side of the conversation is survivable. Derived fallback keys are cached,
 * so the ECDH work happens at most once per key pair per session.
 *
 * @param currentKey   - AES-GCM key derived from both sides' current keys
 * @param friendId     - used as cache namespace + to fetch friend key history
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
  // 1. Current keys on both sides — the hot path.
  try {
    const text = await decryptMessage(currentKey, ciphertext, iv);
    return { text, failed: false, usedFallback: false };
  } catch { /* fall through to history */ }

  // 2. Build the candidate key matrix.
  const [ownHistory, theirHistory] = await Promise.all([
    _getOwnHistoricalKeys(),
    _getFriendKeyHistory(friendId),
  ]);

  let myCurrent: CryptoKey | null = null;
  try { myCurrent = await loadPrivateKey(); } catch { /* no current key */ }

  const pubs: Array<{ id: string; jwk: JsonWebKey }> = [
    { id: "cur", jwk: theirJwk },
    ...theirHistory.map((jwk, j) => ({ id: `h${j}`, jwk })),
  ];

  for (const pub of pubs) {
    let pubKey: CryptoKey | null = null; // imported lazily, only if a derivation is needed

    for (let i = -1; i < ownHistory.length; i++) {
      const privId = i === -1 ? "cur" : `h${i}`;
      if (pub.id === "cur" && privId === "cur") continue; // step 1 already tried this
      if (privId === "cur" && !myCurrent) continue;

      const cacheId = `${friendId}:${privId}:${pub.id}`;
      let sk = _historicalSharedKeys.get(cacheId);
      if (!sk) {
        try {
          pubKey ??= await _importPublicJwk(pub.jwk);
          const priv = i === -1 ? myCurrent! : await _importHistoricalPrivate(ownHistory[i]);
          sk = await _deriveAesKey(priv, pubKey);
          _historicalSharedKeys.set(cacheId, sk);
        } catch { continue; }
      }

      try {
        const text = await decryptMessage(sk, ciphertext, iv);
        return { text, failed: false, usedFallback: true };
      } catch { /* try next combination */ }
    }
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

function _fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
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
