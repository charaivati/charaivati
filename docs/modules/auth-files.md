---
module: auth-files
type: library
source: lib/auth.ts, lib/session.ts, lib/serverAuth.ts
depends_on: [database]
used_by: [all-api-routes, middleware]
stability: fragile
status: active
---

# Module: Auth Files — lib/auth.ts vs lib/session.ts

These two files both handle JWT authentication and have overlapping names. They are
**not interchangeable**. This document defines exactly what each owns and when to use each.

---

## The Short Answer

| You need to… | Import from |
|---|---|
| Read the session cookie in an API route | `lib/serverAuth.ts` (`getServerUser`) |
| Set or clear the session cookie on a response | `lib/session.ts` |
| Get the cookie name constant | `lib/session.ts` (`COOKIE_NAME`) |
| Create a magic link token | `lib/auth.ts` (`createMagicToken`) |
| Verify a magic link token | `lib/auth.ts` (`verifyMagicToken`) |
| Read a Bearer token from an Authorization header | `lib/auth.ts` (`getTokenFromReq`) |
| Get a full `User` object (all DB fields) from a request | `lib/auth.ts` (`getUserFromReq`) |

**For the vast majority of API routes:** use `getServerUser(req)` from `lib/serverAuth.ts`.
Do not call `lib/auth.ts` or `lib/session.ts` directly unless you have a specific need listed above.

---

## lib/session.ts — Cookie Lifecycle Owner

**JWT library:** `jose` (async/await)

**What it owns:**
- The session cookie name (`COOKIE_NAME` — `charaivati.session` in dev, `__Host-session` in prod)
- Issuing and verifying the standard session cookie token
- Writing and clearing the cookie on `NextResponse` objects
- A convenience `getCurrentUser()` that decodes the cookie and returns a partial user

**Key functions:**

| Function | Signature | Notes |
|---|---|---|
| `createSessionToken(payload, opts?)` | `async (payload: { userId, email?, role? }) → string` | Signs with `jose`; sets `iss`/`aud` to `SITE_URL`; 7-day default |
| `verifySessionToken(token?)` | `async (string?) → SessionPayload \| null` | Validates `iss`/`aud`; returns `{ userId, email, role }` — note: user ID is at `.userId` |
| `getTokenFromRequest(req)` | `(Request) → string \| null` | Reads ONLY the `COOKIE_NAME` cookie from the raw `cookie` header |
| `setSessionCookie(res, token, opts?)` | `(NextResponse, string) → NextResponse` | HTTP-only, `sameSite: lax`, secure in prod, 7-day maxAge |
| `clearSessionCookie(res)` | `(NextResponse) → NextResponse` | Sets maxAge 0 |
| `getCurrentUser(req?)` | `async (Request?) → { id, name, email, avatarUrl } \| null` | Minimal user select; does NOT return full User record |

**Where it is used:**
- Login and logout routes (cookie set/clear)
- Chat routes (`getCurrentUser`)
- Friend routes (`getCurrentUser`)
- Social, admin, circle, help-link routes (`getCurrentUser`)
- `middleware.ts` (imports `verifySessionToken`, `COOKIE_NAME`)

---

## lib/auth.ts — JWT Utility Layer

**JWT library:** `jsonwebtoken` (synchronous)

**What it owns:**
- Magic link token creation and verification
- Token extraction from `Authorization: Bearer` headers (not just cookies)
- Getting the full `User` DB record from a request
- Guest role enforcement (guests blocked from non-GET mutations)

**Key functions:**

| Function | Signature | Notes |
|---|---|---|
| `createSessionToken(userId)` | `(string) → string` | Sync; sets `{ sub, userId, type: "session" }`; 7-day |
| `verifySessionToken(token)` | `(string) → NormalizedSession \| null` | Returns `{ id, email, role, type }` — note: user ID is at `.id`, NOT `.userId` |
| `createMagicToken(userId)` | `(string) → string` | Sync; `type: "magic"`, 15-min expiry |
| `verifyMagicToken(token)` | `(string) → SessionPayload \| null` | Only accepts tokens with `type: "magic"` |
| `getTokenFromReq(req)` | `(Request) → string \| null` | Reads from `Authorization: Bearer` first, then cookies named `session` or `token` (NOT `COOKIE_NAME`) |
| `getUserFromReq(req?)` | `async (Request?) → User \| null` | Returns full Prisma `User` object; blocks guests from mutations |

**Where it is used:**
- `app/api/user/avatar/route.ts` — uses `verifySessionToken`
- `app/api/usage/route.ts` — uses `getUserFromReq`
- `app/api/user/selection/route.ts` — uses `getTokenFromReq` + `verifySessionToken`
- `app/api/user/resend-verification/route.ts` — uses `createMagicToken`

---

## lib/serverAuth.ts — The Recommended Wrapper

This is what most API routes should use. It wraps `lib/session.ts` functions into one call:

```ts
import getServerUser from "@/lib/serverAuth";

const user = await getServerUser(req);
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

Returns: `{ id, email, name, avatarUrl, avatarStorageKey, status }` — a subset of the User record.

Internally calls `getTokenFromRequest` (session.ts) → `verifySessionToken` (session.ts) → `prisma.user.findUnique`.

---

## Critical Difference: Return Shape for User ID

This is the most dangerous inconsistency between the two files.

| File | Function | User ID field |
|---|---|---|
| `lib/session.ts` | `verifySessionToken()` | `payload.userId` |
| `lib/auth.ts` | `verifySessionToken()` | `session.id` |

They have the same function name but different return shapes. Calling the wrong one and reading
the wrong field returns `undefined` silently — no type error, no runtime error in many cases.

**Rule:** Always note which file you imported `verifySessionToken` from before reading the
user ID from its result.

---

## Critical Difference: Cookie vs Bearer Token

| File | Function | What it reads |
|---|---|---|
| `lib/session.ts` | `getTokenFromRequest()` | Only `COOKIE_NAME` cookie (`charaivati.session` / `__Host-session`) |
| `lib/auth.ts` | `getTokenFromReq()` | `Authorization: Bearer` header first, then cookies named `session` or `token` |

`lib/auth.ts` does NOT read `COOKIE_NAME`. If a request carries the standard session cookie,
`getTokenFromReq()` from `lib/auth.ts` will fail to find it unless the cookie happens to
also be named `session` or `token` (which it is not in production — it is `__Host-session`).

TODO: Confirm whether any production code path relies on `lib/auth.ts`'s `getTokenFromReq`
reading the session cookie. In production, `__Host-session` would not be found by the
`session` / `token` cookie lookup in `lib/auth.ts`.

---

## Token Compatibility

Both files use the same `JWT_SECRET` and `HS256` algorithm, so a token created by one
can technically be verified by the other. However:

- `lib/auth.ts` `createSessionToken` produces: `{ sub: userId, userId, type: "session" }`
- `lib/session.ts` `createSessionToken` produces: `{ userId, email, role, iss, aud }`

`lib/session.ts` `verifySessionToken` validates `iss` and `aud` claims. A token created by
`lib/auth.ts` (which omits `iss`/`aud` when `SITE_URL` is not set) will **fail verification**
in `lib/session.ts` when `SITE_URL` is configured.

TODO: Confirm whether `lib/auth.ts` `createSessionToken` is used in any active login flow.
If both files can issue session tokens and the tokens are cross-incompatible with `iss`/`aud`,
users could be logged in with tokens that some routes accept and others reject.

---

## Which To Use For New Code

```
New API route needing current user?
  → import getServerUser from "@/lib/serverAuth"

Login / logout route setting a cookie?
  → import { createSessionToken, setSessionCookie, clearSessionCookie } from "@/lib/session"

Generating a magic link token?
  → import { createMagicToken } from "@/lib/auth"

Verifying a magic link in a route?
  → import { verifyMagicToken } from "@/lib/auth"

Nothing else should require direct imports from either file.
```

## Backlinks
- [[START_HERE.md]] — auth flow overview
- [[auth.md]] — auth module responsibilities and runtime flow
- [[database.md]] — User model
- [[user.md]] — registration and magic link delivery
