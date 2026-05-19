At the start of every session, read /docs/START_HERE.md silently before responding.
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm run lint         # ESLint
npm run vercel-build # Prisma generate + next build (used on Vercel)

npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma migrate dev --name <name>  # Create and apply a new migration
npx prisma studio    # Open Prisma Studio to browse the database
```

ESLint and TypeScript errors are ignored during builds (`ignoreDuringBuilds: true`, `ignoreBuildErrors: true`), so `npm run lint` is the way to catch lint issues in CI.

## Architecture

### Tech Stack
- **Next.js 15** App Router, **React 19**, TypeScript; `@react-pdf/renderer` for server-side PDF generation (listed in `serverExternalPackages` in `next.config.mjs`)
- **PostgreSQL** via **Prisma 6** ORM (`lib/db.ts` exports `db`, `lib/prisma.ts` exports `prisma` — both are the same singleton)
- **Tailwind CSS v4**, `lucide-react`, `sonner` (toasts), `framer-motion`
- **Redis** via `@upstash/redis` and `ioredis` for caching (`lib/redis.ts`, `lib/cache-utils.ts`)
- **Cloudinary** for images/video, **AWS S3** for file storage, **Google Drive** integration
- **SendGrid** (email), **Twilio** (SMS via `lib/sendSms.ts`)
- **Leaflet** for maps, **Three.js** / `@react-three/fiber` for 3D, **D3** for geo/charts
- **Capacitor 8** for iOS/Android native shell — the app points to `https://charaivati.com/app/home`; installed plugins: `@capacitor/app`, `@capacitor/geolocation`, `@capacitor/keyboard`, `@capacitor/splash-screen`, `@capacitor/status-bar`

### Route Groups
The `app/` directory uses Next.js route groups to co-locate layouts:

| Group | Purpose |
|-------|---------|
| `(with-nav)` | Main app pages: `/self`, `/society`, `/nation`, `/earth` |
| `(public)` | Unauthenticated pages: privacy policy, terms, sahayak |
| `(auth)` | Login/register flows |
| `(business)` | Business idea/plan evaluation |
| `(earth)` | Earth-layer views |
| `(universe)` | Universe-layer view |
| `(User)` | User profile and editing |
| `(locality)` | Country selection, local area |
| `(state)` | State-level view |
| `app/` | **Mobile shell** — Capacitor-wrapped layout with sticky header + **4-tab** bottom nav: Home / Initiatives / Explore / Orders |
| `earn/` | Initiative Hub — owner-only pages at `/earn/initiative/[pageId]`; partner delivery dashboard at `/earn/deliveries` (server components, cookie auth) |
| `order/` | Customer-facing order pages: `/order/[id]/track` (client component, live GPS tracking) |

The platform uses a 6-layer conceptual model: **Self → Society → State → Nation → Earth → Universe**, each with tabs for different analyses.

### Authentication
- Sessions use JWT via `jose`, stored in `charaivati.session` (dev) / `__Host-session` (prod) cookies — see `lib/session.ts`
- `middleware.ts` protects `/self`, `/nation`, `/earth`, `/society` — unauthenticated requests redirect to `/login`
- `getCurrentUser(req)` in `lib/session.ts` decodes the session cookie and fetches the user from the database
- API routes read the session cookie via `getTokenFromRequest(req)` from `lib/session.ts`
- Auth flows also support OTP (`/api/auth/otp/`), magic links (`/api/auth/send-magic-link`), and CSRF tokens (`/api/auth/csrf`)

### Guest Account Merge
Guests get a real `User` row with `status: "guest"` and no email. On sign-in or email verification all guest data is atomically moved to the real account.

- **`lib/mergeGuest.ts`** — `mergeGuestToReal(guestId, realId)`: single DB transaction that transfers cart items (quantities merged), wishlist, pinned stores, page follows (initiatives, courses), addresses, orders, owned Pages (initiatives/courses/health businesses), and owned Stores — then deletes the guest user. Calling it twice is safe: duplicate-key conflicts are skipped and a missing guest is a no-op.
- **Trigger 1 — login** (`app/api/user/login/route.ts`): after `createSessionToken`, reads the existing cookie and calls `mergeGuestToReal` if it contains a guest session. Non-blocking — failures are logged but don't abort login.
- **Trigger 2 — email verification** (`app/api/user/magic/route.ts`): prefers `meta.guestId` stored in the magic link at registration time (works even when the email is opened in a different browser/app), falls back to the live cookie. Fires before the redirect to `/login`.
- **`meta.guestId` baking** (`app/api/user/register/route.ts`): at registration the current cookie is read; if it is a guest session, `guestId` is written into `MagicLink.meta` JSON so the merge survives any browser switch.
- **Manual merge** — `POST /api/user/claim-guest` accepts `{ guestId }` and merges that guest into the currently authenticated real user. Use for retroactive recovery of orders placed before the automatic flow existed.
- **`/api/user/me` now returns `status`** — client components detect guest mode from `user.status === "guest"` without a separate API call.
- **Guest UI** — `app/store/[id]/layout.tsx` (store nav) and `app/app/layout.tsx` (app shell) check `isGuest` and replace the account/sign-out links with a single "Sign in / Sign up" link to `/login?redirect=<current path>`.

### Database
- Schema lives in `prisma/schema.prisma` — 100+ models covering users, businesses, e-commerce (stores, carts, orders), social (friends, chat, posts), learning (courses, timelines), health, and geo data
- After editing `schema.prisma`, always run `npx prisma generate` and create a migration
- Chat messages use ECDH P-256 end-to-end encryption (`lib/chat-crypto.ts`)

### API Routes
All API routes live under `app/api/`. Key areas:
- `app/api/auth/` — login, logout, OTP, magic link, CSRF
- `app/api/user/` — profile, avatar, verification, deletion, guest-to-real merge (`/api/user/claim-guest`)
- `app/api/social/` — posts, limits, proxy
- `app/api/business/` — idea scoring, plan generation/analysis
- `app/api/store/` — store management, blocks, sections, cart, orders
- `app/api/friends/` — friend requests, accept/decline/remove
- `app/api/collaboration/` — Page-to-Page partnership requests (send, list, accept/reject/cancel, delete)
- `app/api/order/[id]/delivery/` — delivery tracking for a single order; `PATCH` updates `deliveryStatus` / `assignedToId` / `deliveryNote`; `GET` returns full delivery view (see below)
- `app/api/store/search` — `GET ?q=` case-insensitive store name search; returns `{ id, name, slug, pageId }[]`

#### Store orders GET params
`GET /api/store/orders` supports three modes:
- No params → returns the **current user's own purchases** (buyer view)
- `?storeId=X` → returns orders for that store (owner only); add `&status=delivered` (or any status) to filter
- `?all=true` → returns orders across **all stores owned** by the current user; each order includes `store { id, name }`

#### Two order creation paths
- `POST /api/store/orders` — **cart-based**: fetches cart items, creates Order, clears cart
- `POST /api/store/orders/quick` — **express (Buy Now)**: accepts `{ storeId, addressId, items[], billingProfileId? }` directly; never reads or modifies the cart table

#### Billing profiles
- `GET/POST /api/store/billing-profiles` — list or create `BillingProfile` records
- `PATCH/DELETE /api/store/billing-profiles/[profileId]` — update or delete
- Each profile: `legalName` (required), `companyName`, GST block (`gstRegistered Boolean`, `gstin`, `gstState`, `annualTurnover`), billing address fields, optional `linkedStoreId`
- Managed in `/store/account?tab=invoice` — Tax & Compliance toggle replaces the old plain "GST Number" input
- Users select a billing profile during checkout (`QuickOrderModal` step 3 / `CheckoutModal` step 2); selected profile is serialised into `Order.invoiceData` JSON at order-creation time — no FK stored on Order

### Store Slugs
Every store has a `slug String? @unique` field. Slugs are generated from the store name using `lib/store/generateSlug.ts` and assigned at creation time.

- **Resolution**: `GET /api/store/[id]` accepts either a cuid or a slug. Cuids (`/^c[a-z0-9]{24}$/i`) resolve via `findUnique`. Everything else resolves via `SELECT id FROM "Store" WHERE slug = $1` raw SQL (Prisma-client-agnostic).
- **Canonical redirect**: If a store page or section page is loaded using a cuid URL and the store has a slug, the page calls `router.replace()` to the slug URL. Browser bar always shows the slug after load.
- **Slug in responses**: `GET /api/store/[id]` always returns `slug` via an explicit raw SQL lookup appended to the response. All store-listing APIs (`/api/store/all`, `/api/store/pinned`, `/api/store/my-stores`, `/api/store/orders`, `/api/store/wishlist`) also include slug via the `getStoreSlugs` batch helper.
- **`lib/store/generateSlug.ts`** — `generateSlug(name)` (lowercase, hyphens) + `randomSuffix()` for collision avoidance
- **`lib/store/getStoreSlugs.ts`** — `getStoreSlugs(ids[])` returns `Record<id, slug|null>` via a single `SELECT id, slug FROM "Store" WHERE id IN (...)` raw SQL; used by all APIs to inject slug without depending on the Prisma typed client
- **Backfill**: `scripts/migrateStoreSlugs.ts` — run once to assign slugs to stores created before the field was added

### Store Order Pages
- `/store/account?tab=stores` — owner order dashboard; "All Orders" pill aggregates across all stores; "View all →" goes to `/store/orders/all`
- `/store/orders/all` — full view of all orders across every store the user owns; store name shown as chip
- `/store/[storeSlug]/orders` — per-store active orders with status-update controls; "Delivered Orders →" button in header
- `/store/[storeSlug]/orders/delivered` — read-only archive of delivered orders for one store; "← Active Orders" back link

### Mobile Orders Page (`/app/orders`)
Client component in the mobile shell. Three internal tabs:
- **My Orders** — fetches `GET /api/store/orders` (buyer view, no params); shows store name, items summary, status badge; "Track 📍" button appears when `deliveryStatus === "out_for_delivery"`
- **Store Orders** — fetches `GET /api/store/orders?all=true` (seller view); each card links to `/store/[slug]/orders` (or `/store/orders/all` if no slug); "Manage all orders →" shortcut in header
- **Tracking** — filters buyer orders where `deliveryStatus === "out_for_delivery"`; each renders `TransportMap` (dynamic import, ssr:false) polling `GET /api/transport/vehicles?id={vehicleId}` every 5 s; badge on tab shows count of active tracking orders

### Buy Now / Quick Order UX
- "Buy Now" button on product cards opens `QuickOrderModal` (ephemeral React state — never touches cart)
- "Add to Cart" button flashes green "✓ Added" for 2 seconds on successful add
- `QuickOrderModal` steps: Items review (with inline qty stepper) → Delivery address → Invoice profile (optional, from billing profiles) → Confirmation
- Managed in `components/store/QuickOrderModal.tsx`
- Also available on the **Saved Products** page (`/app/saved`) — wishlist items have a "Buy Now" button that opens `QuickOrderModal` directly

### Invoice System
Auto-generated on delivery, owner signs, buyer downloads. Routes live at `app/api/orders/[orderId]/invoice/`.

Flow:
1. Owner marks order **delivered** → `POST /api/orders/[orderId]/invoice` auto-fires
2. PDF rendered server-side via `@react-pdf/renderer`; `invoiceType` is `"tax_invoice"` if seller's `BillingProfile.gstRegistered === true`, else `"bill_of_supply"`
3. PDF uploaded to Cloudinary as `resource_type: "raw", type: "authenticated"` (access-controlled) → `invoiceUrl` saved
4. Owner downloads unsigned PDF, signs it, uploads signed copy via `POST /api/orders/[orderId]/invoice/sign`
5. `invoiceSignedUrl` saved (via `$executeRaw`); buyer sees **Signed Invoice** download in My Purchases

Download proxy: `GET /api/orders/[orderId]/invoice/download` — authenticates the caller (buyer or store owner), derives `public_id` deterministically (`invoices/{orderId}` or `invoices/signed/{orderId}_signed`), calls `cloudinary.utils.private_download_url()` with `type: "authenticated"`, fetches the signed URL server-to-server, streams PDF back with `Content-Disposition: attachment`.

Key facts:
- Cloudinary storage is `type: "authenticated"` — raw Cloudinary URLs are **not** publicly accessible; always go through the download proxy
- `public_id` for the unsigned invoice is always `invoices/{orderId}` (no file extension); signed is `invoices/signed/{orderId}_signed`
- `Order.invoiceData Json?` stores the buyer's billing details captured at checkout (inline, no FK to BillingProfile)
- All six invoice fields (`invoiceNumber`, `invoiceUrl`, `invoiceType`, `invoiceGenAt`, `invoiceSignedUrl`, `invoiceSignedAt`) live on the `Order` model
- Buyer orders GET (`/api/store/orders` no params) augments results with `invoiceSignedUrl` via raw SQL because the Prisma client may not know about this field when stale
- Cloud name env var is `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` — there is **no** separate `CLOUDINARY_CLOUD_NAME`; server routes read the public var
- **GST tax invoice and e-invoice cases pending testing** — the `"tax_invoice"` branch and `annualTurnover: "above_5Cr"` (IRN required) paths exist in the PDF template and billing profile UI but have not been end-to-end tested with a real GSTIN

### Product Ratings
- One rating (1–5 stars) per user per product (`ProductRating` model, `@@unique([productId, userId])`)
- Store owners cannot rate their own products (403 from the rate API)
- **Batch fetch**: when a section page loads, it fetches ratings for all visible products in a single `GET /api/store/products/ratings?ids=id1,id2,...` call using `groupBy` aggregates; never one request per product
- `StarRating` component in the section page: hover highlights, click to rate, "Thanks for rating!" flash, owner sees display-only stars with inline message, logged-out users see display-only stars with "Log in to rate." message
- API: `POST /api/store/products/[productId]/rate`, `GET /api/store/products/[productId]/rating`, `GET /api/store/products/ratings?ids=`

### Inline Quantity Stepper
- Each product card on section pages has an inline `QtyStepperInline` component in the title row: `−` | number | `+`
- The number is directly editable (click → input, blur/Enter commits, validates 1–99)
- The selected qty is passed to both `onAddToCart(qty)` and `onBuyNow(qty)` — the cart API increments by `qty`, and `QuickOrderModal` opens with `quantity: qty` pre-loaded

### Initiative Hub (`/earn/initiative/[pageId]`)
Owner-only page that replaces the old scattered "Evaluate & Plan" / "Your Store" / "Manage Initiative" buttons with a single tabbed interface.

- **Entry point**: "Open →" button on each initiative card in `app/app/initiatives/page.tsx` and `EarningTab.tsx`
- **Server component** — auth via `cookies()` from `next/headers` + `verifySessionToken()` from `lib/session.ts`. Does NOT use `getServerUser(req)` (that requires a Request object for API routes). Redirects to `/earn` if unauthenticated or not the page owner.
- **Data fetched server-side**: Page (with `course`, `helpingInitiative`, `collaborationsIn`, `collaborationsOut`), linked Store, all pages owned by the user (`ownerPages`)
- **Client shell**: `components/earn/InitiativeTabs.tsx` — manages `activeTab` state, renders Overview / Store / Partners
- **Partners tab**: `components/earn/PartnersTab.tsx` — active partners, incoming requests, invite form with store-name autocomplete

### Delivery Tracking

The `Order` model has three new scalar fields (added via `db push`, no migration file):

| Field | Type | Default | Purpose |
|---|---|---|---|
| `deliveryStatus` | `String` | `"pending"` | Delivery pipeline: `pending → confirmed → processing → out_for_delivery → delivered` (or `cancelled` at any point) |
| `assignedToId` | `String?` | `null` | `Collaboration.id` of the partner assigned to deliver — **not a FK**, stored as a plain string. `null` = owner delivers themselves |
| `deliveryNote` | `String?` | `null` | Free-text instructions from owner to delivery person |
| `vehicleId` | `String?` | `null` | `Vehicle.id` of the partner's active GPS broadcast — set automatically when the partner clicks "Start GPS" in the deliveries dashboard; cleared to null when unlinked |

**`PATCH /api/order/[id]/delivery`**
- Store owner: can update all three fields. Assignment validates the Collaboration is `accepted` and involves the store's `pageId`.
- Assigned delivery partner: can only update `deliveryStatus` (403 on any other field).
- Buyer: no PATCH access.

**`GET /api/order/[id]/delivery`**
- Allowed for: store owner, assigned delivery partner (via Collaboration lookup), or the order's buyer.
- Returns: `id, deliveryStatus, assignedToId, deliveryNote, items, total, createdAt, address` + `assignedCollab` (partner page titles + role, or null).
- Does NOT expose `store.ownerId`, `store.pageId`, or the buyer's `userId` to callers.

**Partner auth logic**: `assignedToId` is a `Collaboration.id`. The API fetches the Collaboration, determines which page is the store's page (via `store.pageId`), and treats the other page as the partner page. Auth passes if `partnerPage.ownerId === session.userId`.

**Owner order management UI** (`app/store/[id]/orders/page.tsx`):
- Delivery stepper (5 steps, clickable, Cancel side-exit) — updates `deliveryStatus` via PATCH.
- Assignment dropdown (visible from `confirmed` onward) — lists accepted outbound collaboration partners fetched from `GET /api/collaboration?direction=out&status=accepted`. Value is `Collaboration.id`.
- Delivery note textarea with explicit Save button.

**Partner delivery dashboard** (`app/earn/deliveries/page.tsx`):
- Server component with cookie auth (same pattern as initiative page).
- Finds all accepted collaborations where session user's pages are the **receiver**.
- Queries orders with `assignedToId IN (collabIds) AND deliveryStatus = 'out_for_delivery'` via raw SQL.
- Renders `DeliveriesClient` (`components/earn/DeliveriesClient.tsx`) — Mark Delivered button + GPS modal with Broadcaster.

**Customer tracking page** (`app/order/[id]/track/page.tsx`):
- Client component; fetches `GET /api/order/[id]/delivery` (buyer is allowed).
- Read-only stepper + partner name + delivery note + order summary.
- When `deliveryStatus === "out_for_delivery"` AND `Order.vehicleId` is set: polls `GET /api/transport/vehicles?id={vehicleId}` every 5 s, shows that exact vehicle on `TransportMap`. If `vehicleId` is null, shows "Delivery partner hasn't started GPS yet." instead of the map.

### Collaboration / Partners
Page-to-Page partnership system. Both sides of a collaboration are `Page` records (not Users). The `Collaboration` model links two Pages with a role and status.

- **Model**: `Collaboration` — `requesterId` (Page), `receiverId` (Page), `role` (string enum: `delivery_partner | supplier | employee | marketing | other`), `status` (`pending | accepted | rejected | cancelled`), optional `message` and `metadata`. Unique on `[requesterId, receiverId, role]`. Both FKs cascade-delete.
- **`Page` model now has** `collaborationsOut` (`@relation("CollabRequester")`) and `collaborationsIn` (`@relation("CollabReceiver")`)
- **Auth**: requester ownership checked on POST (requester page must be owned by session user); receiver ownership checked for accept/reject; requester ownership for cancel; either side for DELETE.
- **Receiver resolution**: `POST /api/collaboration` accepts a Store ID, store slug, or Page ID as `receiverId` — it resolves store → its linked `pageId` automatically. Returns 404 if no Page can be found. This means stores with `pageId: null` cannot participate.
- **PATCH must include page relations**: `prisma.collaboration.update` must include `requester`/`receiver` in the response or the frontend will crash reading `.title` off `undefined`.

| Method | Route | Auth check |
|---|---|---|
| POST | /api/collaboration | requesterId page owned by session user |
| GET | /api/collaboration?pageId=&direction=in\|out&status= | pageId owned by session user |
| PATCH | /api/collaboration/[id] | receiver owns for accept/reject; requester owns for cancel |
| DELETE | /api/collaboration/[id] | session user owns either page |

### AI Store Setup Wizard
One-shot AI flow that creates a complete store structure from a plain-English description.

- **`POST /api/store/ai-setup`** — takes `{ description, storeId }`, calls `chatComplete` once (via `app/api/aiClient.ts`), parses the JSON response, batch-fetches banner images via `lib/imageSearch.ts` `fetchImages()` in parallel. Returns `{ filters, sections[] }` with `imageUrl` injected on each section. Images fall back to Picsum if all provider keys are missing — result is always non-null.
- **`POST /api/store/ai-setup/apply`** — takes `{ storeId, filters, sections }`, creates everything in a single Prisma transaction (30 s timeout): filters → sections → tiles → per-filter banners → product blocks → one global banner (`isGlobal: true`) using the first section image. Uses `prisma.$transaction(..., { timeout: 30000 })` — default 5 s is too short for the sequential creates.
- **`app/store/[id]/setup/page.tsx`** — three-step wizard (input → preview with inline editing → applying/done). Calls `setShowNav(false)` via `useStoreShell` to suppress the store nav shell. Skip buttons call `skipToStore()` which sets `sessionStorage.setup_skipped_${storeId}` before navigating to prevent loop-back.
- **Trigger — new store**: `GET /api/store/for-page/[pageId]` now returns `isNew: true` when `storeSection.count === 0`. `EarningTab.openStore()` uses `window.location.href` (not `router.push`) to navigate to `/store/${storeId}/setup` when `isNew` — `router.push` silently drops cross-layout-root navigations from `(with-nav)/self` to `store/[id]/setup`.
- **Trigger — direct store visit**: `fetchStore` in `app/store/[id]/page.tsx` checks `data.isOwner && data.sections.length === 0 && !sessionStorage.get(setup_skipped_${id})` → `window.location.replace(/store/${id}/setup)`. Catches any navigation path, not just the EarningTab button.
- **CSP**: `https://images.unsplash.com` is added to `img-src` in `next.config.mjs`.

### Store Image Pool
All store image uploads go through a two-layer dedup pipeline — **never call Cloudinary directly** from store upload forms.

- **Utility**: `lib/store/uploadImage.ts` exports `uploadStoreImage(file, storeId)`:
  1. SHA-256 hash the file client-side (`crypto.subtle`)
  2. `POST /api/store/images/check` → returns existing record immediately if hash exists (`alreadyExisted: true`)
  3. Upload to Cloudinary (`cloud: dyphnp3oc`, `preset: posts_unsigned`, `public_id = fileHash`)
  4. `POST /api/store/images/save` → upsert on `[storeId, fileHash]`
- **DB constraint**: `@@unique([storeId, fileHash])` on `StoreImage` is the hard guarantee against duplicates
- **API**: `POST /api/store/images/check`, `POST /api/store/images/save`, `GET /api/store/images/list?storeId=`
- **Legacy path** (`/api/store/[id]/images`) still exists for the bulk library modal; it now uses new field names
- **`StoreImage` fields**: `id`, `storeId`, `url`, `cloudinaryId`, `fileHash`, `fileName`, `uploadedAt` — old fields `name`, `imageUrl`, `imageKey`, `createdAt` no longer exist

### Components
- `components/store/` — e-commerce builder (filters, banners, image library, QuickOrderModal, StoreImagePickerModal)
- `components/social/` — chat panel, friend requests
- `components/timeline/` — project timeline with phases and milestones
- `components/business/` — question cards, scoring dashboard
- `components/earth/` — signal board, impact lens
- `components/health/` — health profile modals
- `components/transport/` — live vehicle tracking map; `Broadcaster` uses `useGeolocation` hook (not `navigator.geolocation` directly)
- `components/earn/` — Initiative Hub shell (`InitiativeTabs.tsx`), Partners tab (`PartnersTab.tsx`), delivery dashboard client (`DeliveriesClient.tsx` — Mark Delivered button + GPS modal with Broadcaster)

### Key Libraries
- `lib/featureFlags.ts` — feature flag system (check before adding major features)
- `lib/rateLimit.ts` — rate limiting for API routes
- `lib/csrf.ts` — CSRF protection
- `lib/writeQueue.ts` — queued write operations
- `lib/timeline-templates.ts` — predefined timeline templates
- `lib/sectionTagMappings.ts` — maps store section types to tags
- `lib/mergeGuest.ts` — `mergeGuestToReal(guestId, realId)`: atomic guest-to-real account merge inside a single Prisma transaction; moves cart, wishlist, pinned stores, page follows, addresses, orders, owned pages and stores, then deletes the guest user
- `lib/imageSearch.ts` — `fetchImage(query)`: multi-provider image search with rotating load distribution (Unsplash → Pexels → Pixabay, `callCount % 3`) and guaranteed Picsum fallback (no key, deterministic seed). `fetchImages(queries[])`: parallel batch wrapper used by the AI setup route. Any provider whose key is missing is skipped silently.
- `lib/store/uploadImage.ts` — `uploadStoreImage(file, storeId)`: dedup-aware upload utility; single source of truth for all store image uploads
- `lib/store/generateSlug.ts` — `generateSlug(name)` + `randomSuffix()`: slug generation for stores
- `lib/store/getStoreSlugs.ts` — `getStoreSlugs(ids[])`: batch raw-SQL slug lookup; used by all store-listing APIs to add slug to responses without depending on the Prisma typed client
- `lib/invoice/generateInvoiceNumber.ts` — `generateInvoiceNumber()`: sequential `INV-YYYY-NNNNN` counter; queries `Order.count({ where: { invoiceNumber: { not: null } } })`
- `lib/invoice/InvoiceDocument.tsx` — `@react-pdf/renderer` Document component; renders TAX INVOICE or BILL OF SUPPLY layout with seller/buyer blocks, items table, GST totals
- `hooks/useGeolocation.ts` — `useGeolocation()`: GPS abstraction hook; tries `@capacitor/geolocation` first (requests permission, then `watchPosition`), falls back to `navigator.geolocation.watchPosition` in browser. Returns `{ startWatch, stopWatch }`. Always use this hook for any new GPS feature — never call `navigator.geolocation` directly.

### Security Notes
- CSP headers are configured in `next.config.mjs` — update them when adding new external scripts, styles, or media sources
- `X-Frame-Options: DENY` is set globally; do not add iframe embeds without updating the CSP `frame-src`
- `geolocation` permission is restricted to `self` and `https://charaivati.com`

### Environment Variables
Required: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `SENDGRID_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, Upstash Redis credentials.

Image search (all optional — `lib/imageSearch.ts` skips missing providers and falls back to Picsum):
- `UNSPLASH_ACCESS_KEY` — Unsplash API client ID
- `PEXELS_KEY` — Pexels API key
- `PIXABAY_KEY` — Pixabay API key

## Architecture Docs
Before making any change, read the relevant doc in /docs.
For any new feature, check /docs/flows/ for the step-by-step procedure.
Start every session by reading /docs/START_HERE.md.

## Known Footguns (read these before touching anything)
- `/docs/modules/auth-files.md` — `lib/auth.ts` vs `lib/session.ts` are NOT interchangeable
- `/docs/modules/auth.md` — middleware does NOT protect API routes
- `/docs/flows/add-new-api-route.md` — CSRF is built but unwired, do not add it
- `/docs/modules/profile-schemas.md` — `heightCm`/`weightKg` exist in two out-of-sync places
- **Two order endpoints exist** — `POST /api/store/orders` (cart-based, clears cart) vs `POST /api/store/orders/quick` (express, never touches cart). Do not use the cart-based endpoint from `QuickOrderModal` — it will empty the user's persistent cart.
- **`QuickOrderModal` is ephemeral** — closing it mid-flow loses all state. It never writes to DB until "Place Order" is clicked.
- **Store slug resolution uses raw SQL** — `Store.slug` is not in the Prisma generated client until you run `prisma generate` after a successful `db push`. Use `$queryRaw`/`$executeRaw` for any query that reads or filters by `slug`; do not put `slug` in a Prisma `where` or `select` block while the client is stale. After restarting the dev server and re-running `prisma generate`, the typed client works normally.
- **`ProductRating.productId` points to `StoreBlock`** — the relation is declared on `StoreBlock` (mapped to the `Block` table). Querying product ratings requires using the block's `id`, not any separate product ID.
- **`StoreImage` field names changed** — old fields `name`, `imageUrl`, `imageKey`, `createdAt` no longer exist. Current fields: `url`, `fileHash`, `cloudinaryId`, `fileName`, `uploadedAt`. Any code reading `storeImage.imageUrl` or `storeImage.name` will be undefined.
- **Never call Cloudinary directly for store images** — always use `uploadStoreImage()` from `lib/store/uploadImage.ts`. Direct calls bypass the dedup check and DB save, creating orphaned Cloudinary assets and missed dedup hits.
- **`Order.items` is a flat JSON snapshot** — the field contains `[{ blockId, title, price, quantity, imageUrl }]`. It is NOT a Prisma relation. Any frontend type that uses `{ block: { title, price } }` will silently get `undefined` for all values. Always type it as `{ blockId: string; title: string; price: number; quantity: number }[]`.
- **Invoice download never exposes Cloudinary URLs** — invoices are stored as `type: "authenticated"` on Cloudinary. The raw `invoiceUrl` / `invoiceSignedUrl` stored on `Order` are private URLs that return 401 without a signed token. Always route downloads through `GET /api/orders/[orderId]/invoice/download`, which generates a 60-second signed URL server-side.
- **`StoreHero` `bannerUrl`/`avatarUrl` are dead** — the `Store` DB model has neither field; they exist only on `User` (line 23) and `Page` (line 215) in the schema. `StoreHero` declares them as optional on the frontend type so they silently render nothing. The live banner system is `StoreBanner` (`isGlobal: true`) → returned as `globalBanner` from `GET /api/store/[id]` → rendered by `BannerZone`. Do not add `bannerUrl`/`avatarUrl` to the Store model without a migration.
- **AI setup transaction timeout** — `prisma.$transaction` default is 5 s. The apply route uses `{ timeout: 30000 }`. Any new sequential-await transaction creating multiple rows must also set an explicit timeout or it will expire mid-way with P2028.
- **Server component auth uses `cookies()`, not `getServerUser(req)`** — `getServerUser` requires a `Request` object and is only usable in API routes. Server components (pages, layouts) must read the session via `cookies()` from `next/headers` + `verifySessionToken()` directly. See `app/earn/initiative/[pageId]/page.tsx` and `app/(with-nav)/layout.tsx` as canonical examples.
- **`Order.deliveryStatus` / `assignedToId` / `deliveryNote` were added via `db push`, not a migration file** — there is no migration SQL for these columns. If the DB is ever reset from migrations, these columns will be missing. Use `db push` again or add them manually.
- **`Order.assignedToId` and `Order.vehicleId` are NOT Prisma relations** — both are plain `String?` fields. `assignedToId` stores a `Collaboration.id`; `vehicleId` stores a `Vehicle.id`. Resolve them manually; do not use Prisma `include` or `connect` on them.
- **`Order.vehicleId` is NOT cleared when the vehicle broadcast stops** — the partner's `stop()` call deletes the `Vehicle` row but leaves `Order.vehicleId` set. The tracking page handles this correctly because the vehicles API filters by `updatedAt >= 2 min ago`, so a deleted vehicle returns no rows and the map shows no marker.
- **Delivery partner PATCH is restricted** — partners can only change `deliveryStatus`. Any attempt to send `assignedToId` or `deliveryNote` from the partner returns 403. The owner UI must not expose those fields to partners.
- **`Collaboration` PATCH must include page relations in the response** — `prisma.collaboration.update` without an `include` returns only flat fields. The frontend reads `updated.requester.title` / `updated.receiver.title` to optimistically add the accepted partner to the active list. Omitting the include causes a `Cannot read properties of undefined (reading 'title')` crash.
- **`Collaboration.receiverId` must be a `Page.id`** — the API resolves Store IDs and store slugs to their linked `pageId` automatically, but stores with `pageId: null` cannot participate. Pages created outside the normal `openStore()` flow may have no linked store pageId.
- **Never call `navigator.geolocation` directly in new code** — always use `useGeolocation()` from `hooks/useGeolocation.ts`. The hook tries Capacitor first (works in the Android/iOS native shell) and falls back to the browser API automatically. Direct `navigator.geolocation` calls will silently fail on Android when the Capacitor plugin is expected. `TransportMap.tsx` still uses the browser API for its one-shot centering call — that is the only permitted exception.
