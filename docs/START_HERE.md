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

`Page` is a **polymorphic container**. One `Page` row backs a Store, Course, HealthBusiness, or HelpingInitiative. The `pageType` field determines which sub-model exists. `Page` also has `collaborationsIn` and `collaborationsOut` relations to the `Collaboration` model — Page-to-Page and Page-to-User partnership links.

`Collaboration` has two member types: **Page-to-page** (`receiverPageId` set — delivery partners, suppliers, external collaborators) and **Page-to-user** (`receiverUserId` set — employees, personal team members added via friend-invite). `role` is the collaboration kind (`delivery_partner | supplier | employee | marketing | other`); `status` is `pending | accepted | rejected | cancelled`. Unique on `[requesterId, receiverPageId, role]` and `[requesterId, receiverUserId, role]`. Exactly one of `receiverPageId`/`receiverUserId` must be set — enforced at API level. All FK sides cascade-delete. `Page` has `collaborationsIn`/`collaborationsOut`; `User` has `receivedCollaborations`.

`StoreBlock` is **dual-purpose**: it is a product in a store and a lesson in a course. `actionType` determines behavior; `access: free | paid` controls gating. Two additive fields were added for the Menu Parse feature: `imageProvider String?` (`"unsplash"` / `"pexels"` / `"pixabay"` / `"picsum"` / `"user"`) and `imageQuality Int @default(0)` (0–3 scale). The cron upgrade job (`/api/cron/upgrade-images`) uses these to progressively improve low-quality images.

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

### Friend invite flow (Feature A)
1. Authenticated user POSTs `{ email }` to `POST /api/invite` (max 10/24h)
2. Server **always** returns the same generic success message — no enumeration
3. If email is unregistered: creates shell user (`status: "invited"`), creates `Invite` row, sends join email with `https://charaivati.com/claim/{rawToken}` (token in path, never query string; `Referrer-Policy: no-referrer` set)
4. If email is already registered: sends silent security notice to that address, logs attempt — no invite created
5. Recipient clicks claim link → `app/claim/[token]/page.tsx` (server component validates token)
6. Invalid/expired (or attempts ≥ 5): shows neutral error page (no reason disclosed)
7. Valid: renders "Join" page → user clicks → Server Action `claimInvite()` → atomic transaction: `Invite.status → claimed`, shell `User.status → lite`, `contactVerified → true`, `emailVerified → true` → session issued → redirect `/self`

### Admin direct-create (Feature B)
1. Admin (email in `ADMIN_EMAILS` env var) POSTs `{ email, tempPassword }` to `POST /api/admin/users`
2. Server re-checks admin gate server-side — client flags not trusted
3. Creates user: `status: "lite"`, `mustChangePassword: true`, `contactVerified: false`, `createdByAdminId: <admin.id>`; hashes temp password
4. Every creation logged server-side (adminId + targetEmail + timestamp)
5. On user's first login: `{ mustChangePassword: true, redirect: "/change-password" }` is returned
6. `/change-password` → `POST /api/user/change-password` → clears `mustChangePassword`, user proceeds normally

### User status values
| Status | Meaning |
|---|---|
| `"guest"` | Anonymous user with no email; created automatically for anonymous browsing |
| `"invited"` | Shell user created when an invite email is sent; no password |
| `"lite"` | Account after invite claim or admin-create — limited access until more verification |
| `"active"` | Full account — email verified via standard registration flow |

### `contactVerified` vs `emailVerified`
- `emailVerified`: set when the user clicks any emailed link (verify-email, magic link, invite claim)
- `contactVerified`: set only when inbox ownership is proven via a **clicked emailed link** (invite claim, magic link). NOT set for admin-created accounts. Used to gate Earn-layer money actions via `lib/requireVerifiedContact.ts`.

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
6. PATCH response must include `requester`/`receiverPage` page fields — frontend reads `.title` for optimistic state update

### Team tab — two invite paths
- **From Partners**: promotes an accepted partner-scope page-to-page Collaboration to `scope="team"` via `PATCH /api/initiative/[pageId]/team/[collaborationId]`
- **Invite Friend**: creates a new `scope="team"` Collaboration with `receiverUserId` (page-to-user) via `POST /api/initiative/[pageId]/team/invite-user { userId, teamRole, customRole? }` — requires the target to be an accepted friend of the page owner. `status="accepted"` on creation (no request flow). Removing calls `DELETE /api/initiative/[pageId]/team/[collaborationId]`.
- Team member cards render both types: `receiverUserId` set → show `receiverUser.name`/`avatarUrl`; otherwise show `receiverPage.title`/`avatarUrl`.

### Delivery Tracking (order fulfillment with live GPS)
1. Owner selects an accepted Collaboration partner in the order management UI (`/store/[id]/orders`) — `PATCH /api/order/[id]/delivery { assignedToId: collabId }`
2. Owner advances `deliveryStatus` through a 5-step stepper: `pending → confirmed → processing → out_for_delivery → delivered` (or `cancelled` at any point)
3. Partner sees orders in `/earn/deliveries` (server component, cookie auth) — orders with `partnerStatus IN ('assigned', 'accepted')` appear. Accepted cards show a **PICK UP FROM** section (store name + owner's default address as pickup proxy, `tel:` link, "🗺️ Navigate to pickup" Google Maps link) and a **"🗺️ Navigate to delivery"** button above GPS controls. Both links open in a new tab; precise-pin URL when `Address.lat/lng` are set, text-search fallback otherwise.
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

### Store Open/Closed (`Store.acceptingOrders`)
Every store has a manual `acceptingOrders Boolean @default(false)` toggle. New stores are **closed by default**. Owner flips it from `StoreHero` (store page) or the Initiative Hub Store tab. Both order routes (`POST /api/store/orders` and `POST /api/store/orders/quick`) return 422 with `"This store isn't taking orders right now."` when the store is closed — this is the authoritative guard. Buyer-facing: green "Taking orders" pill or amber "Not taking orders right now" banner on store page and section pages; Buy buttons are greyed out. `Store.hoursText String?` is a display-only string (set by menu parser or owner); not parsed or enforced.

### Store Purchase Flow — Cart (standard)
1. User browses `/store/[id]` — sections and blocks fetched
2. `POST /api/store/cart/[storeId]` — add block to cart; "Add to Cart" button flashes "✓ Added" for 2 seconds
3. `POST /api/store/orders` — checkout, creates `Order` with JSON snapshot of items, clears cart; **rejected with 422 if store is closed**
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

## 7. Feature Area Starting Points

Quick reference for jumping into a specific area. Read the linked doc before touching the code.

| Feature area | Primary entry files | Reference |
|---|---|---|
| **Store** (products, sections, banners) | `app/store/[id]/page.tsx`, `app/api/store/` | `docs/modules/store.md` |
| **Order management** (owner) | `app/store/[id]/orders/page.tsx`, `app/store/orders/all/page.tsx` | `docs/modules/store.md` § Key Pages |
| **Checkout** (cart + Buy Now) | `components/store/QuickOrderModal.tsx`, `app/api/store/orders/quick/route.ts` | `CLAUDE.md` § Buy Now / Quick Order UX |
| **Guest checkout** | `lib/mergeGuest.ts`, `app/api/user/magic/route.ts` | `CLAUDE.md` § Guest Account Merge |
| **Fleet initiative** | `app/fleet/[pageId]/page.tsx`, `app/api/fleet/[pageId]/route.ts` | `CLAUDE.md` § Fleet Initiative Type |
| **Workflow** (order fulfillment steps) | `lib/workflow/`, `components/earn/WorkflowTab.tsx` | `CLAUDE.md` § Store Initiative System |
| **Delivery** (partner GPS, partner dashboard) | `app/earn/deliveries/page.tsx`, `components/earn/DeliveriesClient.tsx` | `docs/modules/transport.md` |
| **Order tracking** (buyer live map) | `app/order/[id]/track/page.tsx`, `app/api/transport/vehicles/route.ts` | `docs/modules/transport.md` |
| **In-app notifications** (bell + SSE) | `components/notifications/NotificationBell.tsx`, `app/api/notifications/` | `docs/modules/notifications.md` |
| **Initiative Hub** (owner dashboard) | `app/earn/initiative/[pageId]/page.tsx`, `components/earn/InitiativeTabs.tsx` | `CLAUDE.md` § Initiative Hub |
| **Pricing / delivery cost** | `lib/workflow/calculateDeliveryCost.ts`, `lib/workflow/assignNextPartner.ts` | `CLAUDE.md` § Store Initiative System |
| **Partners / Collaboration** | `app/api/collaboration/`, `components/earn/PartnersTab.tsx` | `docs/modules/collaboration.md` |
| **Auth** (login, register, sessions) | `lib/session.ts`, `app/api/auth/`, `app/api/user/` | `docs/modules/auth.md` |
| **Invoice** (PDF, sign, download) | `lib/invoice/`, `app/api/orders/[orderId]/invoice/` | `CLAUDE.md` § Invoice System |
| **Business idea evaluation** (BIZDOC) | `app/(business)/business/idea/page.tsx`, `app/api/business/idea/`, `app/api/business/questions/` | `CLAUDE.md` § Claude Code prompt workflow; seed: `npm run seed:questions` |

**Initiative types** — active: `store`, `service`, `fleet`. Gated but built: `health`, `learning`, `helping`, `community_group`. Toggle: `ACTIVE_INITIATIVE_TYPES` in `app/app/initiatives/page.tsx:54`.

---

## 8. Unprotected Routes

The following routes have **no server-side auth enforcement** of any kind — neither middleware nor manual API checks gate them by default:

| Route | Protection | Notes |
|---|---|---|
| `/state` | None — client-side only | State-level dashboard; unprotected by middleware |
| `/universe` | None — client-side only | Universe-level view; unprotected by middleware |
| `/app/*` | None — client-side only | Entire Capacitor mobile shell; auth state is fetched client-side via `/api/user/me` but there is no server redirect |

**Known risk:** A user who navigates directly to `/state`, `/universe`, or any `/app/*` page without a valid session will hit the page. Whether they see real data depends entirely on whether the page's own data-fetching calls return 401 and the component handles it.

**Do not add new protected features to these routes** without first adding server-side session verification to their layouts or pages, or extending `middleware.ts` to cover them.

---

## 9. Coding Conventions Observed

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

**Loading states** — see [`docs/modules/loading-states.md`](modules/loading-states.md) for the full reference. Short rules:
- Skeleton (`animate-pulse` blocks matching content dimensions) over spinners for page/list loading
- `loading.tsx` sibling for every non-dynamic App Router route
- Per-item `useState<string | null>(null)` guard on every async button; always `disabled` + `.finally()` cleanup
- No `setTimeout` to delay content reveal

---

## 10. Forbidden Modifications

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

## 10a. Known Production Risks

| Risk | Location | Action Required Before Launch |
|---|---|---|
| **Quote timeouts use in-process `setTimeout`** | `lib/workflow/triggerQuoteRequests.ts` | Replace with BullMQ or a durable job queue. A server restart silently drops all pending timeouts — quotes will never be rejected and `requiresAttention` will never be set. |
| **Chat system messages stored as plaintext** | `lib/workflow/triggerQuoteRequests.ts` + any chat renderer | `ChatMessage` rows with `iv = "system"` contain plaintext in `ciphertext`. Renderers must check `iv === "system"` and skip decryption. See `CLAUDE.md` for the full note. |
| **Prisma client stale for new columns** | `Order.parentOrderId/subOrderType/agreedAmount`, `Notification` model, `WorkflowStepAssignee` model, `OrderStepProgress.currentAssigneeId/cycleCount/lastFeeMultiplier` | These were added via Neon MCP migrations but `prisma generate` fails on Windows while the dev server runs (EPERM). All affected code uses `(prisma as any)`. Run `npx prisma generate` after stopping the dev server to restore type safety. |
| **Sub-orders appear alongside parent orders** | `GET /api/store/orders?storeId=X` | The query does not filter by `parentOrderId IS NULL`. Sub-orders (with the same `storeId`) are returned as top-level items. Add the filter if the owner's order list becomes cluttered. |
| **`DATABASE_PRISMA_URL` missing UTC timezone → wrong timestamps** | `.env.local`, Vercel env vars | Neon's session default is IST. All three connection strings (`DATABASE_PRISMA_URL`, `DATABASE_URL`, `DIRECT_URL`) must include `&options=-c%20timezone%3DUTC`. Without it, `createdAt` timestamps are stored 5:30h ahead of UTC and notification "X ago" times appear hours wrong. `.env.local` is fixed; **set `DATABASE_PRISMA_URL` with the parameter in Vercel's env vars dashboard**. |

---

## 11. Security

A full static security audit is at [docs/SECURITY_AUDIT.md](SECURITY_AUDIT.md).

**AI Guardrails** — every `POST /api/chat` request runs a three-layer check (input scan → hardened system prompt → output scan). Blocked events are persisted to the `GuardrailEvent` DB table and emailed to `ADMIN_ALERT_EMAIL`. Admin dashboard: `/admin/security` (requires session user email === `ADMIN_EMAIL` env var). Full spec: [docs/AI_SECURITY.md](AI_SECURITY.md).

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

## 12. Glossary

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

---

## AI Setup

### Local Ollama (primary provider)
The dev machine runs Ollama locally, exposed via Cloudflare Tunnel at `https://ollama.charaivati.com`.
Both local dev and Vercel production use this URL as the primary AI provider.

**Auto-starts on boot** — no manual action needed:
- `OllamaServe` scheduled task starts `ollama serve` at logon
- `OLLAMA_HOST=0.0.0.0` is a permanent Windows system env var
- Cloudflare tunnel runs as a Windows service (`cloudflared`)

**To verify it's running:**
```
https://ollama.charaivati.com/api/tags
```
Should return JSON with available models (`gemma4:e2b`, `llama3:8b`, `llava:7b`).

**If it's down** — check on the dev machine:
1. Task Manager → check `ollama.exe` is running
2. Services → check `Cloudflared` is running
3. Manually: `ollama serve` in PowerShell

**Ollama version: v0.30.4.** Do not downgrade — v0.21.x crashes on vision requests (llava).

### Models Available
- `llama3:8b` — primary, used for chat and most AI routes
- `gemma4:e2b` — alternative, larger context
- `llava:7b` — vision model; required by `POST /api/store/parse-menu` (menu photo → JSON extraction)

### Model Tiers
Models map to tiers (`junior` / `assistant` / `senior` / `council`) that control UI labels in the chatbot widget. See `lib/ai/modelTiers.ts` for the full map and `getTierUI(modelName)` for label strings.

`chatCompleteWithMeta()` in `app/api/aiClient.ts` wraps `chatComplete()` and also returns `{ source, coldStart, model }`. Use it when the calling route needs to know which provider actually responded. `POST /api/chat` uses this and forwards `tier`, `tierUI`, `source`, `coldStart`, and `localExpected` to the widget.

The Ollama caller now has resilience built in: network errors fall through to cloud immediately; an empty response (model loading) waits 8 s and retries once before falling through.

### Companion System (Phase 1 — Foundation)
The Companion is a periodic AI-initiated conversation layer that builds a `UserCompanionProfile` for each user over time. It tracks five pillars: Time, Health/Energy, Drive type, Hobbies, and Location. Profile data is injected into every chat system prompt for personalised responses.

Key files:
- `lib/companion/signalParser.ts` — extracts structured signals (health flags, drive signals, time signals) from raw chat text
- `lib/companion/arcStateMachine.ts` — manages arc progression (stages 0–7+) and produces the stage instruction injected into AI system prompts
- `app/api/companion/session/route.ts` — `POST` updates the profile from a message, advances arc stage, recomputes energy state
- `app/api/companion/nudge/route.ts` — `GET` is **read-only**: checks `nudgeDueAt`, returns `{ nudgeDue, message }`, no writes. `POST` is the **acknowledge** action: advances `nudgeDueAt` (energy-state-based delay), idempotent. The ChatBot widget calls GET on mount to show/hide the red dot; calls POST when companion opens or banner is dismissed.
- `app/api/aiClient.ts` — `buildCompanionContext()` builds the profile block injected into all chat system prompts
- `ai-context/COMPANION_PHILOSOPHY.txt` — AI instruction file for companion session behaviour

Arc stages: 0 (invite) → 1 (time) → 2 (health) → 3 (drive) → 4 (hobbies) → 5 (location) → 6 (ideas) → 7+ (ongoing check-ins)

Energy states: `charged` / `grounded` / `stretched` / `depleted` — controls suggestion density and tone.

**Phase 2** (built): red dot on chat bubble; nudge banner on `/app/home`; both entry points open companion mode in place with a seeded greeting already visible in the widget — no navigation, no separate page. Tapping the red-dot bubble calls `openCompanion(true)`; banner "Let's chat" dispatches `charaivati:open-companion`. Both produce identical UX: companion mode + seeded greeting + nudge acknowledged.
**Phase 3**: energy state display in Personal tab, hobbies on public profile.
**Phase 4**: friend matching (`lib/companion/friendMatcher.ts`), location geocoding.

### Council Feature (Phase 1 — Deliberation)
The Council is always user-triggered — no auto-routing. Entry points: (1) "⚖️ Ask the Council" button at the bottom (uses current input OR last user message, with tooltip if neither); (2) inline "Ask the Council" prompt below regular responses when `isCouncilWorthy(userMessage)` is true.

`POST /api/council` streams NDJSON — sends one status + one position chunk per persona, then a final verdict chunk. The client reads the stream progressively: status lines appear one by one, persona cards render as each arrives, verdict+synthesis animate in when streaming completes. A [✕ Cancel] button is shown during streaming; cancels the fetch via AbortController. The route checks `req.signal.aborted` between each AI call.

- **Phase 1** (current): 3 personas + verdict + synthesis. No further user interaction.
- **Phase 2** (planned): user responds to one persona, drilling into a lens.
- **Phase 3** (planned): voting/consensus — personas agree or object to proposed actions.

See `CLAUDE.md` § Council Feature for the full structure, prompt design, and API shape.

### Cloud Fallback Chain
When Ollama is unreachable: OpenRouter → Groq → Vercel AI Gateway
All keys are in Vercel env vars. No action needed — fallback is automatic.

### Adding a New AI Route
1. Import `chatComplete` from `@/app/api/aiClient`
2. Use `CHAT_AI_MODEL` or add a new `*_AI_MODEL` env var
3. Build system prompt with user context (drives, goals, energy)
4. Fire single POST on explicit user action — don't auto-fire on load
5. Add the env var to both `.env.local` and Vercel
