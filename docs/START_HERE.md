# START HERE — Charaivati AI Onboarding

This document is the single entry point for any AI agent or LLM working in this repository.
Read it fully before touching any file.

---

> **WARNING — API AUTH IS NOT HANDLED BY MIDDLEWARE**
>
> `middleware.ts` only protects page routes (`/self`, `/nation`, `/earth`, `/society`).
> It does **not** run on any `/api/*` route.
>
> Every API route must enforce auth manually:
> ```ts
> const token = getTokenFromRequest(req);
> const payload = await verifySessionToken(token);
> if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
> ```
> Never assume edge middleware handles API authentication. An API route with no
> manual auth check is completely unprotected.

---

## 1. What This System Is

Charaivati is a Next.js 15 full-stack web platform for personal development, community action, and economic participation — scoped initially to Assam, India. It wraps into a Capacitor native app (Android/iOS) pointing at `https://charaivati.com/app/home`.

The platform is organized around a **6-layer model** of scale:

```
Self → Society → State → Nation → Earth → Universe
```

Each layer has its own page (`/self`, `/society`, etc.) with data-driven tab navigation. Users work through goals, stores, courses, and community initiatives at each layer.

---

## 2. Tech Stack

| Concern | Technology |
|---|---|
| Framework | Next.js 15, App Router, React 19, TypeScript |
| Database | PostgreSQL via Prisma 6 ORM |
| Auth | JWT (jose), HTTP-only cookie |
| Styling | Tailwind CSS v4, inline styles in mobile shell |
| Toasts | sonner |
| Animation | framer-motion |
| Caching | Upstash Redis + ioredis |
| Images/Video | Cloudinary |
| File Storage | AWS S3 |
| Email | SendGrid |
| SMS | Twilio (abstracted behind `lib/sms/`) |
| Maps | Leaflet |
| 3D | Three.js + @react-three/fiber |
| Mobile | Capacitor 8 |
| Build | Vercel (custom script: `npm run vercel-build`) |

ESLint and TypeScript errors are **silenced during builds** (`ignoreDuringBuilds`, `ignoreBuildErrors` both true in `next.config.mjs`). Run `npm run lint` explicitly to catch issues.

---

## 3. Repository Layout

```
app/              Next.js App Router — pages, layouts, API routes
  (with-nav)/     Protected pages: /self /society /nation /earth
  (auth)/         Login, register, onboarding
  (public)/       Privacy, terms, security (no auth required)
  (business)/     Idea evaluator, plan builder
  (User)/         User profiles, avatar, edit
  (locality)/     Country selection, local area
  (state)/        State-level dashboard
  (earth)/        Environmental/global view
  (universe)/     Universe-level view
  app/            Capacitor mobile shell (bottom nav layout)
  earn/           Initiative Hub — owner pages at /earn/initiative/[pageId]
  api/            All REST endpoints (~150+)

components/       Shared UI components (no pages here)
lib/              Server utilities, shared logic, singleton clients
hooks/            Client-side React hooks
prisma/           schema.prisma + migrations
public/           Static assets
scripts/          One-off data scripts (ts-node)
docs/             This documentation tree
agents/           AI agent definitions (future)
```

---

## 4. Key Modules and What They Own

### `lib/db.ts` and `lib/prisma.ts`
Both export the **same** Prisma singleton. `db` (from `lib/db.ts`) is the canonical name used in API routes. `prisma` (from `lib/prisma.ts`) is a legacy alias. Do not create a third instance.

### `lib/session.ts`
Owns the entire auth session lifecycle: `createSessionToken`, `verifySessionToken`, `getTokenFromRequest`, `setSessionCookie`, `clearSessionCookie`, `getCurrentUser`. All API routes that need the current user call `getTokenFromRequest(req)` then `verifySessionToken(token)` from here.

Cookie name:
- Dev: `charaivati.session`
- Prod: `__Host-session` (requires HTTPS, no subdomain leakage)

### `middleware.ts`
Protects `/self`, `/nation`, `/earth`, `/society` at the edge. Redirects unauthenticated requests to `/login` and clears the stale cookie. Does not run on `_next/*`, `favicon.ico`, or `api/*`.

### `lib/featureFlags.ts`
Feature flag system backed by the `FeatureFlag` DB model. Currently all flags return `true` (effectively disabled). Check this before adding new gated features.

### `lib/rateLimit.ts`
Rate limiting for API routes. Apply to any endpoint that could be abused (auth, OTP, AI calls).

### `lib/csrf.ts`
CSRF token generation and validation. Must be used on any state-mutating API endpoint called from the browser.

### `lib/chat-crypto.ts`
ECDH P-256 key exchange + AES-GCM message encryption for direct messages. Ciphertext is stored in `ChatMessage.ciphertext` (base64). The server never sees plaintext. Do not modify this module without understanding the E2E model.

### `lib/writeQueue.ts`
Batched/deferred write queue for non-critical DB writes. Used to avoid blocking the request cycle on analytics or soft-state updates.

### `next.config.mjs`
Owns all HTTP security headers including CSP, HSTS, `X-Frame-Options: DENY`, and `Permissions-Policy`. **Any new external domain** (CDN, font, API) must be added here or it will be blocked in production.

### `app/app/layout.tsx`
The Capacitor mobile shell layout. Renders sticky top bar + 4-tab bottom nav. This is a client component. The four tabs are: Home (`/app/home`), Initiatives (`/app/initiatives`), Explore (`/app/saved`), Orders (`/app/orders`). The Account tab was removed — the M avatar in the top bar opens the account dropdown instead.

---

## 5. Database Model Relationships (Critical)

`Page` is a **polymorphic container**. One `Page` row backs a Store, Course, HealthBusiness, or HelpingInitiative. The `pageType` field determines which sub-model exists. `Page` also has `collaborationsIn` and `collaborationsOut` relations to the `Collaboration` model — Page-to-Page partnership links.

`Collaboration` connects two `Page` records with a `role` (`delivery_partner | supplier | employee | marketing | other`) and `status` (`pending | accepted | rejected | cancelled`). Unique on `[requesterId, receiverId, role]`. Both FK sides cascade-delete when the Page is deleted.

`StoreBlock` is **dual-purpose**: it is a product in a store and a lesson in a course. `actionType` determines behavior; `access: free | paid` controls gating.

`Tab` rows are canonical navigation entries. `UserTab` stores sparse per-user overrides (visibility, position, custom title). Do not hardcode tab names — always resolve from DB.

`Friendship` enforces **canonical ordering**: `userAId < userBId` lexicographically. Application code, not DB constraints, enforces this. Break the ordering and queries will fail silently.

`AiGoal` has four archetypes: `LEARN`, `BUILD`, `EXECUTE`, `CONNECT`. The execution plan is stored as JSON (`executionPlan`). Do not change the archetype enum values without migrating existing rows.

---

## 6. Critical Flows

### Auth Flow
1. User POSTs credentials to `/api/auth/login`
2. Server verifies password (bcrypt), creates JWT via `createSessionToken()`
3. JWT written to HTTP-only cookie via `setSessionCookie()`
4. Subsequent requests carry cookie automatically
5. `middleware.ts` verifies cookie on protected routes
6. API routes call `getTokenFromRequest(req)` → `verifySessionToken()` → `db.user.findUnique()`

Alternative entry points: magic link (`/api/auth/send-magic-link`) and SMS OTP (`/api/auth/otp/`). Both ultimately set the same session cookie.

**Registration flow** — `POST /api/user/register` sends a verification email and returns 200 without setting a session. The login page enters `verify-pending` state (no redirect). User clicks email link → `GET /api/user/magic` → `/verified` page → "Sign in to continue →" → `/login` (pre-filled) → password → session cookie set → redirect to original destination.

### Guest-to-real merge (fires automatically on login and email verification)
1. Guest browses as a `User` with `status: "guest"` and no email
2. On **register**, the guest session cookie is read and `guestId` is embedded in `MagicLink.meta`
3. On **email verification** click (`GET /api/user/magic`): `mergeGuestToReal(guestId, realId)` runs — prefers `meta.guestId`, falls back to live cookie; then redirects to `/verified` (not `/login`)
4. On **login** (`POST /api/user/login`): same merge fires after session token is created
5. Merge is a single Prisma transaction: cart (quantities summed), wishlist, pinned stores, page follows (initiatives), addresses, orders, owned Pages, owned Stores → guest user deleted
6. Calling merge twice is safe — duplicates are skipped and a deleted guest is a no-op
7. Manual path: `POST /api/user/claim-guest` with `{ guestId }` for retroactive recovery
8. Guest UI: store nav and app shell detect `user.status === "guest"` from `/api/user/me` and show "Sign in / Sign up" instead of account links

### Main User Journey (Web)
1. Any page request without a `"lang"` cookie and no valid session → **middleware language gate** redirects to `/?redirect=<path>`
2. Land on `/` (`app/page.tsx` — middleware skips this route):
   - Authenticated → redirect to `/self`
   - Unauthenticated + `"lang"` key in localStorage → redirect to `/login` (forwarding `?redirect=` if middleware passed one)
   - Unauthenticated + no saved language → show language picker; on selection `setLanguage()` writes localStorage + cookie then redirects to `/login?redirect=<path>`
3. After login → `/self` (or the preserved `?redirect=` destination)
4. `/self` is the personal dashboard — goals, health, hobbies, analytics
5. Layer nav (top) switches between Self / Society / Nation / Earth / Universe
6. Each layer renders tabs from the `Tab` table (filtered by `levelId`)
7. Tab content is dynamic — `tabToComponentMap.tsx` maps tab slugs to React components

### Main User Journey (Mobile / Capacitor)
1. App opens → loads `https://charaivati.com/app/home`
2. Layout is `app/app/layout.tsx` — bottom nav drives navigation
3. Bottom tabs: Home, Initiatives, Explore, Orders (`/app/orders`)
4. Auth state fetched from `/api/user/me` on layout mount

### Initiative Hub (owner management page)
1. Owner clicks "Open →" on an initiative card in `/app/initiatives` (mobile) or in the desktop EarningTab summary list
2. Navigates to `/earn/initiative/[pageId]` — a server component page
3. Server reads session cookie via `cookies()` + `verifySessionToken()` (not middleware, not `getServerUser`)
4. Fetches Page (with course, helpingInitiative, collaborationsIn/Out), linked Store, and all pages owned by the user
5. Renders page title + type badge + `InitiativeTabs` client component
6. Tabs: **Overview** (links to existing manage/evaluate flows), **Store** (link or set-up CTA), **Partners** (`PartnersTab`)

### Collaboration (Partners tab)
1. `PartnersTab` mounts → 3 parallel fetches: `in+accepted`, `out+accepted`, `in+pending`
2. Active partners (merged in+out, deduplicated) shown with Revoke button (DELETE)
3. Incoming pending requests shown with Accept/Reject buttons (PATCH)
4. Invite form: search stores by name → `GET /api/store/search?q=` (debounced 300ms) → pick from dropdown → select role → send (POST)
5. `POST /api/collaboration` resolves Store IDs and slugs to their linked Page automatically
6. PATCH response must include `requester`/`receiver` page fields — frontend reads `.title` for optimistic state update

### Delivery Tracking (order fulfillment with live GPS)
1. Owner selects an accepted Collaboration partner in the order management UI (`/store/[id]/orders`) — `PATCH /api/order/[id]/delivery { assignedToId: collabId }`
2. Owner advances `deliveryStatus` through a 5-step stepper: `pending → confirmed → processing → out_for_delivery → delivered` (or `cancelled` at any point)
3. Partner sees assigned orders in `/earn/deliveries` (server component, cookie auth) — only `out_for_delivery` orders appear
4. Partner clicks "Start GPS" in `DeliveriesClient.tsx` → `useGeolocation()` hook → `POST /api/transport/broadcast` on an interval; `Order.vehicleId` is set to the new `Vehicle` row ID
5. Buyer at `/order/[id]/track` polls `GET /api/transport/vehicles?id={vehicleId}` every 5 s and shows the partner on `TransportMap`. If `vehicleId` is null, shows "Delivery partner hasn't started GPS yet."
6. Partner clicks "Mark Delivered" → `PATCH /api/order/[id]/delivery { status: "delivered" }` → Broadcaster stops → `Vehicle` row deleted. `Order.vehicleId` is **not** cleared; the tracking page handles stale IDs because the vehicles API filters by `updatedAt >= 2 min ago`.

### AI Store Setup Wizard (new store onboarding)
1. Owner creates a `Page` via `/app/initiatives` (mobile) and clicks "Open →" → Initiative Hub → Store tab → "Set up store"
2. `InitiativeTabs.handleOpenStore()` → `GET /api/store/for-page/${pageId}` → finds/creates `Store`, counts `StoreSection` rows
3. Response: `{ storeId, storeSlug, isNew: sectionCount === 0 }`
4. If `isNew: true` → `window.location.href = /store/${storeId}/setup` (hard nav — `router.push` drops cross-layout-root navigations)
5. **Fallback**: if user reaches `/store/[id]` any other way and still has 0 sections + `isOwner`, `fetchStore` calls `window.location.replace(/store/${id}/setup)` unless `sessionStorage.setup_skipped_${id}` is set
6. Wizard step 1: owner describes their business in plain English
7. `POST /api/store/ai-setup` → one `chatComplete` call → JSON structure + images batch-fetched via `lib/imageSearch.ts` `fetchImages()` in parallel (Unsplash → Pexels → Pixabay rotating, Picsum guaranteed fallback)
8. Wizard step 2: owner edits titles/prices inline, removes unwanted sections
9. `POST /api/store/ai-setup/apply` → single Prisma transaction (30 s timeout): filters → sections → tiles → per-filter banners → blocks → one global `StoreBanner`
10. On success: wizard redirects to `/store/${storeId}`; `fetchStore` sees `sections.length > 0` so no redirect loop
11. Skip at any step → `skipToStore()` sets `sessionStorage.setup_skipped_${storeId}` then navigates to the store directly

Image env vars (all optional — `lib/imageSearch.ts` skips missing providers): `UNSPLASH_ACCESS_KEY`, `PEXELS_KEY`, `PIXABAY_KEY`. Picsum is the guaranteed no-key fallback so images are never `null`.

### Store Purchase Flow — Cart (standard)
1. User browses `/store/[id]` — sections and blocks fetched
2. `POST /api/store/cart/[storeId]` — add block to cart; "Add to Cart" button flashes "✓ Added" for 2 seconds
3. `POST /api/store/orders` — checkout, creates `Order` with JSON snapshot of items, clears cart
4. Order status progresses: `pending → confirmed → shipped → delivered`

### Store Purchase Flow — Buy Now (express)
1. User clicks "Buy Now" on a product card (section page) or on a wishlist item (Saved page)
2. `QuickOrderModal` opens with item pre-loaded and selected qty; cart is never touched
3. Steps: Items review (inline qty stepper) → Delivery address → Invoice profile (optional) → Place order
4. `POST /api/store/orders/quick` with `{ storeId, addressId, items[], billingProfileId? }` — creates `Order` directly
5. On success: confirmation screen with order ID + "View my orders" link

### Store Order Management (owner side)
- `GET /api/store/orders?storeId=X` — orders for one store (owner-only)
- `GET /api/store/orders?storeId=X&status=delivered` — filter by any status value
- `GET /api/store/orders?all=true` — orders across **all** stores owned by the user; each order includes `store { id, name }`
- `/store/[storeId]/orders` — active order list with status-update controls; "Delivered Orders →" button in header
- `/store/[storeId]/orders/delivered` — read-only delivered archive; no status-update buttons; "← Active Orders" back link
- `/store/orders/all` — aggregated view across all owned stores; store name shown as a chip on each card; full status-update controls
- `/store/account?tab=stores` — summary view: "All Orders" pill plus per-store pills; "View all →" routes to the correct full page

### Billing Profiles
- Users save multiple billing profiles (`BillingProfile` model) for GST / invoice use
- Each profile: `legalName` (required), `companyName`, **GST block** (`gstRegistered Boolean`, `gstin`, `gstState`, `annualTurnover`), billing address fields, optional `linkedStoreId`
- Managed in `/store/account?tab=invoice` — Tax & Compliance toggle controls the GST block; GSTIN auto-derives state from first 2 digits; `above_5Cr` turnover shows an e-invoice warning
- Selected during `QuickOrderModal` step 3 and `CheckoutModal` step 2; selected profile is **serialised into `Order.invoiceData` JSON** — no FK on the Order row
- API: `GET/POST /api/store/billing-profiles`, `PATCH/DELETE /api/store/billing-profiles/[profileId]`

### Store Image Pool (upload dedup)
All store image uploads route through `lib/store/uploadImage.ts` — `uploadStoreImage(file, storeId)`. **Never call Cloudinary directly from store UI components.**

The pipeline:
1. Hash file client-side (SHA-256 via `crypto.subtle`)
2. Check DB — if hash exists for this store, return existing record immediately (`alreadyExisted: true`)
3. Upload to Cloudinary (`cloud: dyphnp3oc`, preset `posts_unsigned`, `public_id = fileHash`)
4. Upsert into `StoreImage` — handles any race condition between steps 2 and 4

`StoreImage` fields (post-migration): `id`, `storeId`, `url`, `cloudinaryId`, `fileHash`, `fileName`, `uploadedAt`. Old fields `name`, `imageUrl`, `imageKey`, `createdAt` are gone — do not reference them.

API surface:
- `POST /api/store/images/check` — hash lookup; returns `{ exists: true, image }` or `{ exists: false }`
- `POST /api/store/images/save` — upsert on `[storeId, fileHash]`
- `GET /api/store/images/list?storeId=` — list images for a store (owner only)
- `GET /api/store/[id]/images` — same list, legacy path used by BulkImageUploadModal

Picker UI: `StoreImagePickerModal` (in `components/store/`) — shows grid, search, "Upload new" button. Opened from the product block form ("Choose from library"). "Paste URL instead" toggle is the fallback for external URLs.

### Store Slugs
- Every store has a `slug String? @unique` field generated from its name at creation (`lib/store/generateSlug.ts`)
- `GET /api/store/[id]` resolves both cuid and slug — cuids via `findUnique`, slugs via `SELECT id FROM "Store" WHERE slug = $1` raw SQL
- Store pages redirect `router.replace()` to the slug URL if the current URL uses a cuid — canonical URL is always the slug
- All store-listing APIs inject slug via `getStoreSlugs()` from `lib/store/getStoreSlugs.ts`
- `scripts/migrateStoreSlugs.ts` was used to backfill slugs for stores created before the field was added
- **Stale-client warning**: `Store.slug` may not be in the Prisma generated client if `prisma generate` failed (EPERM on Windows while dev server runs). Always use `$queryRaw` for slug-field operations until `prisma generate` succeeds.

### Invoice System (auto-generate on delivery, owner signs, buyer downloads)
Routes: `app/api/orders/[orderId]/invoice/` (generate), `.../sign/` (signed upload), `.../download/` (authenticated proxy).

1. Owner marks order **delivered** → client auto-calls `POST /api/orders/[orderId]/invoice`
2. Server renders PDF via `@react-pdf/renderer` (`lib/invoice/InvoiceDocument.tsx`); `invoiceType` is `"tax_invoice"` if seller's `BillingProfile.gstRegistered`, else `"bill_of_supply"`
3. PDF uploaded to Cloudinary as `resource_type: "raw", type: "authenticated"` — access-controlled, not publicly fetchable
4. `invoiceUrl`, `invoiceNumber`, `invoiceType`, `invoiceGenAt` written to Order
5. Owner UI shows 3 states: generating → unsigned ready + sign-upload form → signed done
6. Owner uploads signed PDF → `POST .../sign` → `invoiceSignedUrl` saved via `$executeRaw`
7. Buyer sees **Signed Invoice** download link when `invoiceSignedUrl` exists; "Invoice pending signature" if only `invoiceUrl` exists

Download proxy: `GET .../download` — derives `public_id` deterministically (`invoices/{orderId}` or `invoices/signed/{orderId}_signed`), generates a 60-second `private_download_url` signed token, streams PDF back. Raw Cloudinary URLs are never sent to the browser.

Env: `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (used by both client and server — there is no separate `CLOUDINARY_CLOUD_NAME`); `CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` from `.env.local` and Vercel env vars.

**GST tax invoice and e-invoice cases pending testing.** The `"tax_invoice"` branch and `annualTurnover: "above_5Cr"` (IRN/IRP required) UI exist but have not been verified end-to-end with a real GSTIN.

### Product Ratings
- `ProductRating` model: one rating (1–5) per user per `StoreBlock`; `@@unique([productId, userId])`
- Store owners get a 403 from the rate endpoint
- Section pages batch-fetch all ratings in one `GET /api/store/products/ratings?ids=...` call (uses `groupBy` aggregates — never N+1)
- `StarRating` component handles hover, click-to-rate, "Thanks for rating!" feedback, owner/logged-out display-only modes

**Wishlist toggle:** `POST /api/store/wishlist` is a toggle — if the item exists it deletes it (`{ wishlisted: false }`), otherwise creates it (`{ wishlisted: true }`). Requires both `blockId` and `storeId`. There is no separate DELETE endpoint for wishlist items.

---

## 7. Unprotected Routes

The following routes have **no server-side auth enforcement** of any kind — neither middleware nor manual API checks gate them by default:

| Route | Protection | Notes |
|---|---|---|
| `/state` | None — client-side only | State-level dashboard; unprotected by middleware |
| `/universe` | None — client-side only | Universe-level view; unprotected by middleware |
| `/app/*` | None — client-side only | Entire Capacitor mobile shell; auth state is fetched client-side via `/api/user/me` but there is no server redirect |

**Known risk:** A user who navigates directly to `/state`, `/universe`, or any `/app/*` page without a valid session will hit the page. Whether they see real data depends entirely on whether the page's own data-fetching calls return 401 and the component handles it.

**Do not add new protected features to these routes** without first adding server-side session verification to their layouts or pages, or extending `middleware.ts` to cover them.

---

## 8. Coding Conventions Observed

**API routes**
- All routes are in `app/api/` as `route.ts` files
- Export named functions: `export async function GET(req: Request)`, `POST`, etc.
- Auth pattern: `const token = getTokenFromRequest(req); const payload = await verifySessionToken(token); if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });`
- Return shape: `NextResponse.json({ data })` on success, `NextResponse.json({ error: string })` on failure
- Status codes used: 200, 201, 400, 401, 403, 404, 422, 500

**Database access**
- Always use `db` from `lib/db.ts` in API routes (not `prisma`)
- Prefer `findUnique` with explicit `select` over `findFirst` with `*`
- No raw SQL unless unavoidable

**Components**
- Client components are marked `"use client"` at the top
- Server components have no marker (default in App Router)
- Inline styles are used in the mobile shell (`app/app/`) — Tailwind is used everywhere else
- No component-level CSS modules

**TypeScript**
- `any` is tolerated in existing code (ESLint rule disabled)
- New code should type properly; avoid `any` in new files
- Shared types live in `lib/types.ts`

**No comments by default.** Only add a comment when the reason is non-obvious. The codebase is mostly uncommented — match that style.

---

## 9. Forbidden Modifications

**Do not touch without full understanding:**

| File / Area | Why |
|---|---|
| `lib/chat-crypto.ts` | E2E encryption. Breaking this corrupts all chat data. |
| `lib/session.ts` | Changing cookie names or JWT structure logs everyone out. |
| `middleware.ts` | Misconfiguring the matcher can expose protected routes. |
| `next.config.mjs` CSP headers | Removing a directive can break prod; adding a loose one (`unsafe-eval`) is a security regression. |
| `prisma/schema.prisma` enum values | Changing `AiGoal.archetype`, `Order.status`, `Post.visibility`, etc. without a migration breaks existing rows. |
| `Friendship` ordering logic | The `userAId < userBId` invariant is enforced in app code only. Breaking it causes duplicate friendships and broken queries. |
| `app/app/layout.tsx` | This is the Capacitor shell. Breaking it breaks the mobile app for all users. |
| `lib/featureFlags.ts` | Currently always returns `true`. If real flag logic is re-enabled, every feature must be checked. |

**Never:**
- Store secrets or tokens in client-side code or `localStorage`
- Add `unsafe-eval` to the CSP
- Create a second Prisma client instance
- Bypass `middleware.ts` by adding auth logic inline to page components
- Use `git push --force` on `main`

---

## 10. Security

A full static security audit is at [docs/SECURITY_AUDIT.md](SECURITY_AUDIT.md).

**Critical issues that must be fixed before further public launch:**

| Priority | File | Issue |
|---|---|---|
| 1 | `app/api/debug-db/route.ts` | **No auth — returns DATABASE_URL.** Delete this file. |
| 2 | `app/api/user/register-temp/route.ts` | **No auth — overwrites any user's password.** Delete this file. |
| 3 | `app/api/users/search/route.ts` | **No auth — returns email + phone for all users.** Add session auth. |
| 4 | `app/api/transport/broadcast/route.ts` | **No auth — GPS spoofing.** Add session auth + partner ownership check. |
| 5 | `app/api/tests/ai`, `goal-ai/refine`, `goal-ai/summary`, `goal-ai/reflect`, `ai/suggest-actions` | **No auth — free AI API abuse + prompt injection.** Add session auth + rate limiting. |

See `docs/SECURITY_AUDIT.md` for the full 28-finding report with file references, exploit descriptions, and recommended fixes.

---

## 11. Glossary

| Term | Meaning |
|---|---|
| **Layer** | One of the 6 scale levels: Self, Society, State, Nation, Earth, Universe |
| **Page** | Polymorphic DB record that backs a Store, Course, HealthBusiness, or HelpingInitiative |
| **Block** | Atomic content unit inside a Section — either a product (store) or lesson (course) |
| **Section** | A group of Blocks within a Store or Course, with layout metadata |
| **Tab** | A navigation entry in a Layer, resolved from the `Tab` DB table |
| **UserTab** | Sparse per-user override of a canonical Tab (visibility, position, title) |
| **Level** | DB record representing one of the 6 layers (has `key`, `name`, `order`) |
| **Archetype** | AiGoal classification: `LEARN`, `BUILD`, `EXECUTE`, `CONNECT` |
| **Circle** | A named group of friends owned by a user (`FriendCircle`) |
| **Helping Initiative** | An NGO/charity-style page with objectives, actions, metrics |
| **Collaboration** | A `Collaboration` DB record linking two `Page` records with a role and status — the Partners system |
| **Initiative Hub** | The owner-only page at `/earn/initiative/[pageId]` with Overview / Store / Partners tabs |
| **Store** | A product/service marketplace page owned by a user |
| **Block access** | `free` or `paid` — controls whether a Block requires purchase |
| **Canonical ordering** | The `userAId < userBId` constraint on `Friendship` and `ChatConversation` |
| **Mobile shell** | `app/app/layout.tsx` — the Capacitor-wrapped layout served at `/app/*` |
| **`db`** | The canonical Prisma client from `lib/db.ts` |
| **`prisma`** | Legacy alias for the same client from `lib/prisma.ts` |
| **Session cookie** | `charaivati.session` (dev) / `__Host-session` (prod) — HTTP-only JWT |
| **Sahayak** | Public help/support section under `(public)/sahayak` |
| **pageType** | Discriminator on `Page`: `store`, `course`, `health-business`, `helping-initiative` |
