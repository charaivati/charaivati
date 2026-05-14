# Flow: Adding a New Page Type End-to-End

This document describes the exact ceremony required to add a new first-class entity that
is backed by a `Page` record (e.g. a Marketplace, Directory, Event, or Project type).

Read [[START_HERE.md]] §5 (DB Model Relationships) before this document.

---

## Critical: What pageType Actually Is

`Page.pageType` is a **plain `String` field** in the schema — no Prisma enum, no DB-level
constraint. Validation is enforced only in application code. The values currently in use are:

| pageType string | Linked sub-model | Notes |
|---|---|---|
| `"store"` | `Store` (nullable `pageId`) OR `HealthBusiness` | Store is the default; HealthBusiness re-uses this string with `Page.type = "health"` |
| `"learning"` | `Course` | |
| `"helping"` | `HelpingInitiative` | |
| `"service"` | None observed | Appears in UI labels but no sub-model found |

> **Warning:** These strings are NOT the same as the sub-model names. `"learning"` ≠ `Course`,
> `"helping"` ≠ `HelpingInitiative`. Do not derive the string from the model name.

---

## Also Critical: Two Different Creation Patterns Exist

There are two distinct patterns in the codebase. Know which one you are following:

**Pattern A — Page-first (Course, HealthBusiness, HelpingInitiative)**
```
POST /api/user/pages → creates Page row
POST /api/[sub-model] → creates sub-model linked to that pageId
```

**Pattern B — Sub-model first, Page optional (Store)**
```
POST /api/store → creates Store with no Page
# Page link (Store.pageId) can be added later; it is nullable
```

New page types should follow **Pattern A**. Pattern B is a legacy inconsistency in the Store
implementation.

---

## Step-by-Step Ceremony

### Step 1 — Schema: Add the sub-model

In `prisma/schema.prisma`:

**1a. Add the new model.** It must have:
```prisma
model YourModel {
  id        String   @id @default(cuid())
  pageId    String   @unique                          // must be @unique
  page      Page     @relation(fields: [pageId], references: [id], onDelete: Cascade)
  // ... your fields
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

The `@unique` on `pageId` enforces the 1:1 Page ↔ sub-model constraint.
`onDelete: Cascade` ensures sub-model is deleted when the Page is deleted.

**1b. Add the back-relation to the `Page` model:**
```prisma
model Page {
  // ... existing fields
  yourModel YourModel?   // add this line
}
```

**1c. Run migrations:**
```bash
npx prisma migrate dev --name add-your-model
npx prisma generate
```

---

### Step 2 — Register the pageType string

**File: `app/api/user/pages/route.ts`**, line ~61

The `POST` handler has a whitelist that validates the incoming `pageType`. Add your string:
```ts
// Before:
const pageType = ["store", "learning", "service", "helping"].includes(rawPageType)
  ? rawPageType : "store";

// After:
const pageType = ["store", "learning", "service", "helping", "your-type"].includes(rawPageType)
  ? rawPageType : "store";
```

If you do not add it here, any Page created with your type will silently default to `"store"`.

---

### Step 3 — Sub-model creation API

Create `app/api/[your-type]/route.ts`. Follow the exact pattern used by the other sub-models:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function POST(req: Request) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { pageId, ...fields } = body;
  if (!pageId) return NextResponse.json({ error: "page_id_required" }, { status: 400 });

  // Always verify ownership before creating the sub-model
  const page = await prisma.page.findUnique({ where: { id: pageId }, select: { ownerId: true } });
  if (!page) return NextResponse.json({ error: "page_not_found" }, { status: 404 });
  if (page.ownerId !== user.id) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

  const record = await prisma.yourModel.create({ data: { pageId, ...fields } });
  return NextResponse.json({ ok: true, record }, { status: 201 });
}
```

Note: all four sub-module creation routes use `prisma` (from `lib/prisma.ts`) rather than `db`
(from `lib/db.ts`). This contradicts the documented convention but is what the codebase does.
Match it for consistency in this area.

---

### Step 4 — Page deletion handler

**File: `app/api/user/pages/route.ts`**, the `DELETE` handler (~line 77)

Course, HealthBusiness, and HelpingInitiative all cascade automatically via `onDelete: Cascade`
and do not need manual handling here.

However, check whether your sub-model has any child tables with FK relations that do NOT
cascade. The `Store` model is the example of what goes wrong: `Store.pageId` is nullable with
no cascade, so the delete handler manually cleans it up:

```ts
// Example of manual cleanup needed when cascade is absent
const store = await prisma.store.findFirst({ where: { pageId }, select: { id: true } });
if (store) {
  await prisma.order.deleteMany({ where: { storeId: store.id } }); // Orders don't cascade from Store
  await prisma.store.delete({ where: { id: store.id } });
}
```

If your sub-model uses `onDelete: Cascade` correctly (as in Step 1a), you do not need to add
anything here.

---

### Step 5 — Page detail API

**File: `app/api/pages/[id]/route.ts`**

The current `GET /api/pages/[id]` route returns only top-level Page metadata. It does NOT
include the sub-model. If consumers of your new type need the sub-model data from this endpoint,
you must add it:

```ts
const page = await prisma.page.findUnique({
  where: { id },
  include: {
    owner: true,
    yourModel: true,  // add this
  },
});
```

TODO: Confirm whether a unified `/api/pages/[id]` response is the right contract, or whether
a dedicated `/api/[your-type]/[id]` route is preferable (as stores use `/api/store/[id]`).

---

### Step 6 — Front-end page type switches

Search for every place `pageType` is read in the frontend and add your new string:

**`app/app/initiatives/page.tsx`** (~line 30–32)
Labels pages in the Initiatives mobile feed by their type. Add a label/color entry for yours
if it should appear in this feed:
```ts
if (page.pageType === "your-type") return { label: "YourLabel", color: "#hexcode", bg: "rgba(...)" };
```

**`app/(with-nav)/self/tabs/EarningTab.tsx`** (~line 191)
Page creation UI. If your type should be selectable when a user creates a page, add it to the
type selector and the `pageType` mapping logic here.

**`app/store/[id]/page.tsx`** and **`app/(business)/business/store/[businessId]/page.tsx`**
Both check `store.pageType === "learning"` to toggle between store and course UI. If your
type renders in the same view, add a branch here.

TODO: Confirm whether the EarningTab is the only page creation UI, or if there are other entry
points (onboarding, admin, mobile) that also need updating.

---

### Step 7 — tabToComponentMap (conditional)

**File: `components/tabToComponentMap.tsx`**

This file maps **tab slugs** within the Self-layer navigation to React components. It is
unrelated to page types for content pages (stores, courses, initiatives).

You only need to add an entry here if your new page type introduces a **new tab in a layer
page** (e.g. a new tab under `/self` or `/society`). If your type is a standalone page
at `/your-type/[id]`, skip this step entirely.

If you do need a tab entry:
```ts
// In tabToComponentMap.tsx
const YourTab = dynamic(() => import("../app/(with-nav)/self/tabs/YourTab"), { ssr: false });

case "your-slug":
  return YourTab;
```

---

### Step 8 — CSP headers (conditional)

**File: `next.config.mjs`**

Only required if your new page type loads resources from an external domain not already
in the CSP. Check the current directives:

- `script-src`: `accounts.google.com`, `unpkg.com`
- `style-src`: `unpkg.com`
- `img-src`: `lh3.googleusercontent.com`, `drive.google.com`, `*.googleapis.com`, `res.cloudinary.com`, `*.tile.openstreetmap.org`
- `media-src`: `res.cloudinary.com`
- `connect-src`: `accounts.google.com`, `*.googleapis.com`, `api.cloudinary.com`, `*.tile.openstreetmap.org`
- `frame-src`: `accounts.google.com`, `www.youtube.com`

If your type embeds a new iframe, loads a new CDN, or connects to a new API, add the domain
to the relevant directive. Missing a domain causes a **silent browser block** in production
with no server-side error.

---

## Full Checklist

```
[ ] 1. Add sub-model to prisma/schema.prisma
        - pageId String @unique
        - onDelete: Cascade on page relation
        - back-relation on Page model
[ ] 1. Run: npx prisma migrate dev --name add-your-model
[ ] 1. Run: npx prisma generate

[ ] 2. Add pageType string to whitelist in app/api/user/pages/route.ts

[ ] 3. Create app/api/[your-type]/route.ts
        - POST: verify session, verify page ownership, create sub-model
        - Add GET, PATCH, DELETE as needed

[ ] 4. Check app/api/user/pages/route.ts DELETE handler
        - Only needed if your sub-model lacks onDelete: Cascade

[ ] 5. Decide whether GET /api/pages/[id] should include your sub-model
        - Add include: { yourModel: true } if yes

[ ] 6. Update pageType switches in the frontend
        - app/app/initiatives/page.tsx (feed labels)
        - app/(with-nav)/self/tabs/EarningTab.tsx (creation UI)
        - Any page that renders based on pageType

[ ] 7. Add to tabToComponentMap.tsx only if introducing a new layer tab

[ ] 8. Add CSP entries only if loading new external domains
```

---

## Known Inconsistencies to Be Aware Of

- `Store` does not follow the Page-first pattern. Its `pageId` is nullable, and it has no
  `page` relation in the Prisma schema. The `Page` model has no `store` field. This is a
  structural inconsistency with the other sub-models.

- `HealthBusiness` uses `pageType: "store"` (not a unique string) and is distinguished
  from actual stores by `Page.type = "health"`. When reading `pageType` alone, a
  HealthBusiness page is indistinguishable from a Store page.

- The `"service"` pageType appears in the UI label map in `initiatives/page.tsx` but has
  no corresponding sub-model in the schema. Its behavior is undefined.

- All sub-model creation routes use `prisma` from `lib/prisma.ts`, not `db` from `lib/db.ts`,
  despite the convention documented in CLAUDE.md. Match the pattern in this file area.

## Backlinks
- [[START_HERE.md]] — Page polymorphic model overview
- [[database.md]] — Page model schema, sub-model list
- [[pages.md]] — pages module ownership
- [[store.md]] — Store creation (Pattern B, legacy exception)
- [[navigation-tabs.md]] — tabToComponentMap context
