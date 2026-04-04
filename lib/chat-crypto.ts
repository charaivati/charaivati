/**
 * lib/chat-crypto.ts — Client-side only
 * End-to-end encryption using ECDH P-256 key exchange + AES-GCM message encryption.
 *
 * Flow:
 *  1. On first use, generate an ECDH keypair and store private key in localStorage.
 *  2. Upload public key (JWK) to /api/keys so friends can fetch it.
 *  3. To chat with a friend, fetch their public key, derive a shared AES-GCM key via ECDH.
 *  4. Encrypt outgoing messages; decrypt incoming messages using that shared key.
 *  5. The server only ever sees base64 ciphertext + IV — never plaintext.
 */

const ECDH_ALGO = { name: "ECDH", namedCurve: "P-256" } as const;
const LS_KEY = "charaivati_chat_keypair";

export type KeyPair = { publicJwk: JsonWebKey; privateJwk: JsonWebKey };

/** Generate a fresh ECDH P-256 keypair */
export async function generateKeyPair(): Promise<KeyPair> {
  const pair = await crypto.subtle.generateKey(ECDH_ALGO, true, ["deriveKey"]);
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { publicJwk, privateJwk };
}

/** Load keypair from localStorage, generating + storing one if absent */
export async function getOrCreateKeyPair(): Promise<KeyPair> {
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) return JSON.parse(stored) as KeyPair;
  } catch {
    // ignore parse errors — regenerate
  }
  const pair = await generateKeyPair();
  localStorage.setItem(LS_KEY, JSON.stringify(pair));
  return pair;
}

/** Derive a shared AES-GCM-256 key from my private key + their public key (JWK) */
export async function deriveSharedKey(
  myPrivateJwk: JsonWebKey,
  theirPublicJwk: JsonWebKey
): Promise<CryptoKey> {
  const myPrivate = await crypto.subtle.importKey(
    "jwk",
    myPrivateJwk,
    ECDH_ALGO,
    false,
    ["deriveKey"]
  );
  const theirPublic = await crypto.subtle.importKey(
    "jwk",
    theirPublicJwk,
    ECDH_ALGO,
    false,
    []
  );
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: theirPublic },
    myPrivate,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Encrypt a plaintext string; returns base64 ciphertext + base64 IV */
export async function encryptMessage(
  key: CryptoKey,
  plaintext: string
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return { ciphertext: toBase64(encrypted), iv: toBase64(iv) };
}

/** Decrypt a base64 ciphertext + IV back to plaintext */
export async function decryptMessage(
  key: CryptoKey,
  ciphertext: string,
  iv: string
): Promise<string> {
  const ct = fromBase64(ciphertext);
  const ivBytes = fromBase64(iv);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    key,
    ct
  );
  return new TextDecoder().decode(decrypted);
}
