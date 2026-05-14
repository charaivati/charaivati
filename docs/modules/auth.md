---
module: auth
type: library + api
source: lib/session.ts, lib/auth.ts, lib/serverAuth.ts, lib/hash.ts, lib/csrf.ts, middleware.ts, app/api/auth/
depends_on: [database, notifications]
used_by: [all-api-routes, middleware, user, mobile-shell]
stability: fragile
status: active
---

# Module: Auth

> **WARNING — MIDDLEWARE DOES NOT PROTECT API ROUTES**
>
> `middleware.ts` runs on page routes only. It does **not** intercept any `/api/*` request.
> Every API route handler is responsible for its own authentication.
> The required pattern at the top of every authenticated API route:
> ```ts
> const token = getTokenFromRequest(req);
> const payload = await verifySessionToken(token);
> if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
> ```
> An API route that omits this is fully public regardless of what middleware is configured.

---

> **NOTE — UNPROTECTED PAGE ROUTES**
>
> `middleware.ts` only covers `/self`, `/nation`, `/earth`, `/society`.
> The routes `/state`, `/universe`, and all `/app/*` routes have **no server-side auth enforcement**.
> They depend entirely on client-side redirects and per-component data-fetch 401 handling.

---

## Purpose
Handles all authentication and session lifecycle: credential verification, session token issuance, cookie management, and route protection. Supports three entry points — password, magic link, and SMS OTP — all converging on the same JWT cookie.

## Responsibilities
- Issue and verify JWT session tokens
- Read and write the session cookie on HTTP responses
- Validate the session on every protected API route
- Protect page routes at the edge via middleware
- Hash and verify passwords
- Generate and validate CSRF tokens
- Issue time-limited magic link and OTP tokens

## Inputs & Outputs

| Direction | Value |
|---|---|
| In | Email + password, or phone + OTP code, or magic link token |
| In | Raw HTTP request (cookie header) on all API calls |
| Out | Signed JWT string |
| Out | HTTP-only session cookie set on `NextResponse` |
| Out | Decoded `SessionPayload` (`userId`, `email`, `role`) |

## Dependencies
- **database** — `db.user.findUnique` inside `getCurrentUser()`
- **notifications** — OTP delivery (SMS) and magic link delivery (email)
- **jose** — JWT signing and verification (HS256)
- **bcrypt / bcryptjs** — password hashing

## Reverse Dependencies (what breaks if this changes)

- Changing the **cookie name** (`charaivati.session` / `__Host-session`) logs out all active users immediately.
- Changing the **JWT structure** (adding/removing claims, changing algorithm) invalidates all existing tokens.
- Changing the **JWT secret** logs out all users.
- Changing `verifySessionToken` signature or return shape breaks every API route that reads `payload.userId`.
- Changing `middleware.ts` matcher or protected routes list can expose or over-block pages.

## Runtime Flow

### Password login
1. Client POSTs `{ email, password }` to `POST /api/auth/login`
2. Route calls `db.user.findUnique({ where: { email } })`
3. Compares submitted password against `user.passwordHash` via bcrypt
4. Calls `createSessionToken({ userId, email, role })` → returns signed JWT (7-day expiry)
5. Calls `setSessionCookie(response, token)` → writes HTTP-only cookie
6. Returns `200` with user object

### Request authentication (API routes)
1. API route calls `getTokenFromRequest(req)` → extracts cookie value from `cookie` header
2. Calls `verifySessionToken(token)` → returns `SessionPayload | null`
3. If null → returns `401 Unauthorized`
4. If valid → uses `payload.userId` for all DB queries

### Edge protection (middleware)
1. `middleware.ts` runs on every non-static, non-API request
2. Checks if path starts with any protected prefix (`/self`, `/nation`, `/earth`, `/society`)
3. Reads cookie, calls `verifySessionToken`
4. If invalid → deletes cookie, redirects to `/login`

### Magic link
1. Client POSTs email to `POST /api/auth/send-magic-link`
2. Server generates a signed token (15-min expiry), stores hash in `MagicLink` table
3. Sends link via `sendEmail()`
4. User clicks link → `GET /api/user/magic` verifies token, issues session cookie

### OTP
1. Client POSTs phone to `POST /api/auth/otp/request`
2. Server generates OTP, hashes it, stores in `Otp` table, sends via `sendSms()`
3. Client POSTs code to `POST /api/auth/otp/verify`
4. Server fetches `Otp` record, compares hash, issues session cookie

## Key Functions

| Function | File | Role |
|---|---|---|
| `createSessionToken()` | lib/session.ts | Signs JWT with userId, email, role |
| `verifySessionToken()` | lib/session.ts | Decodes and validates JWT; returns payload or null |
| `getTokenFromRequest()` | lib/session.ts | Extracts cookie value from raw request header |
| `setSessionCookie()` | lib/session.ts | Writes HTTP-only cookie to a NextResponse |
| `clearSessionCookie()` | lib/session.ts | Zeroes out the session cookie |
| `getCurrentUser()` | lib/session.ts | Decodes token + fetches user from DB in one call |
| `generateCsrfToken()` | lib/csrf.ts | Creates a CSRF token for form submissions |
| `verifyCsrfToken()` | lib/csrf.ts | Validates submitted CSRF token |
| `hashPassword()` | lib/hash.ts | bcrypt hash wrapper |
| `verifyPassword()` | lib/hash.ts | bcrypt compare wrapper |

## Database Models Used
- `User` — credential lookup, session subject
- `MagicLink` — stores hashed magic link tokens
- `Otp` — stores hashed OTP codes with expiry
- `VerificationToken` — email address verification (separate from login)
- `AuditLog` — login events (TODO: verify if currently written)

## Risks & Fragile Areas
- `COOKIE_NAME` is environment-conditional. A mismatch between dev/prod env causes silent auth failure.
- `JWT_SECRET` falls back to a hardcoded insecure string in dev. A missing prod secret throws at startup.
- `verifySessionToken` catches all errors silently and returns `null` — failed verification is indistinguishable from missing token in logs.
- Magic links use `MagicLink.tokenHash` but the hashing algorithm is TODO: confirm (unclear from source).
- `/state`, `/universe`, and `/app/*` have no server-side auth enforcement — see WARNING block at top of this file.

## Backlinks
- [[START_HERE.md]] — auth flow walkthrough
- [[database.md]] — user and token model definitions
- [[user.md]] — registration and profile creation post-auth
- [[notifications.md]] — OTP and magic link delivery
- [[mobile-shell.md]] — session fetch on app mount
