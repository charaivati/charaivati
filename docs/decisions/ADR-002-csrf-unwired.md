---
id: ADR-002
title: CSRF infrastructure exists but is intentionally unwired
status: accepted
date: 2026-05-14
---

# ADR-002: CSRF Infrastructure Is Intentionally Unwired

## Status
Accepted — do not wire CSRF to individual routes. If implemented, it must be all-or-nothing.

## Context

`lib/csrf.ts` contains a complete CSRF implementation:

- `setCsrfCookie(res, token)` — writes a `csrf_token` cookie (httpOnly: false, so JS can read it)
- `getCsrfTokenFromRequest(req)` — reads the token from the `x-csrf-token` header or the `csrf_token` cookie
- `GET /api/auth/csrf` — issues a CSRF token and sets the cookie

The infrastructure compiles, runs, and is reachable. It is not broken.

**However: no API route calls `getCsrfTokenFromRequest` to validate the token.**

A search across all `app/api/**/*.ts` files finds exactly one CSRF reference: the `/api/auth/csrf`
route that issues the token. No route that receives mutations (POST, PATCH, DELETE) checks for
or rejects requests missing a valid CSRF token.

## Why It Is Unwired

CSRF protection was built before the client-side code was updated to fetch and send the token.
Wiring validation before the client sends the token would have broken all mutations immediately.
The enforcement step was deferred and never completed.

## Decision

**Leave it unwired. Do not add `getCsrfTokenFromRequest` to new routes.**

The reasons are architectural, not laziness:

### 1. Partial enforcement is worse than no enforcement

If CSRF validation is added to some routes but not others, the result is:
- Routes with validation reject requests from clients that don't send the token (which is all of them today)
- Routes without validation remain unprotected
- The "protected" routes appear safe but the attack surface is unchanged — an attacker targets the unprotected routes instead

Partial CSRF enforcement provides a false sense of security while breaking legitimate traffic.

### 2. The existing session cookie provides equivalent protection for this threat model

All state-mutating API routes require a valid session cookie (`charaivati.session` /
`__Host-session`). The session cookie is:
- `httpOnly: true` — not readable by JavaScript
- `sameSite: lax` — not sent on cross-origin non-navigation requests (the primary CSRF vector)
- `secure: true` in production — HTTPS only

`sameSite: lax` means a cross-origin POST from an attacker's page will not include the session
cookie, so the mutation will return 401. This blocks the primary CSRF attack for same-origin
session cookies. Full `sameSite: strict` would be stronger but `lax` is the standard acceptable
posture for web apps with link-based navigation.

### 3. The client is not ready

No client-side code currently fetches a CSRF token from `GET /api/auth/csrf` or sends an
`x-csrf-token` header. Enabling enforcement without updating every mutation in the client
breaks the application.

## If/When CSRF Enforcement Is Implemented

It must be done in a single coordinated change:

```
[ ] 1. Update every mutation-making fetch call in the client to:
        a. Fetch a token from GET /api/auth/csrf on app load
        b. Store the token in memory (not localStorage — it should rotate per session)
        c. Send it as x-csrf-token header on every POST/PATCH/DELETE

[ ] 2. Add getCsrfTokenFromRequest validation to a shared middleware layer or
        a wrapper function — not inline in individual routes

[ ] 3. Deploy client and server changes atomically (or client first, server second)

[ ] 4. Test every mutation surface before and after

[ ] 5. Update this ADR status to "superseded" with a link to the implementation PR
```

Deploying server enforcement before client delivery breaks all mutations for existing users.
Deploying client delivery before server enforcement is safe — clients will send a token that
gets ignored until enforcement is added.

## What This Means For New Routes

- Do not call `getCsrfTokenFromRequest` in new API route handlers.
- Do not send `x-csrf-token` headers from new client-side fetch calls unless you are
  implementing the full enforcement change described above.
- `lib/csrf.ts` and `GET /api/auth/csrf` may be left as-is — they are harmless.

## Backlinks
- [[add-new-api-route.md]] — checklist note: "CSRF — do not add, not enforced"
- [[auth.md]] — auth module security notes
- [[START_HERE.md]] — security notes on CSP and session cookies
