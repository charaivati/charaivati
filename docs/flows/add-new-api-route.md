# Flow: Add a New API Route

Self-contained checklist. No other file required.

> **Read first:** middleware does NOT protect `/api/*`. Every route is responsible for its
> own authentication. An API route with no auth check is fully public.

---

## Checklist

### 1. Create the file

```
app/api/<your-path>/route.ts
```

- One `route.ts` per URL segment.
- Dynamic segments: `app/api/store/[id]/route.ts` → params arrive as
  `{ params: Promise<{ id: string }> }` in Next.js 15.
- Never put logic in a plain `.ts` file alongside `route.ts` and expect it to be a route —
  only `route.ts` is treated as a handler.

---

### 2. Export named HTTP method functions

```ts
export async function GET(req: Request) { ... }
export async function POST(req: Request) { ... }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) { ... }
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) { ... }
```

- `req` is the standard `Request` object (Web API), not `NextRequest`, unless you need
  Next.js-specific APIs (query params, cookies object). Most routes use plain `Request`.
- Params must be awaited: `const { id } = await params;`

---

### 3. Add authentication (required for any non-public route)

**Standard pattern — use this for all new routes:**

```ts
import getServerUser from "@/lib/serverAuth";

export async function POST(req: Request) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // user.id is now available
}
```

`getServerUser` returns `{ id, email, name, avatarUrl, avatarStorageKey, status }` or `null`.

**Do not** import from `lib/auth.ts` or `lib/session.ts` directly for standard route auth.
See [[auth-files.md]] if you need magic link tokens or Bearer header reading.

**Guest blocking:** `getServerUser` from `lib/serverAuth.ts` does NOT block guests on
mutations. If guests must be blocked, add:
```ts
if (user.status === "guest") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
```

---

### 4. Parse the request body

```ts
const body = await req.json().catch(() => ({}));
```

Always use `.catch(() => ({}))` — a missing or malformed body should not crash the route.
Destructure after:
```ts
const { title, description } = body;
if (!title?.trim()) return NextResponse.json({ error: "title_required" }, { status: 400 });
```

For dynamic route params:
```ts
const { id } = await params;
```

For query params on GET:
```ts
const url = new URL(req.url);
const pageId = url.searchParams.get("pageId");
```

---

### 5. Return shape conventions

**Success:**
```ts
return NextResponse.json({ ok: true, data: result }, { status: 200 });     // GET
return NextResponse.json({ ok: true, record: created }, { status: 201 });  // POST
return NextResponse.json({ ok: true }, { status: 200 });                   // DELETE
```

**Error:**
```ts
return NextResponse.json({ error: "message_snake_case" }, { status: 400 }); // bad input
return NextResponse.json({ error: "Unauthorized" },        { status: 401 }); // no session
return NextResponse.json({ error: "unauthorized" },        { status: 403 }); // wrong owner
return NextResponse.json({ error: "page_not_found" },      { status: 404 }); // not found
return NextResponse.json({ ok: false, error: String(err) }, { status: 500 }); // caught throw
```

Status codes in use: `200`, `201`, `400`, `401`, `403`, `404`, `422`, `500`.

Note: existing routes are inconsistent between `{ error }` and `{ ok: false, error }`.
Both shapes exist. Pick one and be consistent within your route.

---

### 6. Ownership checks (for resource mutations)

Always verify the resource belongs to the requesting user before mutating:

```ts
const record = await db.yourModel.findUnique({
  where: { id },
  select: { ownerId: true },
});
if (!record) return NextResponse.json({ error: "not_found" }, { status: 404 });
if (record.ownerId !== user.id) return NextResponse.json({ error: "unauthorized" }, { status: 403 });
```

---

### 7. Database access

```ts
import { prisma } from "@/lib/prisma";
// OR
import { db } from "@/lib/db";
```

Both are the same Prisma singleton. Routes in `app/api/store/`, `app/api/course/`,
`app/api/health-business/`, and `app/api/helping-initiative/` use `prisma`. Routes in
`app/api/friends/`, `app/api/chat/`, and others use `db`. Match the pattern in the
directory you are adding to. Do not create a third import.

Prefer explicit `select` over returning full rows:
```ts
await db.user.findUnique({ where: { id }, select: { id: true, name: true } });
```

---

### 8. CSRF — do not add, not enforced

`lib/csrf.ts` exists and exports `getCsrfTokenFromRequest`. **No API route currently
calls it.** CSRF infrastructure is present but enforcement is not implemented. Do not add
CSRF checks to new routes unless you are implementing CSRF enforcement project-wide — a
partial implementation would block legitimate requests from clients that do not yet send
the token.

---

### 9. Rate limiting (for abuse-prone endpoints)

Apply to auth endpoints, OTP, AI calls, and any endpoint that could be spammed:

```ts
import { checkRateLimit } from "@/lib/rateLimit";

const { allowed } = await checkRateLimit(user.id, "your-endpoint-key");
if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
```

---

### 10. Opt into force-dynamic if needed

By default Next.js may statically cache GET routes. For routes that must always hit
the DB or read cookies at runtime, add at the top of the file:

```ts
export const dynamic = "force-dynamic";
```

Required for any GET that reads from `req` (cookies, headers, search params) or calls
`getServerUser`.

---

## Full minimal template

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getServerUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { title } = body;
    if (!title?.trim()) return NextResponse.json({ error: "title_required" }, { status: 400 });

    const record = await prisma.yourModel.create({
      data: { title: title.trim(), ownerId: user.id },
    });

    return NextResponse.json({ ok: true, record }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/your-route error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
```

---

## Backlinks
- [[START_HERE.md]] — WARNING: middleware does not cover API routes
- [[auth-files.md]] — when to use lib/auth.ts vs lib/session.ts vs lib/serverAuth.ts
- [[database.md]] — db vs prisma export convention
