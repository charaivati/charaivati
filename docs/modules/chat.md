---
module: chat
type: api + component + library
source: lib/chat-crypto.ts, app/api/chat/, components/social/ChatPanel.tsx
depends_on: [database, auth, social]
used_by: [mobile-shell]
stability: fragile
status: active
---

# Module: Chat

## Purpose
End-to-end encrypted direct messaging between two users. The server stores only ciphertext and initialization vectors — it never holds plaintext. Encryption is based on ECDH P-256 key exchange with AES-GCM message encryption.

## Responsibilities
- Manage DM conversations (create, list, fetch)
- Send and receive E2E encrypted messages
- Store and retrieve ECDH public keys per user
- Optional server-side backup of decrypted messages (user opt-in)
- Enforce that only friends can message each other (TODO: verify enforcement)

## Inputs & Outputs

| Direction | Value |
|---|---|
| In | Authenticated user session |
| In | Target userId to start or retrieve a conversation |
| In | Encrypted message payload: `{ ciphertext: base64, iv: base64 }` |
| In | User ECDH P-256 public key (JWK format) for key registration |
| Out | Conversation list with last message timestamp |
| Out | Paginated message list (ciphertext + IV only — no plaintext) |
| Out | Confirmation of sent message |

## Dependencies
- **auth** — conversation access is restricted to participant users only
- **database** — ChatConversation, ChatMessage, UserPublicKey models
- **social** — TODO: confirm whether friendship is required before a DM can be created

## Reverse Dependencies (what breaks if this changes)
- `lib/chat-crypto.ts` is the only module that knows the encryption scheme. Any change to the key derivation, algorithm, or ciphertext format makes all existing messages unreadable.
- `ChatConversation` uses the same canonical ordering as `Friendship` (`userAId < userBId`). Queries rely on this — breaking the ordering creates duplicate conversations.
- `UserPublicKey` is fetched by the client to encrypt messages for the recipient. If a user's key is deleted or rotated, the sender cannot encrypt new messages for that recipient until the recipient re-registers a key.
- `ChatMessageBackup` is a separate opt-in table. If the backup schema changes, backed-up messages may be unreadable but live messages are unaffected.

## Runtime Flow

### Key registration & restore
1. On startup `ensureKeyPair()` looks for a keypair in localStorage
2. If localStorage is empty (new device, cleared/private browser), the client first tries `GET /api/keys/backup` and restores the account's existing keypair — a fresh keypair is generated only when no backup exists anywhere
3. Client POSTs the public key (JWK) to `POST /api/keys`; when the key actually changes, the server archives the previous public key into `UserPublicKey.keyHistory`
4. The keypair (+ private-key history) is backed up via `POST /api/keys/backup`, encrypted per-user with a server-derived key (`lib/server-crypto.ts`) — recoverable encryption, same trade-off as `ChatMessageBackup`

### Starting a conversation
1. Client POSTs to `POST /api/chat/conversations` with target `userId`
2. Server enforces canonical ordering: `userAId = min(a,b)`, `userBId = max(a,b)`
3. Creates or returns existing `ChatConversation`

### Sending a message
1. Sender fetches recipient's public key from `GET /api/keys/[userId]`
2. Sender derives a shared secret via ECDH (in-browser, using `lib/chat-crypto.ts` client-side)
3. Sender encrypts plaintext with AES-GCM using the derived key → `{ ciphertext, iv }`
4. Sender POSTs `{ ciphertext, iv }` to `POST /api/chat/conversations/[id]/messages`
5. Server stores `ChatMessage` with ciphertext and IV — no plaintext ever leaves the client

### Reading messages
1. Client fetches `GET /api/chat/conversations/[id]/messages`
2. Receives array of `{ ciphertext, iv, senderId, createdAt }`
3. Client decrypts each message locally using the shared ECDH secret

### Message backup (optional)
1. Client can POST decrypted message content to `POST /api/chat/backup`
2. Server stores in `ChatMessageBackup` — this breaks E2E guarantees for backed-up messages
3. TODO: Confirm whether backup is encrypted at rest on the server

## Key Functions

| Function | File | Role |
|---|---|---|
| (key generation) | lib/chat-crypto.ts | Generate ECDH P-256 keypair (client-side) |
| (key derivation) | lib/chat-crypto.ts | Derive AES-GCM shared secret from ECDH |
| (encrypt) | lib/chat-crypto.ts | AES-GCM encrypt plaintext → ciphertext + IV |
| (decrypt) | lib/chat-crypto.ts | AES-GCM decrypt ciphertext using shared key |

Note: `lib/chat-crypto.ts` runs client-side. The server never calls these functions.

## Key Components

| Component | Role |
|---|---|
| `components/social/ChatPanel.tsx` | Full chat UI: conversation list, message thread, compose box |

## Database Models Used
- `ChatConversation` — DM thread between two users (canonical user order)
- `ChatMessage` — encrypted message: `ciphertext`, `iv`, `senderId`, `conversationId`
- `ChatMessageBackup` — optional server-side decrypted backup
- `UserPublicKey` — ECDH public key per user (JWK stored as string or JSON)

## Risks & Fragile Areas
- This is the most security-sensitive module in the codebase. Do not modify `lib/chat-crypto.ts` without a cryptography review.
- `ChatMessageBackup` and `UserKeyBackup` are recoverable by the server (per-user key derived from `CHAT_BACKUP_SECRET`) — this is deliberately NOT strict E2E so users don't lose history; label it honestly in any user-facing UI. Rotating `CHAT_BACKUP_SECRET` makes all existing backups unreadable.
- Key rotation behavior: rotation is now rare (keys restore from `UserKeyBackup` on new devices). When it happens, the old private key is archived locally + in the server backup, and the old public key goes into `UserPublicKey.keyHistory`. `decryptWithFallback()` tries all combinations of own × friend key history, then falls back to `ChatMessageBackup`. Messages encrypted for a private key that was lost before any backup existed remain unrecoverable.
- No message deletion logic observed at the API level. TODO: Confirm whether messages can be deleted and whether deletion is hard or soft.
- Canonical ordering (`userAId < userBId`) is the same invariant as `Friendship`. They are independent tables — a DM conversation does not require a friendship. TODO: Verify whether friendship is enforced before DM creation.

## Backlinks
- [[START_HERE.md]] — E2E encryption note
- [[database.md]] — ChatConversation, ChatMessage, UserPublicKey models
- [[auth.md]] — session required for all chat operations
- [[social.md]] — friendship relation potentially gating DM access
