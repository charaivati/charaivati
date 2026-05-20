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
> `middleware.ts` auth gate only covers `/self`, `/nation`, `/earth`, `/society`.
> The routes `/state`, `/universe`, and all `/app/*` routes have **no server-side auth enforcement** and depend on client-side redirects and per-component 401 handling.
>
> `/app/*` routes ARE partially gated by the **language gate**: unauthenticated requests without a `"lang"` cookie are redirected to `/?redirect=<path>`. Authenticated users bypass the language gate and reach `/app/*` freely.

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
Two sequential gates. Session is verified once and reused by both.

**Gate 1 — Language gate** (runs first)
1. Skip if path is `/`, `/login`, `/register`, or ends in a static file extension
2. Skip if the request has a valid session cookie (authenticated users always pass)
3. Check for `req.cookies.get("lang")` — written by `LanguageProvider.setLang()` as a non-HttpOnly cookie
4. If absent → redirect to `/?redirect=<original-path-and-query>` so the user goes through the language picker

**Gate 2 — Auth gate** (runs second, for protected routes only)
1. Checks if path starts with `/self`, `/nation`, `/earth`, or `/society`
2. If no valid session → delete stale cookie, redirect to `/login`

### Registration and email verification
1. User fills in name/email/password on the login page (`step === "register"`) and clicks "Create Account"
2. Client POSTs to `POST /api/user/register` with `{ email, password, name, redirect }`
3. Server creates user (`emailVerified: false`), generates a 15-min magic link token, stores hash in `MagicLink.meta` (includes `redirect` path and `guestId` if present), sends verification email via `lib/sendEmail.ts` (Nodemailer/Gmail)
4. On success response, login page sets `step = "verify-pending"` — stays on page, shows "check your inbox" message. **No redirect.**
5. User clicks email link → `GET /api/user/magic?token=...&redirect=...`
6. Server verifies token, marks user `emailVerified: true`, runs guest merge, redirects to `/verified?email=...&redirect=...`
7. `/verified` page shows "Email Verified!" with a single "Sign in to continue →" link to `/login?email=...&redirect=...`
8. User clicks → login page pre-fills email; `handleEmailSubmit` sees `emailVerified: true` → advances to password step → login → redirect to original destination

### Magic link (general)
1. Client POSTs email to `POST /api/auth/send-magic-link`
2. Server generates a signed token (15-min expiry), stores hash in `MagicLink` table
3. Sends link via `sendEmail()`
4. User clicks link → `GET /api/user/magic` verifies token, marks email verified, auto-merges any guest session, redirects to `/verified?email=...&redirect=...` (NOT to `/login`)

### Guest-to-real account merge
Guests have a real `User` row (`status: "guest"`, no email). On authentication all guest data is moved to the real account atomically.

1. At **registration** (`POST /api/user/register`): the current cookie is read; if it is a guest session the `guestId` is stored in `MagicLink.meta` JSON — this survives the user opening the verification email in a different browser or app.
2. At **email verification** (`GET /api/user/magic`): `meta.guestId` is preferred; live cookie is the fallback. `mergeGuestToReal(guestId, realId)` is called before the redirect to `/login`.
3. At **password login** (`POST /api/user/login`): after `createSessionToken`, the existing cookie is checked and merged if it contains a guest session.
4. `mergeGuestToReal` (in `lib/mergeGuest.ts`) runs a single Prisma transaction: cart items (quantities summed), wishlist, pinned stores, page follows, addresses, orders, owned Pages (initiatives/courses/health businesses), owned Stores — then deletes the guest user. Duplicate records are skipped; calling twice is a no-op.
5. `POST /api/user/claim-guest` — manual merge endpoint; accepts `{ guestId }` with a real-user session. For retroactive recovery.

### Landing page / language selection
1. User visits `/` (`app/page.tsx`) — middleware skips `/` entirely
2. If a valid session exists → redirect to `/self`
3. If no session: scan localStorage for the first non-empty value in `["lang", "app.language", "charaivati.lang", "language", "preferredLanguage"]`
4. If any saved language is found → redirect to `/login`, forwarding any `?redirect=` param that middleware injected into the URL (via `getLoginUrl()` helper)
5. Otherwise → show the language picker grid
6. On selection, `setLanguage(code)` from `components/LanguageProvider.tsx` is called — this writes to **both** `localStorage` key `"lang"` AND a `document.cookie` entry named `"lang"` (path `/`, max-age 1 year, SameSite=Lax, Secure on HTTPS). React state is updated, then `router.replace(getLoginUrl())` fires — forwarding any `?redirect=` that middleware passed.
7. `LanguageProvider` re-initialises on the login page reading `"lang"` from localStorage first, cookie second.

**The `"lang"` cookie is what the edge middleware reads** — middleware cannot access localStorage. `setLanguage()` in `LanguageProvider` is the only correct writer for both the localStorage key and the cookie. Do not write to either from outside `LanguageProvider`, and do not remove the cookie write.

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
