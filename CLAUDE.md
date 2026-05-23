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
| `app/` | **Mobile shell** — Capacitor-wrapped layout with sticky header + **4-tab** bottom nav: Home / Initiatives / Explore / Orders (Deliveries tab removed — accessible via "Deliver 🚚" link inside `/app/orders?tab=my`). Home page (`app/app/home/page.tsx`) has two render states: guest/new-user (compact marketing layout matching signed-in density) and returning user (live dashboard — stats, pending orders, initiatives). |
| `earn/` | Initiative Hub — owner-only pages at `/earn/initiative/[pageId]`; partner delivery dashboard at `/earn/deliveries` (server components, cookie auth) |
| `order/` | Customer-facing order pages: `/order/[id]/track` (client component, live GPS tracking) |

The platform uses a 6-layer conceptual model: **Self → Society → State → Nation → Earth → Universe**, each with tabs for different analyses.

### Authentication
- Sessions use JWT via `jose`, stored in `charaivati.session` (dev) / `__Host-session` (prod) cookies — see `lib/session.ts`
- `middleware.ts` has two sequential gates — language gate runs first, auth gate second:
  - **Language gate** — unauthenticated requests to any non-skip path that lack a `"lang"` cookie redirect to `/?redirect=<original-path>`. Authenticated users (valid session cookie) bypass this gate entirely. Skip list: `/`, `/login`, `/register`, static file extensions. Matcher excludes `_next/` and `api/`.
  - **Auth gate** — protects `/self`, `/nation`, `/earth`, `/society`; unauthenticated requests redirect to `/login` and the stale session cookie is deleted.
- `getCurrentUser(req)` in `lib/session.ts` decodes the session cookie and fetches the user from the database
- API routes read the session cookie via `getTokenFromRequest(req)` from `lib/session.ts`
- Auth flows also support OTP (`/api/auth/otp/`), magic links (`/api/auth/send-magic-link`), and CSRF tokens (`/api/auth/csrf`)
- **Registration flow** — after `POST /api/user/register` succeeds the login page enters a `verify-pending` state (stays on page, shows "check your inbox" message). There is NO redirect after signup. The user must click the verification email link → lands on `/verified` → clicks "Sign in to continue →" → `/login` (pre-filled email, preserved redirect)
- **Verification email** — sent via `lib/sendEmail.ts` (Nodemailer/Gmail, env: `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`). Subject: "Verify your Charaivati account". Clicking the link hits `GET /api/user/magic` which redirects to `/verified?email=...&redirect=...`, NOT to `/login`. If `sendEmail` throws (e.g. env vars not set), the register route returns 500 with `"Account created but verification email could not be sent. Contact support."` — the login page displays this as an error. In development with missing email env vars, the verification link is printed to the server console so the flow can be tested without a real email setup.

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
- `app/api/order/[id]/step/[stepId]/confirm` — `PATCH` confirms an active OSP row; advances workflow; notifies next assignee
- `app/api/order/[id]/step/[stepId]/fail` — `PATCH` fails the active OSP; sets `requiresAttention = true`; cancels delivery
- `app/api/order/[id]/step/[stepId]` — `PATCH` retries a failed step; resets OSP to active; clears `requiresAttention`
- `app/api/order/[id]/quote/[quoteId]/respond` — `POST { amount }` submits a quote; rebuilds `quoteSummary` sorted by amount asc
- `app/api/order/[id]/quote/[quoteId]/accept` — `POST` accepts one quote, rejects others; advances workflow; creates sub-order
- `app/api/order/[id]/quote-order` — `PATCH { summary }` saves owner's manual quote preference ordering
- `app/api/order/[id]/customer-confirm` — `POST` buyer confirms receipt; sets `deliveryStatus="delivered"`, `partnerStatus="completed"`
- `app/api/orders/requests` — `GET` returns all Quote rows where current user's collaborations are `requestedPartyId`; used by the Requests tab in the mobile orders page
- `app/api/notifications` — `GET` returns `{ notifications[], unreadCount }` for the current user (latest 30, newest first)
- `app/api/notifications/read` — `PATCH { ids }` or `{ all: true }` marks notifications as read
- `app/api/initiative/[pageId]/workflow` — `GET` returns `{ steps[], assignees[] }`; each step includes `assignees: WorkflowStepAssignee[]` (new system) and deprecated `assignee` (from `assigneeId`); auto-seeds 3 default steps if none exist; `POST` adds a step
- `app/api/initiative/[pageId]/workflow/[stepId]` — `PATCH` updates a step (accepts `name`, `assigneeId`, `assigneeType`, `quoteRequired`, `quoteTimeoutHours`, `assignmentMode`); `DELETE` removes it
- `app/api/initiative/[pageId]/workflow/reorder` — `PATCH { steps: [{id,sequence}] }` reorders steps in a transaction
- `app/api/initiative/[pageId]/team` — `GET` returns team members + eligible partners + current user's `teamRole`
- `app/api/initiative/[pageId]/team/[collaborationId]` — `PATCH` promotes to team (`scope="team"`) or demotes back to partner
- `app/api/store/search` — `GET ?q=` case-insensitive store name search; returns `{ id, name, slug, pageId }[]`
- `app/api/collaboration/[id]/pricing` — `PATCH { costPerOrder?, costPerKg?, costPerKgPerKm?, costPerItemPerKm? }` updates delivery cost fields on a Collaboration; auth: either side of the collaboration owns the page. Pass `null` to clear a field.
- `app/api/initiative/[pageId]/workflow/[stepId]/assignees` — `POST { collaborationId, sequence?, costPerOrder?, costPerKg?, costPerKgPerKm?, costPerItemPerKm? }` adds a `WorkflowStepAssignee` row; validates collaboration is accepted and belongs to the initiative. Returns the new row with `displayName` and `collaboration` included.

#### Store orders GET params
`GET /api/store/orders` supports three modes:
- No params → returns the **current user's own purchases** (buyer view)
- `?storeId=X` → returns orders for that store (owner only); add `&status=delivered` (or any status) to filter
- `?all=true` → returns orders across **all stores owned** by the current user; each order includes `store { id, name, slug }`, `requiresAttention Boolean`, `activeStep { stepName } | null`

#### Two order creation paths
- `POST /api/store/orders` — **cart-based**: fetches cart items, creates Order, clears cart. Applies `Store.deliveryFee` when set (skipped if `itemsTotal >= freeDeliveryAbove`).
- `POST /api/store/orders/quick` — **express (Buy Now)**: accepts `{ storeId, addressId, items[], billingProfileId? }` directly; never reads or modifies the cart table. Also applies store delivery fee.

**Store delivery fee fields** (`Store` model): `deliveryFee Float?` — flat fee added to order total; `freeDeliveryAbove Float?` — if set, fee is waived when item subtotal meets or exceeds this threshold. Both fields read via raw SQL (`$queryRaw`) since Prisma client may be stale. Stored in `Order.total` (fee is baked in, not a separate field).

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
- `/store/orders/all` — full view of all orders across every store the user owns; shows active step chip (grey) + requiresAttention red dot per order
- `/store/[storeSlug]/orders` — per-store active orders. Each order card shows:
  - **Delivery status bar** (read-only pipeline display) — the 5-step stepper is display-only; **only Cancel remains clickable**. Assignment dropdown and delivery note still functional for manual override.
  - **WorkflowSection** — shown for every order in one of four states: (A) no initiative linked: "No workflow set up" + link to initiative; (B) order pending: "Confirm the order to activate"; (C) active step: step name chip + assignee + "Confirm Step ✓" button (non-quote) or quote list with Accept/reorder (quote step); (D) partnerStatus="rejected": reassign dropdown + Retry Step button.
- `/store/[storeSlug]/orders/delivered` — read-only archive of delivered orders for one store; "← Active Orders" back link

**`GET /api/store/orders?storeId=X` response** enrichment per order: `activeStep { stepId, stepName, assigneeName, quoteRequired }`, `quotes [{ id, stepId, partyName, amount, status }]` sorted by amount asc, `requiresAttention Boolean`, `subOrders [{ id, subOrderType, agreedAmount, userId }]`, `initiativeId` (= store.pageId).

### Mobile Orders Page (`/app/orders`)
Client component in the mobile shell. **Four** internal tabs (initial tab set by `?tab=` URL param — notification links use this):
- **My Orders** — fetches `GET /api/store/orders` (buyer view, no params); shows store name, items summary, status badge; "Track 📍" button appears when `deliveryStatus === "out_for_delivery"`. Sub-orders appear here automatically (they have `userId = assigneeUserId`); they show an amber "Assignment" pill, `subOrderType` chip, and `agreedAmount` if set.
- **Store Orders** — fetches `GET /api/store/orders?all=true` (seller view); each card links to `/store/[slug]/orders` (or `/store/orders/all` if no slug); "Manage all orders →" shortcut in header
- **Requests** — fetches `GET /api/orders/requests`; shows Quote rows where the current user's collaborations are the `requestedPartyId`. Cards show order ref, step name, items summary, time-remaining countdown, and a quote submission UI: pending=amount input+submit, submitted=quote+edit, accepted=green badge+"View Assignment →", rejected=grey "Not selected". Badge on tab shows count of pending+submitted quotes.
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
- **Client shell**: `components/earn/InitiativeTabs.tsx` — manages `activeTab` state; fetches `GET /api/initiative/[pageId]/team` on mount to derive `canEdit` (founder/co_founder → true; null → true for owner; others → false); renders Overview / Store / Team / Partners / Workflow
- **Team tab**: `components/earn/TeamTab.tsx` — lists team-scope Collaborations; "Invite Member" promotes a partner-scope Collab to team via `PATCH /api/initiative/[pageId]/team/[collaborationId]`; role tags: Founder, Co-founder, CEO, Partner, Employee, Custom
- **Partners tab**: `components/earn/PartnersTab.tsx` — active partners, incoming requests, invite form with store-name autocomplete
- **Workflow tab**: `components/earn/WorkflowTab.tsx` — sortable step list (dnd-kit); each step: inline-editable name, assignee dropdown (ALL accepted collabs for the page, any scope), quote-required toggle, timeout hours; "Add Step" / "Confirm Step" / drag-to-reorder. **canEdit** prop gates all edit controls — read-only for non-founder/co_founder team members.

### Delivery Tracking

The `Order` model has five delivery scalar fields (added via `db push`, no migration file):

| Field | Type | Default | Purpose |
|---|---|---|---|
| `deliveryStatus` | `String` | `"pending"` | Delivery pipeline: `pending → confirmed → processing → out_for_delivery → delivered` (or `cancelled` at any point) |
| `assignedToId` | `String?` | `null` | `Collaboration.id` of the partner assigned to deliver — **not a FK**, stored as a plain string. `null` = owner delivers themselves |
| `deliveryNote` | `String?` | `null` | Free-text instructions from owner to delivery person |
| `vehicleId` | `String?` | `null` | `Vehicle.id` of the partner's active GPS broadcast — set automatically when the partner clicks "Start GPS" in the deliveries dashboard; cleared to null when unlinked |
| `partnerStatus` | `String?` | `null` | Partner acceptance state: `null` = unassigned, `"assigned"` = owner assigned (awaiting partner acceptance), `"accepted"` = partner accepted, `"rejected"` = partner declined (owner must reassign), `"completed"` = partner delivered |

**Partner acceptance flow** (new):
1. Owner assigns a partner via the dropdown → API auto-sets `partnerStatus = "assigned"`
2. Partner sees the order in `/earn/deliveries` with an amber "New Assignment" badge
3. Partner clicks **Accept Delivery** → `PATCH { partnerAction: "accept" }` → `partnerStatus = "accepted"`
4. OR clicks **Reject** → `PATCH { partnerAction: "reject" }` → `partnerStatus = "rejected"`, `assignedToId = null` (order disappears from partner dashboard; owner must reassign)
5. Accepted partner waits for `deliveryStatus = "out_for_delivery"`, then can start GPS
6. Partner marks delivered → `PATCH { deliveryStatus: "delivered" }` → server sets `partnerStatus = "completed"`, `vehicleId = null`

**`PATCH /api/order/[id]/delivery`**
- Store owner: can update `deliveryStatus`, `assignedToId`, `deliveryNote`, `vehicleId`. Setting `assignedToId` → API auto-sets `partnerStatus = "assigned"`. Clearing it → `partnerStatus = null`. Terminal `deliveryStatus` (delivered/cancelled) also clears `vehicleId` and `partnerStatus`.
- Assigned delivery partner: can send `{ partnerAction: "accept" | "reject" }` or update `deliveryStatus` / `vehicleId`. Reject also clears `assignedToId`. Marking delivered auto-sets `partnerStatus = "completed"`.
- Buyer: no PATCH access.

**`GET /api/order/[id]/delivery`**
- Allowed for: store owner, assigned delivery partner (via Collaboration lookup), or the order's buyer.
- Returns: `id, deliveryStatus, partnerStatus, assignedToId, deliveryNote, vehicleId, items, total, createdAt, address` + `assignedCollab` (partner page titles + role, or null).
- Does NOT expose `store.ownerId`, `store.pageId`, or the buyer's `userId` to callers.

**Partner auth logic**: `assignedToId` is a `Collaboration.id`. The API fetches the Collaboration, determines which page is the store's page (via `store.pageId`), and treats the other page as the partner page. Auth passes if `partnerPage.ownerId === session.userId`.

**Owner order management UI** (`app/store/[id]/orders/page.tsx`):
- Delivery status bar (5 steps, **read-only display**, Cancel button is the only clickable action) — reflects `deliveryStatus`; the workflow system drives progression, not manual clicks.
- Assignment dropdown (visible from `confirmed` onward) — lists accepted outbound collaboration partners. Still functional for manual override outside the workflow system.
- WorkflowSection renders in 4 states: (A) no initiative, (B) pending order, (C) active step with Confirm/Quote controls, (D) rejection panel. See `### Store Order Pages` above.
- `partnerStatus` badge shown read-only below the assignment dropdown.
- Delivery note textarea with explicit Save button.

**Partner delivery dashboard** (`app/earn/deliveries/page.tsx`):
- Server component with cookie auth (same pattern as initiative page).
- Finds all accepted collaborations where session user's pages are the **receiver**.
- Queries orders with `assignedToId IN (collabIds) AND partnerStatus IN ('assigned', 'accepted')` via raw SQL; includes active workflow step ID via a subquery on `OrderStepProgress`.
- Renders `DeliveriesClient` (`components/earn/DeliveriesClient.tsx`) — cards differ by `partnerStatus`: amber Accept/Reject UI for `"assigned"`, green GPS + **Confirm Delivery** UI for `"accepted"`.
- **Confirm Delivery** flow: (1) `PATCH /api/order/[id]/step/[activeStepId]/confirm` → advances workflow; (2) `PATCH /api/order/[id]/delivery { partnerAction: "complete" }` → sets `partnerStatus = "completed"`, clears `vehicleId`; (3) deletes vehicle row; (4) shows "Delivery complete ✅" state for 2.5 s then removes card. Customer then sees "Confirm you received this order?" prompt on the tracking page.

**Customer tracking page** (`app/order/[id]/track/page.tsx`):
- Client component; fetches `GET /api/order/[id]/delivery` (buyer is allowed). Also polls every 5 s to detect `partnerStatus` changes.
- Read-only stepper + partner name + delivery note + order summary.
- When `deliveryStatus === "out_for_delivery"` AND `Order.vehicleId` is set: polls `GET /api/transport/vehicles?id={vehicleId}` every 5 s, shows that exact vehicle on `TransportMap`. If `vehicleId` is null, shows "Delivery partner hasn't started GPS yet." instead of the map.
- When `partnerStatus === "completed"` (partner confirmed delivery): shows "Confirm you received this order?" prompt. On click → `POST /api/order/[id]/customer-confirm` → `deliveryStatus = "delivered"`, `partnerStatus = "completed"`. Shows thank-you state afterward.

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

### Charaivati AI Chatbot (floating guide widget)
A floating chat widget powered by a locally-running Ollama model. Visible to logged-in users on every page.

- **Widget**: `components/chat/ChatBot.tsx` — bottom-right floating bubble; opens a 380×520 dark panel. Props: `isLoggedIn: boolean` (gates rendering), `currentSection?: string` (passed to the API for context; defaults to `"Self"`).
- **API route**: `POST /api/chat` — auth-gated (manual `getTokenFromRequest` + `verifySessionToken`). Loads `User.drives`, `Profile.goals`, `Profile.stepsToday`, `Profile.sleepHours`, and owned `Page` records server-side. Derives an `energyScore` (0–100) from step count + sleep hours. Builds a personalised system prompt, sends it along with `conversationHistory` (passed from client) to Ollama, returns `{ reply }`. Falls back to a canned message with `_fallback: true` if Ollama is unreachable (connection refused, timeout, non-200).
- **Integration**: `ChatBot` is rendered directly in `app/layout.tsx` (root layout). The layout reads the session cookie server-side and passes `isLoggedIn` — no extra client fetch.
- **Conversation history**: stored in `useState` only — not persisted to DB. Cleared by the "Clear chat" button in the panel header.
- **Ollama call**: `POST {OLLAMA_URL}/api/chat` with `stream: false`. Messages: `[system, ...conversationHistory, { role: "user", content: message }]`. 30-second fetch timeout via `AbortSignal.timeout(30000)`.
- **Environment**: `OLLAMA_URL` (default `http://localhost:11434`) and `OLLAMA_MODEL` (default `llama3.2`). Both optional — defaults kick in if not set.

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
- `components/earn/` — Initiative Hub shell (`InitiativeTabs.tsx`), Partners tab (`PartnersTab.tsx`), delivery dashboard client (`DeliveriesClient.tsx` — Mark Delivered button + GPS modal with Broadcaster), Team tab (`TeamTab.tsx`), Workflow tab (`WorkflowTab.tsx` — sortable step list with per-step assignee management)
- `components/shared/` — reusable non-domain components: `AddressForm.tsx` (address form with GPS, pincode auto-geocode, drag-pin map), `MapPicker.tsx` (Leaflet drag-pin map, always loaded client-side via `dynamic(..., { ssr: false })`)

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
- `lib/pages/kindLabel.ts` — `kindLabel(page)`: returns a human-readable page type string given `{ type, pageType }`. Handles the `type: "health"` edge case and all `pageType` values (`"store"`, `"helping"`, `"learning"`, `"service"`). Used by the home dashboard, EarningTab, Initiative Hub, and `add-new-page-type` flow. Do not inline this logic elsewhere.
- `lib/sendEmail.ts` — `sendEmail({ to, subject, text?, html? })`: sends via Nodemailer/Gmail. **Throws** if `EMAIL_USER`/`EMAIL_PASS`/`EMAIL_FROM` are not set — callers must wrap in try/catch. In development with missing env vars the function still throws, but the register route logs the verification link to console before attempting the send.
- `lib/notifications/createNotification.ts` — `createNotification({ userId, type, title, body, link? })`: writes a `Notification` row. Never throws — wraps in try/catch and logs. Uses `(prisma as any).notification` because the Prisma client may be stale.
- `lib/workflow/createSubOrder.ts` — `createSubOrder({ parentOrderId, assigneeUserId, storeId, stepId, stepName, agreedAmount?, subOrderType })`: creates a child `Order` row (copies parent items/address, sets `status="confirmed"`, `deliveryStatus="processing"`) and fires an `order_assigned` notification. Idempotent — skips if a sub-order with the same parent+user+type already exists. Uses `(prisma as any).order` because new fields aren't in the stale client.

### Chat System Messages (`iv = "system"`)
`ChatMessage` rows created server-side (e.g., quote-request notifications from `lib/workflow/triggerQuoteRequests.ts`) are stored as plaintext with `iv = "system"`. This is intentional — server-side message creation cannot perform ECDH client-key encryption. When rendering chat messages, check `if (message.iv === "system")` and display the `ciphertext` field as a plain system-notice card (grey, no decrypt attempt). **Do not attempt to decrypt these messages** — the decryption will silently produce garbage. Do not "fix" this pattern by moving it to a queue without updating this note.

### Quote Timeouts (in-process `setTimeout`)
`lib/workflow/triggerQuoteRequests.ts` uses `setTimeout` to reject timed-out quotes. This works for development but **does not survive process restarts**. Replace with BullMQ (or any durable job queue) before production launch. See also `docs/START_HERE.md` for the flagged risk.

### Security Notes
- CSP headers are configured in `next.config.mjs` — update them when adding new external scripts, styles, or media sources
- `X-Frame-Options: DENY` is set globally; do not add iframe embeds without updating the CSP `frame-src`
- `geolocation` permission is restricted to `self` and `https://charaivati.com`

### Environment Variables
Required: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `SENDGRID_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, Upstash Redis credentials.

Auth email (Nodemailer/Gmail — used by `lib/sendEmail.ts` for verification emails):
- `EMAIL_USER` — Gmail address used as the SMTP sender
- `EMAIL_PASS` — Gmail app password (not the account password)
- `EMAIL_FROM` — Display address in the `From:` header (can differ from `EMAIL_USER`)

Image search (all optional — `lib/imageSearch.ts` skips missing providers and falls back to Picsum):
- `UNSPLASH_ACCESS_KEY` — Unsplash API client ID
- `PEXELS_KEY` — Pexels API key
- `PIXABAY_KEY` — Pixabay API key

Ollama / AI chatbot (both optional — defaults used if absent):
- `OLLAMA_URL` — Base URL of the local Ollama server (default: `http://localhost:11434`)
- `OLLAMA_MODEL` — Model name to use (default: `llama3.2`)

## Testing

`ALLOW_TEST_BYPASS=true` enables an `X-Test-UserId` header bypass in 5 API routes, letting a ts-node test script impersonate any user without a JWT. **Only present in `.env.local`. Never set in `.env`, `.env.production`, or Vercel env vars.**

Routes that contain the bypass block (marked `// TEST ONLY — never deploy with ALLOW_TEST_BYPASS=true`):
- `app/api/order/[id]/step/[stepId]/confirm/route.ts`
- `app/api/order/[id]/step/[stepId]/fail/route.ts`
- `app/api/order/[id]/quote/[quoteId]/respond/route.ts`
- `app/api/order/[id]/quote/[quoteId]/accept/route.ts`
- `app/api/order/[id]/customer-confirm/route.ts`

Run the end-to-end workflow test (requires dev server running):
```bash
ALLOW_TEST_BYPASS=true npx ts-node --project tsconfig.scripts.json scripts/test-workflow.ts
```

### Automated
scripts/test-workflow.ts — 24/24 checks, 7/7 groups
Run: `ALLOW_TEST_BYPASS=true npx ts-node --project tsconfig.scripts.json scripts/test-workflow.ts`
`ALLOW_TEST_BYPASS=true` must only exist in `.env.local` — never production.

### Manual test sequence (browser/incognito/mobile)
1. Browser: initiative → Workflow tab → verify 3 default steps seeded
2. Browser: store orders → confirm order → WorkflowSection shows Step 1 active
3. Browser: Confirm Step → Step 2 activates
4. Incognito: `/app/orders?tab=requests` → submit quote amount
5. Browser: accept quote in WorkflowSection → Step 3 activates
6. Mobile: `/earn/deliveries` → accept assignment → Start GPS → Confirm Delivery
7. Incognito: `/order/[id]/track` → map visible → confirm receipt

### Known gaps for next test round
- GPS broadcast on mobile needs real device test (useGeolocation Capacitor fallback)
- `iv="system"` chat messages need renderer check in chat UI
- Address lat/lng capture: `AddressForm.tsx` is built but needs end-to-end test (new address save, edit, and confirm lat/lng flows into delivery cost calculation via `assignNextPartner`)
- `assignNextPartner` partner cycling: needs integration test with 2+ `WorkflowStepAssignee` rows — reject first, confirm second, verify sub-order cost is calculated
- Escalation notification: needs test after 3 full rejection cycles

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
- **`Order.deliveryStatus` / `assignedToId` / `deliveryNote` / `vehicleId` / `partnerStatus` were added via `db push`, not a migration file** — there is no migration SQL for these columns. If the DB is ever reset from migrations, these columns will be missing. Use `db push` again or add them manually.
- **`Order.assignedToId` and `Order.vehicleId` are NOT Prisma relations** — both are plain `String?` fields. `assignedToId` stores a `Collaboration.id`; `vehicleId` stores a `Vehicle.id`. Resolve them manually; do not use Prisma `include` or `connect` on them.
- **`Order.vehicleId` is NOT cleared when the vehicle broadcast stops** — the partner's `stop()` call deletes the `Vehicle` row but leaves `Order.vehicleId` set. The tracking page handles this correctly because the vehicles API filters by `updatedAt >= 2 min ago`, so a deleted vehicle returns no rows and the map shows no marker.
- **Delivery partner PATCH is restricted** — partners can only send `partnerAction`, `deliveryStatus`, or `vehicleId`. Any attempt to send `assignedToId` or `deliveryNote` from the partner returns 400. The owner UI must not expose those fields to partners.
- **`partnerStatus` is always derived server-side** — never send `partnerStatus` directly from the owner UI. Set `assignedToId` and the API sets `partnerStatus = "assigned"` automatically. Partners use `partnerAction: "accept" | "reject"`. The only client-set `partnerStatus` value is `"completed"` (sent by `DeliveriesClient` on mark-delivered, but also auto-set by the API when `deliveryStatus = "delivered"`).
- **`Collaboration` PATCH must include page relations in the response** — `prisma.collaboration.update` without an `include` returns only flat fields. The frontend reads `updated.requester.title` / `updated.receiver.title` to optimistically add the accepted partner to the active list. Omitting the include causes a `Cannot read properties of undefined (reading 'title')` crash.
- **`Collaboration.receiverId` must be a `Page.id`** — the API resolves Store IDs and store slugs to their linked `pageId` automatically, but stores with `pageId: null` cannot participate. Pages created outside the normal `openStore()` flow may have no linked store pageId.
- **Never call `navigator.geolocation` directly in new code** — always use `useGeolocation()` from `hooks/useGeolocation.ts`. The hook tries Capacitor first (works in the Android/iOS native shell) and falls back to the browser API automatically. Direct `navigator.geolocation` calls will silently fail on Android when the Capacitor plugin is expected. `TransportMap.tsx` still uses the browser API for its one-shot centering call — that is the only permitted exception.
- **`LanguageProvider` writes both localStorage AND a cookie** — `setLang()` calls `localStorage.setItem("lang", l)` AND `document.cookie = "lang=..."`. The cookie (name: `"lang"`, path `/`, max-age 1 year, SameSite=Lax, Secure on HTTPS) is what the edge middleware reads to gate unauthenticated requests. Do not remove the cookie write — without it, unauthenticated users will be permanently redirected to the language picker.
- **The `"lang"` cookie is the middleware language gate signal** — `middleware.ts` checks `req.cookies.get("lang")` for unauthenticated requests. If absent, the request is redirected to `/?redirect=<path>`. Authenticated users (valid session cookie) bypass the gate entirely. The gate is skipped for `/`, `/login`, `/register`, `_next/`, `api/`, and static file extensions.
- **After registration, the login page stays on the page — it does NOT redirect** — `handleRegister()` sets `step = "verify-pending"` on a 200 response. There is no timeout-and-redirect behavior. If you see code that redirects after registration it is a regression.
- **Email verification links land on `/verified`, not `/login`** — `GET /api/user/magic` redirects to `/verified?email=...&redirect=...`. `/verified` is a standalone page with a single "Sign in to continue →" CTA that carries the `redirect` param through to `/login`. Do not assume the magic link goes to `/login`.
- **`sendEmail` throws if not configured — do not call it without a try/catch** — `lib/sendEmail.ts` throws `Error("Email not configured: ...")` when `EMAIL_USER`/`EMAIL_PASS`/`EMAIL_FROM` are absent. Any route that calls `sendEmail` and does not catch will return a 500 to the client. The register route catches this and returns a user-facing 500 with a support message. Do not add a silent fallback — the throw is intentional so misconfigured deploys fail loudly rather than silently losing emails.
- **`Order.parentOrderId`, `Order.subOrderType`, `Order.agreedAmount` require raw SQL** — these three columns were added via Neon MCP migration. The Prisma generated client cannot access them until `npx prisma generate` succeeds (EPERM on Windows while dev server runs). All code that reads or writes these fields uses `(prisma as any).order` or `prisma.$queryRaw`. Do not add them to a typed `where`/`select` while the client is stale.
- **`Notification` model requires `(prisma as any).notification`** — same reason as above. `createNotification.ts` already uses the cast. Any new code that touches `Notification` rows must also use `(prisma as any)` until generate runs successfully.
- **`WorkflowStepAssignee` model requires `(prisma as any).workflowStepAssignee`** — added via migration after last successful generate. Same pattern. Affects `assignNextPartner.ts`, the workflow GET route, and the step assignees POST route.
- **`OrderStepProgress.currentAssigneeId`, `cycleCount`, `lastFeeMultiplier` require `(prisma as any).orderStepProgress`** — same migration situation. Do not add these fields to typed Prisma queries while the client is stale.
- **Sub-orders appear in `GET /api/store/orders?storeId=X`** — the store orders query does not filter by `parentOrderId IS NULL`, so sub-orders with the same `storeId` appear as top-level items. The owner order management page (`/store/[id]/orders`) therefore shows them alongside parent orders. This is known behaviour; filter them with `parentOrderId: null` if you need to hide them.
- **WorkflowSection has four distinct states — do not merge them** — (A) no `initiativeId` on the store: show the "no workflow" setup link; (B) `initiativeId` set but order not yet confirmed: show "confirm to activate"; (C) `activeStep` present: show step chip + Confirm Step or quote list; (D) `partnerStatus === "rejected"` with `activeStep`: show rejection panel + Retry Step. Collapsing these states or adding an early-return before all four checks will hide workflow controls.
- **The delivery pipeline stepper in `/store/[id]/orders` is intentionally read-only** — the 5-step stepper pills have no `onClick` handlers; only the Cancel button fires `onPatch`. Do not add click handlers back; the workflow system now drives delivery status automatically. The assignment dropdown and delivery note remain editable for manual override.
- **Workflow assignee dropdown includes ALL accepted collabs** — `GET /api/initiative/[pageId]/workflow` returns assignees from any collaboration scope (`partner`, `team`, `third_party`) as long as `status = "accepted"`. An earlier version filtered to `scope IN ("team","third_party")` only, which caused delivery partners (scope="partner") to disappear from the dropdown. Do not re-introduce the scope filter.
- **`GET /api/orders/requests` is separate from `GET /api/store/orders`** — it returns Quote rows (not Order rows) addressed to the current user's collaborations. Do not confuse it with the buyer/seller order list endpoints.
- **`WorkflowStep.assigneeId` and `assigneeIds` are deprecated — use `WorkflowStepAssignee` rows** — the scalar fields still exist in the schema for backwards compatibility but new code must add assignees via `POST /api/initiative/[pageId]/workflow/[stepId]/assignees`. `assignNextPartner` reads only `WorkflowStepAssignee` rows; steps with only the old scalar fields will have no cycling pool and will immediately escalate.
- **`WorkflowStepAssignee` requires `(prisma as any).workflowStepAssignee`** — the model was added after the last successful `prisma generate`. Use the `any` cast until generate runs. Same pattern as `Notification` and `Order` new fields.
- **`assignNextPartner` falls back to owner's default address for distance** — if either the delivery address or the store owner's default address lacks `lat/lng`, `distanceKm` is 0 and all per-km cost components are zero. Address coordinates are captured by `AddressForm` but only if the user confirms the map pin — they are optional.

## Store Initiative System

### Data Models

**`Collaboration` (extended)**
Added fields: `scope String @default("partner")` (`"team" | "third_party" | "partner"`), `initiativeId String?`, `teamRole String?` (`"founder" | "co_founder" | "ceo" | "partner" | "employee" | "custom"`), `customRole String?`. Promoting a Collaboration to `scope="team"` via `PATCH /api/initiative/[pageId]/team/[collaborationId]` makes it a team member. Scope `"partner"` is the default for external partners.

**`WorkflowStep`**
Fields: `initiativeId` (Page.id of the linked initiative), `name`, `sequence`, `assigneeType` (`"team_member" | "third_party"`), `quoteRequired Boolean`, `quoteTimeoutHours Int @default(24)`, `assignmentMode String @default("sequential")` (`"sequential" | "first_to_accept"`). Steps are ordered by `sequence`; `initiativeId` matches `store.pageId` for stores that have linked initiatives. **`assigneeId String?` and `assigneeIds String[]` are `@deprecated`** — use `WorkflowStepAssignee` rows instead (see below); kept for existing data only.

**`WorkflowStepAssignee`**
Replaces the deprecated `assigneeId`/`assigneeIds` scalar fields on `WorkflowStep`. One row per (step, collaboration) pair. Fields: `stepId`, `collaborationId` (Collaboration.id), `sequence Int` (controls order in sequential cycling), `costPerOrder Float?`, `costPerKg Float?`, `costPerKgPerKm Float?`, `costPerItemPerKm Float?`. `@@unique([stepId, collaborationId])`. Cascade-deletes when the step or collaboration is removed. Cost fields override the same-named fields on `Collaboration` for this assignee's cost calculation.

**`OrderStepProgress` (OSP)**
One row per (Order, WorkflowStep) pair. `status`: `"pending" → "active" → "confirmed" | "failed"`. `@@unique([orderId, stepId])`. Created in bulk by `activateWorkflow`; the active step drives delivery assignment and quote requests. Additional fields for partner cycling: `currentAssigneeId String?` (the `WorkflowStepAssignee.id` currently being tried), `cycleCount Int @default(0)` (how many full rejection cycles have completed), `lastFeeMultiplier Float @default(1.0)` (fee multiplier for the current cycle; increases 5% per cycle).

**`Quote`**
One row per (Order, step, party). `requestedPartyId` is a `Collaboration.id`. `status`: `"pending" → "submitted" → "accepted" | "rejected"`. `expiresAt` is set to `now() + quoteTimeoutHours`. `Order.quoteSummary Json?` stores the owner-preferred ordering `[{ quoteId, partyName, amount, status }]`.

**`Order` (new fields)**
`requiresAttention Boolean @default(false)` — set when a step fails or a quote times out; visible as a red banner in the owner order page. `quoteSummary Json?` — rebuilt sorted by amount on every quote response. `parentOrderId String?` — self-FK; set on sub-orders created per workflow step. `subOrderType String?` — `"delivery" | "service" | "packaging"`. `agreedAmount Float?` — the accepted quote amount or fixed assignment fee for a sub-order.

**`Notification`**
Fields: `id`, `userId` (FK → User, cascade delete), `type` (`"order_assigned" | "quote_requested" | "quote_submitted" | "step_confirmed" | "order_confirmed" | "delivery_complete" | "escalation"`), `title`, `body`, `link String?`, `read Boolean @default(false)`, `createdAt`. Index on `userId` and `createdAt`.

### Helper Files

| File | Purpose |
|---|---|
| `lib/workflow/activateWorkflow.ts` | Called when `Order.status → "confirmed"`. Creates all OSP rows as `"pending"`, activates step 1, sets `Order.assignedToId` if step 1 has a non-quote assignee, or fires quote requests if `quoteRequired`. |
| `lib/workflow/advanceToNextStep.ts` | Called after any step is confirmed. Finds the next step by sequence, activates its OSP. If the next step is the **last** step: sets `Order.deliveryStatus = "out_for_delivery"`. If no next step: returns (customer confirm sets `"delivered"`). Also calls `createSubOrder` for non-quote steps when the next step has an `assigneeId`. |
| `lib/workflow/assignNextPartner.ts` | Sequential partner cycling for a step. Reads `WorkflowStepAssignee` rows in `sequence` order. If all are rejected: increments `cycleCount`, applies 5% fee hike (`lastFeeMultiplier *= 1.05`), restarts from the top. After 3 full cycles: sets `requiresAttention = true`, fires `escalation` notification to the store owner, returns `{ escalated: true }`. Also calculates delivery cost from `WorkflowStepAssignee` pricing fields + order weight/distance, creates a sub-order with the agreed cost, and notifies the partner. |
| `lib/workflow/triggerQuoteRequests.ts` | Creates `Quote` rows for all parties in `assigneeId + assigneeIds`, sends a system chat message (`iv="system"`) to each party, fires a `quote_requested` notification, and registers an in-process `setTimeout` to reject un-responded quotes after `quoteTimeoutHours`. |
| `lib/workflow/createSubOrder.ts` | Creates a child `Order` row for a workflow step assignee (copies parent items/address, sets sub-order type and agreed amount), then fires an `order_assigned` notification. Called from `advanceToNextStep` (non-quote steps) and from `accept/route.ts` (quote steps). Idempotent. |
| `lib/workflow/calculateDeliveryCost.ts` | Computes delivery cost from `{ costPerOrder, costPerKg, costPerKgPerKm, costPerItemPerKm }` pricing fields plus `totalWeightKg`, `totalItems`, `distanceKm`. Returns 0 if all pricing fields are null. Called by `assignNextPartner`. |
| `lib/geo/haversine.ts` | `haversineKm(lat1, lng1, lat2, lng2)` — great-circle distance in km. Used by `assignNextPartner` to measure store-to-delivery-address distance. |

### Key Flows

**Order confirm → workflow activate**
1. `PATCH /api/store/orders/[orderId]` sets `status="confirmed"`
2. `activateWorkflow(orderId)` fires fire-and-forget
3. All OSP rows created as `"pending"`; step 1 set `"active"`
4. If step 1 is a non-quote team step: `Order.assignedToId = step1.assigneeId`, `partnerStatus = "assigned"`

**Step confirm → auto-advance**
1. `PATCH /api/order/[id]/step/[stepId]/confirm` (owner or step assignee)
2. OSP row set `"confirmed"`; `advanceToNextStep` called
3. Next step OSP set `"active"`. If next step is last: `Order.deliveryStatus = "out_for_delivery"`
4. If next step has `quoteRequired=true`: `triggerQuoteRequests` fires immediately

**Quote → lowest auto-sort → founder accept**
1. Parties submit via `POST /api/order/[id]/quote/[quoteId]/respond { amount }` — `quoteSummary` rebuilt sorted by amount ascending
2. Owner drags to reorder preference via `PATCH /api/order/[id]/quote-order`
3. Owner accepts via `POST /api/order/[id]/quote/[quoteId]/accept` — all others rejected, step confirmed, `advanceToNextStep` called

**Delivery GPS → customer confirm**
1. Partner's step becomes active → `deliveryStatus = "out_for_delivery"`, `partnerStatus = "assigned"`
2. Partner accepts → `partnerStatus = "accepted"`; opens GPS modal in `/earn/deliveries`
3. Partner starts GPS (`Broadcaster` → `/api/transport/broadcast`), links vehicle via `PATCH /api/order/[id]/delivery { vehicleId }`
4. Customer polls `GET /api/order/[id]/delivery` every 5 s on `/order/[id]/track`; sees live map when `vehicleId` set
5. Partner confirms: `PATCH /api/order/[id]/step/[stepId]/confirm` → `partnerAction: "complete"` → `partnerStatus = "completed"`
6. Customer sees "Confirm you received this order?" prompt; clicks → `POST /api/order/[id]/customer-confirm` → `deliveryStatus = "delivered"`

**Partner rejection → owner retry**
1. Partner rejects: delivery route sets `partnerStatus = "rejected"`, `requiresAttention = true`, marks active OSP `"failed"`
2. Owner sees red rejection panel in WorkflowSection; picks reassignment from partner dropdown
3. Owner clicks "Retry Step" → `PATCH /api/order/[id]/step/[stepId]` → OSP reset to `"active"`, `requiresAttention = false`, `partnerStatus = "assigned"`

**Delivery block flow (internal employee assignment)**
1. Workflow step activates → `assignNextPartner` runs → `createSubOrder` called with `assigneeUserId = partnerUserId`
2. `createSubOrder` finds the partner's store (`Store WHERE ownerId = assigneeUserId`), queries its delivery blocks (`serviceType = "delivery"`)
3. Cost calculated from first block's `price` + `perKgRate × weight` + `perKmRate × distance`; sub-order created in partner's store with `status = "pending"`, `userId = customer`
4. Partner sees the sub-order in `/store/[id]/orders`; selects a delivery block from "Assign Employee" dropdown → `PATCH /api/order/[id]/delivery { partnerAction: "assign_block", blockId }` → `partnerStatus = "accepted"`, `deliveryStatus = "processing"`
5. Employee (`block.assignedUserId`) receives `order_assigned` notification and sees the order in `/earn/deliveries` (LATERAL JOIN on items JSON → Block.assignedUserId)
6. Employee starts GPS → customer tracks → customer confirms receipt → `POST /api/order/[id]/customer-confirm` sets `deliveryStatus = "delivered"`
7. `customer-confirm` detects `parentOrderId`, confirms the parent's active OSP, calls `advanceToNextStep(parentOrderId, stepId)` — parent order workflow continues

### Notifications

`Notification` rows are created by `lib/notifications/createNotification.ts` in four places:
- **`triggerQuoteRequests`** → `type: "quote_requested"` to each party when a quote-step activates
- **`confirm/route.ts`** (step confirm) → `type: "order_assigned"` to the next step's assignee (fire-and-forget)
- **`store/orders/[orderId]/route.ts`** (confirm order) → `type: "order_confirmed"` to the store owner
- **`assignNextPartner`** → `type: "order_assigned"` to newly assigned partner; `type: "escalation"` to store owner when all partners reject after 3 full cycles

UI: `components/notifications/NotificationBell.tsx` — bell icon in `app/app/layout.tsx` top bar (left of avatar, only shown when logged in). Polls `GET /api/notifications` every 30 s. Red badge shows `unreadCount`. Click opens a dropdown of 10 most recent; "See all →" links to `/app/notifications`. Full page: `app/app/notifications/page.tsx` — groups by Today / Yesterday / Earlier; "Mark all read" button.

### Initiative Hub Tabs (owner-only at `/earn/initiative/[pageId]`)

| Tab | Component | Access |
|---|---|---|
| Overview | inline in `InitiativeTabs` | all |
| Store | inline in `InitiativeTabs` | all |
| Team | `components/earn/TeamTab.tsx` | canEdit = founder / co_founder |
| Partners | `components/earn/PartnersTab.tsx` | all |
| Workflow | `components/earn/WorkflowTab.tsx` | canEdit = founder / co_founder |

`canEdit` is derived in `InitiativeTabs` by fetching `GET /api/initiative/[pageId]/team` and reading `userTeamRole`. `null` (owner without explicit team record) → `canEdit = true`.

### Known Production Risks

- **Quote timeouts use in-process `setTimeout`** (`lib/workflow/triggerQuoteRequests.ts`) — does not survive server restarts. Replace with BullMQ before production.
- **Chat system messages stored as plaintext** — `ChatMessage` rows with `iv = "system"` contain the raw text in `ciphertext`. Chat renderers must check `iv === "system"` and skip ECDH decryption. See `### Chat System Messages` above.
- **`ALLOW_TEST_BYPASS=true` must never reach production** — only in `.env.local`. The bypass bypasses JWT auth entirely using a plain user ID header.
- **`WorkflowStepAssignee` and OSP new fields require `(prisma as any)`** — `WorkflowStepAssignee`, `OrderStepProgress.currentAssigneeId`, `cycleCount`, `lastFeeMultiplier` were added after the last successful `prisma generate`. Use `(prisma as any)` casts until generate runs. Run `npx prisma generate` after stopping the dev server.
- **`assignNextPartner` escalation after 3 cycles is silent to the partner** — only the store owner receives the `escalation` notification. The OSP is left as `"active"` with `requiresAttention = true`. Owner must manually reassign or the order stalls.
- **`createSubOrder` uses the first delivery block found for cost calculation** — if a partner has multiple delivery blocks (e.g., bike vs. van), the first one by `createdAt` is used and the partner may need to reassign. Wire block selection to `WorkflowStepAssignee` before production to let the workflow choose the correct block per step.

### Navigation Map

**Owner flow**
```
/store/account → /store/orders/all?storeId=X → /store/[id]/orders → /store/[id]/orders/delivered
/store/[id] (store page) → "Manage Orders →" → /store/[id]/orders
/store/[id]/orders → "Initiative & Workflow →" → /earn/initiative/[pageId]
```

**Delivery partner flow**
```
/app/orders?tab=my → "Deliver 🚚" → /earn/deliveries
```

**Customer flow**
```
/app/orders?tab=my → "Track 📍" → /order/[id]/track → "← My Orders" → /app/orders?tab=my
```

**Third-party (quote) flow**
```
Notification → /app/orders?tab=requests → submit quote → accepted → /app/orders?tab=my
```

### Deferred Features (do not rebuild)

- **Quote system for delivery steps**: removed. Quotes only apply to third_party non-delivery steps.
- **BullMQ for quote timeouts**: currently in-process `setTimeout`. Replace before production.
- **Uber-like cab booking**: delivery blocks with `per_km` pricing are bookable directly by customers from the store page. Full fleet management (multiple employees, availability, surge pricing) deferred.

### Active (Previously Deferred) Features

- **Delivery cost calculation** — now wired into `lib/workflow/assignNextPartner.ts`. Pricing comes from `WorkflowStepAssignee` cost fields (`costPerOrder`, `costPerKg`, `costPerKgPerKm`, `costPerItemPerKm`). Weight from `Block.weight Float @default(1)`. Distance from `haversineKm(storeOwnerDefaultAddress, orderDeliveryAddress)` using `Address.lat/lng`. If any price field is null the whole calculation returns 0 (free). The per-assignee `WorkflowStepAssignee` cost fields take precedence over Collaboration-level cost fields.
- **Address GPS coordinates** — `Address.lat Float?` / `Address.lng Float?` are now captured by `components/shared/AddressForm.tsx` (pincode → Nominatim geocode or drag-pin map) and persisted via `POST/PATCH /api/store/address`. Both create and update routes accept optional `lat`/`lng` in the request body.

## Windows Dev Environment Notes

### Prisma generate

**With the dev server stopped** (normal case — schema changes, after migrations):
```bash
npx prisma generate
```
Stop the server first (`Ctrl+C`). The DLL is not held open when the server is down, so the rename succeeds. This produces a full binary-engine client that works with direct `postgresql://` URLs. Restart the server afterward.

**With the dev server running** (hot-fix for stale client TS errors only):
```bash
npx prisma generate --no-engine
```
`--no-engine` regenerates TS types and JS wrappers without touching `query_engine-windows.dll.node`, which Windows Defender locks while the server is running. **Critical caveat:** the `--no-engine` output is a Data Proxy / Prisma Accelerate-only client — it refuses direct `postgresql://` URLs (error `P6001`). This means the server will crash on any Prisma query after a hot `--no-engine` run. **Always restart the server with a normal `npx prisma generate` afterward** (after stopping it first).

**Rule of thumb:** Use `--no-engine` to silence TypeScript errors in the IDE while the server is running; use the normal generate before committing or after any actual schema/migration change.
