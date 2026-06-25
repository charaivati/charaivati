At the start of every session, read /docs/START_HERE.md silently before responding.
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working preferences

- Prefer the simplest solution that works. One line over fifty.
- No new dependencies unless explicitly requested. Use the standard library or what's already installed.
- Match existing patterns rather than inventing new ones. Before adding a helper, check if a similar one already exists (e.g. the debounce pattern in `UnifiedSearch.tsx`) and follow it.
- Make only the requested change. Do not refactor, rename, or add abstractions that weren't asked for.
- Don't add comments explaining obvious code. Keep diffs small.
- When given a file path, edit that file — don't search the whole repo unless the change genuinely requires it.
- Separate reading from editing: if asked to look at something, look — don't start editing until confirmed.
- If a request is ambiguous, ask one short question instead of exploring broadly to guess.
- Prefer targeted edits (specific functions/lines) over rewriting whole files.
- Avoid: pulling in a library for something stdlib/an existing util already does; new files when an inline change fits; speculative "while I'm here" changes.

## Claude Code prompt workflow

Each planned feature or fix workstream is broken into numbered prompts (e.g. `BIZDOC-1a`, `BIZDOC-2`). Rules:

- **One fresh Claude Code chat per prompt** — never continue a previous chat with a new prompt's work.
- **Every prompt file starts with its ID as the first-line comment** — e.g. `# PROMPT BIZDOC-1a — description`.
- **Report back to the planning chat between prompts** — paste what changed (file-by-file) and any blockers before starting the next prompt.
- Prompt IDs follow the pattern `<WORKSTREAM>-<number><letter>` — letter suffixes (a, b) mean the work was split to keep each chat focused.

## Commands

```bash
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm run lint         # ESLint
npm run vercel-build # Prisma generate + next build (used on Vercel)
npm run seed:questions  # Seed the 12 IdeaQuestion rows (standalone; also runs inside prisma/seed.js)

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
| `fleet/` | **Public Fleet pages** — `/fleet/[pageId]` is the visitor-facing listing for a Fleet initiative; server component, no auth, `notFound()` for non-fleet pages |
| `order/` | Customer-facing order pages: `/order/[id]/track` (client component, live GPS tracking) |

The platform uses a 6-layer conceptual model: **Self → Society → State → Nation → Earth → Universe**, each with tabs for different analyses.

**Language re-pick from the app shell (MENU-LANG-1)** — the logged-in account dropdown in `app/app/layout.tsx` has a "🌐 Language" row (`<a href="/?from=<encodeURIComponent(pathname)>">`, guest variant excluded) that round-trips to `/` — the existing landing-page language selector — and back. `app/page.tsx` validates `from` via a same-file `getValidFrom()` guard (must start with `/app`, no `//`/`/\` prefix, no `http:`/`https:`/`javascript:` substring; anything else is treated as no `from`). A valid `from` skips the logged-in mount-bounce to `/self` so the picker grid renders, and a pick does `setLanguage(code)` then `router.replace(validFrom)` instead of its normal destination. See `docs/modules/mobile-shell.md` § Language re-pick for details, and `TECH_DEBT.md` §23 for the dead `UserMenu.tsx`'s divergent `charaivati.locale` cookie (not the live dropdown — do not confuse the two).

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

- **`lib/mergeGuest.ts`** — `mergeGuestToReal(guestId, realId)`: transfers cart items (quantities merged), wishlist, pinned stores, page follows (initiatives, courses), addresses, orders, owned Pages (initiatives/courses/health businesses), owned Stores, and `ConsultSession` — then deletes the guest user. Calling it twice is safe: duplicate-key conflicts are skipped and a missing guest is a no-op. **(ACTION-INTENT-5a)** Conflict sets (cart/wishlist/pinned/follows overlaps with the real user's existing rows) are read with `findMany`/`Promise.all` calls *before* the transaction, then resolved with bulk `updateMany`/`deleteMany` inside a `$transaction(..., { timeout: 15000 })` — the old version did a `findUnique` + `update`/`delete` round trip per guest row (N+1), which routinely blew the default 5000ms transaction timeout for guests with more than a handful of cart/wishlist items, silently rolling back the *entire* merge (leaked guest `User` row, orphaned `ConsultSession`) while login still reported success. Plain bulk reassigns (addresses/orders/pages/stores/ConsultSession) and the final `user.delete` run as separate awaited calls AFTER the transaction, in that order — `user.delete` must stay last so cascade-deletes never remove a not-yet-moved row. `mergeGuestToReal` now throws on real failure (no internal catch-all); callers (`login`, `magic`) already wrap it in `.catch(e => console.error(...))` — log loudly, don't block login. Do not make this swallow silently again.
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
- `app/api/notifications/stream` — `GET` SSE stream; sends `data:` events when unread count changes; heartbeat ping every 30 s; client falls back to 10 s polling + `visibilitychange` trigger when EventSource is unavailable. **Early-exit optimisation**: if the user has zero total notifications on the initial poll the stream closes immediately and the client falls back to polling — avoids holding open connections for brand-new users
- `app/api/initiative/[pageId]/workflow` — `GET` returns `{ steps[], assignees[] }`; each step includes `assignees: WorkflowStepAssignee[]` (new system) and deprecated `assignee` (from `assigneeId`); auto-seeds 3 default steps if none exist; `POST` adds a step
- `app/api/initiative/[pageId]/workflow/[stepId]` — `PATCH` updates a step (accepts `name`, `assigneeId`, `assigneeType`, `quoteRequired`, `quoteTimeoutHours`, `assignmentMode`); `DELETE` removes it
- `app/api/initiative/[pageId]/workflow/reorder` — `PATCH { steps: [{id,sequence}] }` reorders steps in a transaction
- `app/api/initiative/[pageId]/team` — `GET` returns team members + eligible partners + current user's `teamRole`
- `app/api/initiative/[pageId]/team/[collaborationId]` — `PATCH` promotes to team (`scope="team"`) or demotes back to partner
- `app/api/store/search` — `GET ?q=` case-insensitive store name search; returns `{ id, name, slug, pageId }[]`; excludes stores owned by the calling user so a store never appears as its own partner candidate
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

### Store Open/Closed Status

Two fields were added to the `Store` model:

| Field | Type | Default | Purpose |
|---|---|---|---|
| `acceptingOrders` | `Boolean` | `false` | Manual open/closed toggle; owner flips it via the store page or Initiative Hub. **All new stores start closed.** |
| `hoursText` | `String?` | `null` | Display-only string e.g. "3:30 PM to 11 PM daily". Written by menu parser; shown in the closed banner. NOT parsed or enforced — auto-schedule is planned but not built. |

**Server-side guard** — both order creation routes reject with 422 when the store is closed:
- `POST /api/store/orders/quick`: check runs after the existing `store.findUnique`; returns `{ error: "This store isn't taking orders right now." }` status 422.
- `POST /api/store/orders` (cart): `acceptingOrders` fetched in the same raw SQL call that reads `deliveryFee`; same 422.
- `QuickOrderModal` already surfaces `d.error` generically — no modal changes needed.

**Owner toggle** — two entry points: (1) `StoreHero` in `app/store/[id]/page.tsx` — always visible to owners; (2) Store tab in `components/earn/InitiativeTabs.tsx`. Both optimistic-flip with revert on error.

**Buyer-facing banner** — in `StoreHero` and at the top of every section page: green pill "Taking orders" when open; amber "Not taking orders right now · Hours: {hoursText}" when closed.

**Disabled buy buttons** — when closed and non-owner: section page Add to Cart + Buy Now show greyed "Store closed"/"Closed"; saved page Buy Now shows greyed "Closed". Owners always see active buttons.

**API surface**: `GET /api/store/[id]` returns `acceptingOrders` + `hoursText` via raw SQL (same call as `slug`). `PATCH /api/store/[id]` allows updating both fields. `GET /api/store/wishlist` includes `store.acceptingOrders` via a batch raw SQL call.

**Menu parser**: `POST /api/store/parse-menu/apply` writes `parsed.hours` to `Store.hoursText` via `$executeRaw` after the transaction.

### UPI VPA Payment Handle (REQBCAST-1b)
A provider's UPI VPA (`name@bank`) so a paying party can pay them **directly**. **DISPLAY/HANDOFF ONLY — the platform never validates, collects, or escrows.** Shape-validated at input, **never** resolution-checked. This is the handoff primitive for the coming broadcast engine (REQBCAST-1c).

- **Field homes** (both nullable `String`, migration `20260623000000_add_upi_vpa`): `Store.upiVpa` (store's pay-to handle) and `Profile.upiVpa` (user's personal handle, for non-store service providers — supersedes the unwired `Profile.preferredPayment`, which is kept not removed). Both read/written via **raw SQL** (`$queryRaw`/`$executeRaw`) — same stale-client pattern as `Store.line1`/`lat`; do not put `upiVpa` in a typed Prisma `where`/`select`.
- **Validation** — `lib/payments/vpa.ts`: `isValidVpa(v)` (regex `^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$`) + `normalizeVpa(v)` (trim → string|null, empty clears). Shape only — used by client setter + both API routes.
- **API** — `GET/PATCH /api/store/[id]` and `GET/PATCH /api/user/profile` both surface `upiVpa`: omit key = skip, `""`/null = clear, invalid shape → `400 { error: "Enter a valid UPI ID like name@bank." }`.
- **UI** — `components/payments/VpaSettingCard.tsx` (owner setter, PATCHes `{ upiVpa }` to a given `endpoint`) is mounted in the Initiative Hub **Store tab** (`InitiativeTabs.tsx`) and the user **Earning** section (`app/(User)/user/edit/page.tsx`). `components/payments/PayToVpa.tsx` is the display/handoff atom ("Pay directly to … [Copy]") — the broadcast engine (REQBCAST-1c) is the intended paying-party consumer.
- **Handoff getter** — `lib/payments/getVpa.ts` `getPayToVpa({ storeId?, userId? })` (store handle first, falls back to owner's `Profile.upiVpa`). **No live consumer yet** — built and left ready for REQBCAST-1c (no checkout/direct-pay path exists in the app today).
- **i18n** — 8 slugs seeded by `prisma/seed-vpa-ui.js` (category `ui-vpa`): `pay-vpa-label`, `pay-vpa-placeholder`, `pay-vpa-help`, `pay-vpa-invalid`, `pay-vpa-save`, `pay-vpa-saved`, `pay-to-vpa-label`, `pay-vpa-copy`.

### Request Broadcast Engine (REQBCAST-1c)
The inDrive/noticeboard primitive. A user posts a service request; nearby providers offering that category get a notification card, respond (optionally with a quoted price), the requester accepts ONE, and both settle DIRECTLY via the accepted provider's UPI VPA. Two kinds: `kind='service'` (1c) and `kind='errand'` (1e — see below). **Full design: `docs/modules/requests.md`.**

- **Doctrine (locked)**: Noticeboard, NOT dispatcher — the platform broadcasts + hands off contact + VPA, and NEVER assigns, sets the price, or collects/escrows. Negotiation is **pre-acceptance only** (a response may quote a price; acceptance closes it — no post-accept bargaining). Reuses REQBCAST-1b `getPayToVpa`/`PayToVpa` for the handoff.
- **Separate-status decision (and WHY)**: `RequestBroadcast.status` (broadcast lifecycle: `open|accepted|cancelled|expired`) and `RequestResponse.status` (`pending|accepted|rejected`) are DISTINCT fields judged at write-time. This deliberately avoids the `OrderStepProgress` footgun where one literal (`"confirmed"`) means different things to different readers. The engine does NOT reuse OSP.
- **Models** (migration `20260624000000_add_request_broadcast`, P3006 workaround like TAG-STORE-1b): `RequestBroadcast` (requesterId, kind, categoryId→`StoreCategory`, title, description, status, addressLat/Lng, radiusKm, acceptedResponseId [plain `String?`, no Prisma relation — avoids FK cycle], createdAt, expiresAt; **dormant errand fields** pickupLat/Lng, dropLat/Lng, suggestedPrice) and `RequestResponse` (broadcastId cascade, providerId, providerStoreId?, quotedPrice, message, status, `@@unique([broadcastId, providerId])`). **Routes use raw SQL** (`$queryRaw`/`$executeRaw`) so the live engine client isn't disturbed — same stale-client pattern as 1b's `upiVpa`.
- **Nearby eligibility** (`lib/requests/eligibility.ts` `findEligibleProviders`): bounding-box `lat/lng BETWEEN` pre-filter in SQL FIRST, THEN JS Haversine refine to `<= radiusKm`, THEN the service filter — a `Store` with a `StoreCategoryLink` to the category, `deletedAt IS NULL`, lat/lng present, and an `EXISTS` `StoreBlock` with `serviceType='service'`. **v1 eligibility is store-declared** (no user-level service offering). No spatial index yet — bounding box is the mitigation (TECH_DEBT §20).
- **Routes** (`app/api/requests/`): `POST /api/requests` (create + chunked `Promise.allSettled` fan-out, one `request_broadcast_created` Notification per eligible provider, `scanInput` on text); `GET /api/requests` (requester's broadcasts + responses + handoff when accepted); `GET /api/requests/incoming` (reverse eligibility feed for providers); `POST /api/requests/[id]/respond` (unique-constraint 409 on double-response, notifies requester); `POST /api/requests/[id]/accept` (transaction: accept one, auto-reject siblings, close broadcast, notify winner+losers, return `{ handoff }`); `PATCH /api/requests/[id]` (cancel).
- **Expiry is lazy-on-read** — `expireStale()` (`lib/requests/common.ts`) flips overdue `open`→`expired` in a global UPDATE at the top of the GET routes; deliberately NOT the in-process `setTimeout` pattern (doesn't survive restarts).
- **New Notification types**: `request_broadcast_created`, `request_response_submitted`, `request_accepted`, `request_rejected` (plain `String` column — no migration). **UI — role-split surfaces (REQBCAST-1f)**: the **requester** side is `app/app/requests/page.tsx` ("My requests" only — the Mine/Incoming sub-toggle was removed); the **provider** side ("Incoming" broadcast feed) was relocated to the **Orders → Requests tab** via `components/requests/IncomingRequests.tsx` (the single source of truth — `app/app/orders/page.tsx` imports it), rendered as a separate section above the unrelated workflow Quote-request list (the two systems stay visually distinct, never merged). **Requester entry point (REQBCAST-1d)**: the **`/app/saved` Browse toggle Services tab** (Stores · Products · Services) renders `RequestsPage` verbatim; `/app/requests` is kept as a standalone requester-only deep-link route. **Provider entry point**: Orders → Requests (`/app/orders?tab=requests`) — the three provider notifications (`request_broadcast_created`/`request_accepted`/`request_rejected`) now deep-link here; the requester notification (`request_response_submitted`) still points to `/app/requests?tab=mine`. A stale `/app/requests?tab=incoming` link redirects client-side to `/app/orders?tab=requests`. The old `/app/discover` "Post a request" CTA was removed — discover is purely the store filter/map surface again. **i18n**: no new slugs — `IncomingRequests` reuses existing `ui-requests` slugs (`requests-tab-incoming` is the Incoming section heading); the "Quote requests" sub-heading in the Orders tab is hardcoded English, matching that file's existing un-i18n'd quote strings. 32 `ui-requests` slugs seeded by `prisma/seed-requests-ui.js`, plus `app-search-services-tab` (`ui-prodsearch`). **Verification**: `scripts/test-reqbcast.ts` — 25/25 against the live server with real minted sessions (16 service + 9 errand).

#### Errand mode (REQBCAST-1e — `kind='errand'`)
Pick-and-drop of **GOODS/TASKS ONLY** — courier/runner errands (pick up X from A, drop at B). **NO passengers, no ride-share, no carpool.** Carpool/ride-share is deliberately NOT built pending legal review (Assam transport stance + insurance liability). Any field or copy implying carrying people is out of scope — flag it.
- **Reuses the entire broadcast→respond→accept→VPA-handoff flow unchanged.** Errand differs from service in exactly three things: a pickup location, a drop location, and a **suggested price**. The `respond`/`accept` routes are 100% kind-agnostic — a provider's response MAY quote a price different from the suggestion (pre-accept negotiation, QUOTE-BLOCK-1 doctrine intact).
- **Schema**: the dormant `RequestBroadcast` errand fields (`pickupLat/Lng`, `dropLat/Lng`, `suggestedPrice`) were activated; **`pickupLabel`/`dropLabel String?`** added via raw-SQL ALTER on the dev DB only (no migration file — same precedent as 1b/1c). Labels are short human-readable display strings (`"{address name} — {city}"`), `scanInput`'d, shown to providers so they see the rough pickup/drop area without exact coords leaking beyond the stored lat/lng.
- **Suggested price is DISPLAY-ONLY, never enforced** — `lib/requests/suggestErrandPriceHint.ts` (`suggestErrandPriceHint(pLat,pLng,dLat,dLng)`): flat `₹30 base + ₹12/km` of pickup→drop Haversine distance. **Never a fare/floor/ceiling; the platform never sets price.** Named `*Hint` so no reader mistakes it for authoritative. Pure (imports only `haversineKm`) so the client form imports the SAME helper for live preview — one source of truth. Server recomputes and stores its own value at create. Placeholder constants (no Store errand rate card exists) — TECH_DEBT §20(f).
- **Pickup-anchored eligibility** — errands notify providers near the **PICKUP point** (the runner must reach pickup first), NOT the requester's home. Implemented by setting the broadcast's `addressLat/Lng = pickup` at create, so 1c's `findEligibleProviders` and the incoming reverse-eligibility query (both measure from `addressLat/Lng`) anchor on pickup with no query rewrite. `findEligibleProviders` gained an optional `serviceTypes` param: service requests match `['service']` providers (unchanged); errands match `['service','delivery']` — delivery/courier stores (a `StoreBlock serviceType='delivery'`) qualify as runners. The incoming feed mirrors this per-kind (a delivery-only store sees errands but NOT service requests — verified).
- **UI**: `app/app/requests/page.tsx` post form has a Service ↔ Errand `FilterPill` toggle; errand mode swaps the single "Your location" select for **pickup + drop** `LocSelect`s (NO map — standing preference) and shows the suggested-price hint live with explicit "only a suggestion" copy. Mine/Incoming cards render `📦 pickup → drop` + suggested price via the shared `ErrandLine`. **i18n**: 8 new `ui-requests` slugs (`requests-kind-service/errand`, `requests-pickup-label`, `requests-drop-label`, `requests-suggested-price-label/help`, `requests-post-cta-errand`, `requests-errand-title-placeholder`) seeded by `prisma/seed-requests-ui.js` across all 16 enabled languages (English fallback — LibreTranslate offline, TECH_DEBT §21).

##### One-off (temporary) pickup/drop locations (REQBCAST-1g)
A requester can be anywhere in the city, so errand pickup/drop are no longer limited to saved addresses. **NO schema change** — a temporary location is just coords + a label that FILL the existing `pickupLat/Lng/pickupLabel` (and drop) fields for THIS broadcast only.
- **`LocSelect`** (inline in `app/app/requests/page.tsx`) renders the saved-address dropdown plus a `"Use a different location…"` option (`TEMP = "__temp__"` sentinel). Selecting it shows `TempSearch` — a Nominatim free-text address search (`geocodeSearch()` in `lib/geo/geocode.ts`, reusing the existing pincode-geocode infra; `nominatim.openstreetmap.org` is already in CSP `connect-src`). **Address-search, not pin-drop** — the standing no-map-in-modal preference applies.
- **`resolveLoc(id, temp)`** unifies both sources: `id === TEMP` → the in-memory `{lat,lng,label}` temp object; otherwise the saved `Address`. `post()`, the live `errandHint`, and `canSubmit` all read the resolved `pickupLoc`/`dropLoc` — never the address id — so suggested price recomputes from the chosen coords whether saved or temporary.
- **Coords-not-saved doctrine**: a temporary location is NEVER written to the user's address book. The client never POSTs to `/api/store/address` for it. The **"save this address" checkbox was deliberately skipped** — `POST /api/store/address` mandates `name/phone/line1/city/state/pincode`, none of which a geocode search produces; persisting would require the full `AddressForm`, far past "optional".
- **Errand form no longer gated on `hasUsableAddr`** — errands always show the pickup/drop `LocSelect`s (temp covers the zero-saved-address case); the `hasUsableAddr` gate still applies to **service** requests only.
- Server side is unchanged and already proven: the POST route reads `pickupLat/Lng/pickupLabel` from any source; `scripts/test-reqbcast.ts` already posts errands with arbitrary (non-address-id) coords+labels and verifies storage, pickup-anchored eligibility, and suggested price (9 errand checks).
- **i18n**: 4 new `ui-requests` slugs (`requests-loc-different`, `requests-loc-search-placeholder`, `requests-loc-search`, `requests-loc-search-none`) seeded by `prisma/seed-requests-ui.js` across all 16 languages (English fallback — TECH_DEBT §21).

###### On-demand map picker for pickup/drop (REQBCAST-1g2)
Text geocoding alone is too brittle for imprecise queries, so the temp-location flow gained an **on-demand** draggable map pin plus live-GPS pickup. **NO schema change** — still just coords + label filling `pickupLat/Lng/pickupLabel` (and drop). **Conscious decision: an on-demand map IS allowed in this form** (it stays collapsed until "Set on map" is tapped) — this is the deliberate exception to the standing no-map-in-modal preference, made because exact point-setting has no text-only equivalent.
- **`TempSearch` → `TempPicker`** (inline in `app/app/requests/page.tsx`) — the saved-address dropdown + `"Use a different location…"` (`TEMP` sentinel) are unchanged; the temp panel now offers three resolution paths, all writing the same `{lat,lng,label}` via `onResolve`:
  1. **Search** — existing `geocodeSearch()` Nominatim text search (1g).
  2. **"Use my current location"** (pickup only, `allowGps` prop) — one-shot live GPS via `hooks/useGeolocation.ts` `startWatch`, stopped after the **first** fix (a `gotFix` ref guards against the watch firing twice); the coords are reverse-geocoded to a label. This is a single fix, **NOT** continuous tracking — distinct from FLEET-STATE-1b presence (different concern, do not conflate).
  3. **"Set on map"** — expands an inline `components/shared/MapPicker.tsx` (Leaflet drag-pin, reused as-is; loaded via `dynamic(..., { ssr:false })`) centred on the current resolved point → else a saved-address `defaultCenter` → else Bangalore (`MAP_FALLBACK`). On marker **drag-end** the pin coords are **reverse-geocoded** (`reverseGeocode()` in `lib/geo/geocode.ts`, Nominatim `/reverse`, India display, falls back to formatted coords) and the label updates live. Opening the map **seeds** the temp from the centre so "Use this location" works even without a drag. Confirm just collapses the map (temp already set).
- **No-match fallback**: the "No match found" message now offers a "Set it on the map instead" link that opens the picker — the map is the safety net when text search returns nothing.
- **Suggested price + pickup-anchored eligibility recompute from the FINAL resolved coords** (GPS / search / pin-drag), same as 1g — `pickupLoc`/`dropLoc` read the resolved coords, never an address id. Drop is **search-first** (saved + search + map; GPS not emphasised). Server side unchanged; `scripts/test-reqbcast.ts` 25/25 already exercises errands posted with arbitrary (pin-style) coords+labels (pin-derived coords ARE arbitrary coords+labels).
- **i18n**: 7 new `ui-requests` slugs (`requests-loc-current`, `requests-loc-map`, `requests-loc-map-hint`, `requests-loc-map-confirm`, `requests-loc-map-fallback`, `requests-loc-reverse`, `requests-loc-locating`) seeded by `prisma/seed-requests-ui.js` across all 16 languages (English fallback — TECH_DEBT §21).

#### Fleet provider presence (FLEET-STATE-1b — P1)
Live foreground location for fleet/runner providers, so a request matches them where they ARE, not where their store is parked. **P1 only** — presence + live-matching + an Available toggle. The mode state machine (P2) and auto-pooling (P3) are NOT built (TECH_DEBT §22). **Doctrine (locked): foreground-only, adaptive cadence, distance-gated, match-on-recent.**

- **Model `ProviderPresence`** (migration `20260625000000_add_provider_presence`, raw-SQL P3006 path like 1b/1c/1e — dev DB only, mirrored into `schema.prisma`): `{ id, userId @unique → User cascade, lat Float?, lng Float?, seenAt DateTime?, mode String @default("offline") }`, indexed on `(lat,lng)` and `seenAt`. **mode (P1): `"offline" | "available"`** — `"on_job"`/`"near_complete"` are reserved valid strings, unused until P2. **Routes use raw SQL** (`$queryRaw`/`$executeRaw`) — not in the stale typed client; same pattern as `RequestBroadcast`.
- **The eligibility change is ADDITIVE — presence OR static store coords, NEVER "presence required".** `lib/requests/eligibility.ts` `findEligibleProviders` and the incoming reverse feed (`app/api/requests/incoming/route.ts`) both `LEFT JOIN "ProviderPresence"` (gated to fresh-available rows) and resolve the matched position as `COALESCE(presence.lat/lng, Store.lat/lng)`. A provider with **no presence row falls through to their store coords, exactly as before** — every non-moving provider (tailor, cook, all service/errand providers) keeps matching unchanged. Making presence *required* would silently un-match every static provider; do not. (Regression canary: `scripts/test-reqbcast.ts` 25/25 must still pass after any eligibility edit.)
- **Freshness = 5 min, judged at READ time in eligibility, not by a scheduler.** The `LEFT JOIN` condition is `pp.mode='available' AND pp."seenAt" > NOW() - INTERVAL '5 minutes' AND pp.lat/lng IS NOT NULL`. A stale row (seenAt older than 5 min) is treated as offline even if `mode` still says `available` — covers the app being killed without a clean toggle-off. No background location and no scheduled sweep by design.
- **`POST /api/presence { lat, lng, mode }`** — auth'd upsert on `userId` (`ON CONFLICT DO UPDATE`), stamps `seenAt = NOW()`. `mode="available"` requires `lat`/`lng` (400 otherwise); `mode="offline"` clears position and stops matching. There is no GET — eligibility reads the row directly.
- **Adaptive cadence + distance gate live entirely client-side** in `components/requests/AvailableToggle.tsx` (the toggle owns the presence loop, over `hooks/useGeolocation.ts`): runs **only while available AND the document is foregrounded** (pauses on `visibilitychange` hidden, resumes on visible); POSTs at most ~every 10s and **skips a POST when < ~250m from the last reported position** (`haversineKm`) so standing still produces no spam; on toggle-OFF/unmount → `stopWatch()` + `POST mode=offline`. No background location, no foreground service.
- **Available toggle surface**: Orders → **Requests tab** (`app/app/orders/page.tsx`), above `IncomingRequests` — the provider's existing nearby-work feed, the natural home for "Receive work". Shows a live pulse indicator + last-updated time when ON.
- **i18n**: 5 new `ui-requests` slugs (`presence-available-label`, `presence-available-sub`, `presence-visible-note`, `presence-last-updated`, `presence-location-needed`) seeded by `prisma/seed-requests-ui.js` across all 16 languages (English fallback — TECH_DEBT §21).
- **Verification**: `scripts/test-reqbcast.ts` 25/25 (static-provider regression) + `scripts/test-presence.ts` 8/8 (live-presence match-not-static, offline stops matching, stale>5min treated as offline). Both accept `TEST_BASE` to point at a non-:3000 dev server.

### Store Slugs
Every store has a `slug String? @unique` field. Slugs are generated from the store name using `lib/store/generateSlug.ts` and assigned at creation time.

- **Resolution**: `GET /api/store/[id]` accepts either a cuid or a slug. Cuids (`/^c[a-z0-9]{24}$/i`) resolve via `findUnique`. Everything else resolves via `SELECT id FROM "Store" WHERE slug = $1` raw SQL (Prisma-client-agnostic).
- **Canonical redirect**: If a store page or section page is loaded using a cuid URL and the store has a slug, the page calls `router.replace()` to the slug URL. Browser bar always shows the slug after load.
- **Slug in responses**: `GET /api/store/[id]` always returns `slug` via an explicit raw SQL lookup appended to the response. All store-listing APIs (`/api/store/all`, `/api/store/pinned`, `/api/store/my-stores`, `/api/store/orders`, `/api/store/wishlist`) also include slug via the `getStoreSlugs` batch helper.
- **`lib/store/generateSlug.ts`** — `generateSlug(name)` (lowercase, hyphens) + `randomSuffix()` for collision avoidance
- **`lib/store/getStoreSlugs.ts`** — `getStoreSlugs(ids[])` returns `Record<id, slug|null>` via a single `SELECT id, slug FROM "Store" WHERE id IN (...)` raw SQL; used by all APIs to inject slug without depending on the Prisma typed client
- **Backfill**: `scripts/migrateStoreSlugs.ts` — run once to assign slugs to stores created before the field was added

### Store Taxonomy (Categories & Tags) — TAG-STORE-1b
Store discovery categories and tags are **table-backed controlled vocabulary, NOT Prisma enums**, and are a **completely different axis from `Page.pageType`** (initiative type: `store`/`service`/`fleet`/etc.). Categories are a single flat list — no `parentId` hierarchy.

- **Models**: `StoreCategory` / `StoreTag` (slug, order), each with a translations table (`StoreCategoryTranslation` has `title` + `description?`, `StoreTagTranslation` has `title` only) keyed on `@@unique([xId, locale])`, mirroring `TabTranslation`. M2M to `Store` via `StoreCategoryLink` / `StoreTagLink` — composite-PK join tables (`@@id([storeId, categoryId/tagId])`), cascade-delete both sides.
- **Migration**: `20260621000000_add_store_category_tag` (real migration, applied via `prisma db execute` + `prisma migrate resolve --applied` — `migrate dev` fails here with P3006 because the shadow DB can't apply the baseline; see `docs/modules/collaboration.md` for the same precedent).
- **Seed**: `prisma/seed-store-taxonomy.js` (standalone, `node prisma/seed-store-taxonomy.js`) — upserts 15 categories + 15 tags and their translations for all 16 enabled `Language` rows (240 rows each). Falls back to copying the English string when `LIBRE_TRANSLATE_URL` is unset/unreachable.
- **This prompt (TAG-STORE-1b) is data-layer only** — `GET /api/store/all`, `PATCH /api/store/[id]`, and discovery/filtering UI are NOT wired yet. Future prompts add the picker UI and filtering.

### Owner category/tag picker (TAG-STORE-1c-fix)
- **`GET /api/store/taxonomy?locale=xx`** — public, no auth. Returns `{ categories: [{id, slug, title, description}], tags: [{id, slug, title}] }` with per-string `locale → "en" → slug` fallback.
- **`GET /api/store/[id]`** additionally returns `categoryIds: string[]` / `tagIds: string[]` derived from `StoreCategoryLink`/`StoreTagLink`.
- **`PATCH /api/store/[id]` `categoryIds`/`tagIds` doctrine — array-replace, omit-to-skip**: each of `categoryIds`/`tagIds` is independent and optional. **Omitting the key leaves that axis untouched.** Passing an array (including `[]`) **replaces the full set** for that axis via `$transaction([deleteMany, createMany({ skipDuplicates: true })])` — an empty array clears all links. `categoryIds.length > 3` → `400 { error: "Pick up to 3 categories" }`; `tagIds` is uncapped. Apply this same "array replaces, missing key skips, empty array clears" pattern to any future M2M-link PATCH field.
- **UI**: `components/earn/StoreTaxonomyPicker.tsx`, wired into `InitiativeTabs.tsx` Store tab. 8 new `Tab`/`TabTranslation` strings seeded by `prisma/seed-store-taxonomy-ui.js` (128 rows = 8 × 16 languages).
- **Still NOT wired**: `GET /api/store/all` and customer-facing discovery/filtering UI (Phase 3, TAG-STORE-2+).

### Store Discovery — map + list, filters, gate (DISCOVER-1b)
- **`GET /api/store/all` filter semantics — OR-within-axis, AND-across-axis**: `categoryIds`/`tagIds` (comma-separated) each independently OR-match (`{ categories: { some: { categoryId: { in: categoryIds } } } }`), and the two axes are combined with `AND` — each axis clause is added to the `where.AND` array only when that axis has values. Apply this same semantic to any future taxonomy-filtered listing endpoint.
- **`lib/store/getStoreGeo.ts`** — `getStoreGeo(ids[])` returns `Record<id, {lat, lng, acceptingOrders}>` via raw SQL (`SELECT id, lat, lng, "acceptingOrders" FROM "Store" WHERE id IN (...)`), mirroring `getStoreSlugs`. Distance is computed server-side via `lib/geo/haversine.ts` `haversineKm()` when `addressLat`/`addressLng` query params are present; `distanceKm: null` (sorted last) when a store has no coordinates.
- **`/app/discover` gate doctrine (DOC-7, locked)** — no address on file → `NoAddressGate` blocks the entire discovery view (map AND list). There is **no unsorted/no-distance fallback view**. Once an address exists, `DiscoveryView` renders for both map and list, with distance shown as "Distance unknown" per-store when that store lacks coordinates (this is a per-store display fallback, not a substitute for the gate).
- **`components/store/DiscoveryView.tsx` is a reusable, prop-driven component** (`addresses`, `initialAddressId`) — owns address selection, taxonomy filter pills, map/list toggle, and the single shared `/api/store/all` fetch. `/app/discover/page.tsx` is a thin wrapper that owns only the gate + address bootstrap. Do not weld discovery logic to `/app/discover` — a future store-owner-side surface is expected to reuse `DiscoveryView` with different props.
- **`/app/saved` also uses `DiscoveryFilterModal` (DISCOVER-INLINE-1b)** — the wishlist/saved-products page surfaces the same filter modal for filtering Browse-tab results. State lives in `activeFilters: DiscoveryFilters` in `app/app/saved/page.tsx`; `GET /api/store/all` is called with those filter params when Browse is active. `FilterPill` (shared atom, `components/store/FilterPill.tsx`) renders category/tag chips in both the modal body and the Browse tab header. The filter button reads from `activeFilters` to show "{n} filters active" when any filter is set.
- **`GET /api/store/all?includeFleet=1` opts Fleet-backed stores back into the listing (FLEET-DISCOVER-1)** — by default the route still excludes every `pageType === "fleet"` Store (FLEET-ORDER-1, unchanged: `/app/discover`'s map omits this param and stays fleet-free, since a fleet has no customer-orderable products to plot). `/app/saved` Browse → Stores is the one caller that passes `includeFleet=1` (both the plain and filtered fetches in `app/app/saved/page.tsx`). Every store row in the response now also carries `pageId` and `isFleet: boolean` (`isFleet = pageId != null && fleetPageIds.has(pageId)`) so the client can route correctly. `renderStoreCard` in `app/app/saved/page.tsx` checks `store.isFleet` and (a) shows a 🚛 amber placeholder + "Fleet" pill instead of the generic 🏪 card, (b) links to `/fleet/{pageId}` with a "Book →" label instead of `/store/{slug}` with "Visit →", and (c) hides the Pin button (pinning would persist a link back to the dead `/store/[id]` page). **Never link a fleet card to `/store/[id]`/`/store/{slug}`** — that page deliberately hides all `serviceType: "delivery"` blocks (see the dedicated footgun below), so it renders as an empty store for a fleet venture.

### Product Search (PRODSEARCH-1b)
Item-level full-text search across all stores via `GET /api/store/product-search`.

**`StoreBlock.storeId` denormalization** — `Block.storeId TEXT` nullable FK added via migration `20260622000000_add_block_storeid_search`. Backfilled from `section → store` chain at migration time (53/53 rows). Written by all three block-creation paths: `POST /api/block`, `POST /api/store/ai-setup/apply`, `POST /api/store/parse-menu/apply`. Subsection-only blocks (learning module) keep `storeId = null` — intentionally excluded from product search. This is a query shortcut; the canonical hierarchy is still `StoreBlock → StoreSection → Store`.

**`Block.search_vector` tsvector index** — `GENERATED ALWAYS AS (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))) STORED`, GIN-indexed (`Block_search_vector_idx`), same migration. Query: `search_vector @@ websearch_to_tsquery('english', q)`. No manual update needed — Postgres auto-maintains the generated column.

**`GET /api/store/product-search`** — auth-gated; filters: `serviceType='product'`, `visibility='public'`, `price IS NOT NULL`, `storeId IS NOT NULL`, store not deleted, own stores excluded. Params: `q`, `addressLat`/`addressLng` (enables haversine sort), `categoryIds` (comma-separated, category proxy via `StoreCategoryLink`), `limit`, `offset`. Response: `{ products: [{ blockId, title, description, price, mediaUrl, storeId, storeName, storeSlug, distanceKm }] }`. Uses `DISTINCT ON (b.id)` to prevent join fan-out.

**Category proxy doctrine** — `categoryIds` filters stores that carry those categories via `StoreCategoryLink`, then returns matching blocks within those stores. There is no per-block `BlockCategoryLink` table. This is coarse but avoids per-product tag management. **Apply this same proxy pattern to any future block-level category filter** that doesn't justify adding a join table. See TECH_DEBT.md §15 for the known coarseness trade-off.

**UI (`/app/saved`)** — Browse section now has a "Stores / Products" tab toggle (using `FilterPill` pill atoms). Products tab: search input + category filter button (reusing `DiscoveryFilterModal` `activeFilters`) + 2-column product card grid (image, title, price, store name → `/store/{storeSlug|storeId}`, distance badge). New i18n slugs: `app-search-stores-tab`, `app-search-products-tab`, `app-search-products-placeholder`, `app-search-products-no-results`, `app-search-products-heading`. Seeded by `prisma/seed-prodsearch-ui.js`.

### Store Soft-Delete (Whole-Venture Delete)
Owners can close a store from `/store/account`. This is a **soft delete** — `Store.deletedAt` and the linked `Page.deletedAt` (both `DateTime?`, added via `db push`, no migration file — same precedent as the `Order.deliveryStatus`/`assignedToId` fields) are stamped; nothing is removed from the DB. Full design + verification details: `docs/modules/store-deletion.md`.

- **Core logic**: `lib/store/softDeleteStore(storeId, ownerId)` — single entry point used by both `DELETE /api/store/my-stores` and `DELETE /api/user/pages`. **Open-order definition (STOREDEL-FIX-1)**: an `Order` row (including sub-orders, via `parentOrderId`) is "open" if EITHER (a) `status` is non-terminal (`["pending", "confirmed", "shipped"]`), OR (b) `status` is terminal (`delivered`/`cancelled`) but `deliveryStatus` is actively mid-delivery (`["confirmed", "processing", "out_for_delivery"]`). `deliveryStatus = "pending"` on a terminal-status order is NOT open — delivery was simply never initiated. Open orders block the delete with `409 { error: "open_orders", message, blockingOrders: [{ id, reason }] }`. Nothing is written when blocked.
- **On success** (single `prisma.$transaction`): sets both `deletedAt` flags, then ends every `accepted` `Collaboration` touching the page by flipping `status → "cancelled"` — **the existing terminal/ended state, reused** (not a new field) — and fires a fire-and-forget `collaboration_ended` notification ("Store \"{name}\" has closed; your role there has ended.") to the other side of each.
- **Zero destructive deletes** — `Order`, `Quote`, `OrderStepProgress`, `Collaboration` rows are never removed by this flow, only flags flip.
- **Action guards (409)** — a flag alone doesn't stop zombie writes. Order placement (`POST /api/store/orders`, `/api/store/orders/quick`) now checks `Store.deletedAt` in the existing raw-SQL status query and returns the existing `422 { error: "This store is no longer accepting orders." }` shape (reuses the `acceptingOrders` contract). Five collaborator-action routes — delivery PATCH, step confirm, step fail, quote respond, quote accept — each fetch `order.store.deletedAt` and reject with `409 { error: "This store has been deleted — no further actions are possible." }` before mutating anything. Mirror this pattern for any new collaborator-action route.
- **Listing filters (`deletedAt: null`)** applied to: fleet page (404 for non-owner), wishlist, pinned stores, collaboration receiver resolution, course routes, health-expert/health-business-suggestion routes; `earn/initiative/[pageId]` redirects the owner to `/store/account` for a deleted venture; `GET /api/store/[id]` 404s for non-owners and PATCH rejects edits with `409` ("restore it before making changes").
- **Deliberate exceptions — do NOT filter these**: `/api/store/my-stores` (owner sees deleted stores greyed out with Restore); `/api/store/orders?all=true` (historic orders stay visible; `store.deleted: boolean` flag renders a grey "Store closed" badge on `/store/orders/all`); owner CRUD routes reject rather than hide; collaborator dashboards need no filter — ended collabs (`status="cancelled"`) drop out naturally.
- **Restore**: `PATCH /api/store/[id]/restore` — owner-gated; re-checks slug uniqueness (mints a fresh one if claimed by another live store while this one was deleted, returns `{ slug, slugChanged }`) and clears both `deletedAt` flags in a transaction. **Collaboration re-activation is explicitly OUT OF SCOPE** — ended collaborations stay `"cancelled"`; the owner must manually re-invite partners. This is a documented gap, not an oversight (re-establishing a partnership needs the other party's consent).
- **UI**: `/store/account` store cards branch on `deletedAt` — active stores show Visit/Manage/Delete; deleted stores are greyed (`opacity: 0.6`) with a red "Deleted" pill and a single Restore action plus inline status messages.
- **Verification**: `scripts/test-store-softdelete.ts` (`ALLOW_TEST_BYPASS=true npx ts-node --project tsconfig.scripts.json scripts/test-store-softdelete.ts`) — 21/21 checks across all 7 scenarios (open-order/sub-order blocking, successful delete + collaboration-ended + notification, forbidden/not-found, order-placement guard, all five zombie-action 409s, listing filters, store/[id] visibility, restore + slug recheck + Collaboration-gap confirmation).

### Store Order Pages
- `/store/account?tab=stores` — owner order dashboard; "All Orders" pill aggregates across all stores; "View all →" goes to `/store/orders/all`
- `/store/orders/all` — **read-only cross-store monitor** (CONFIRM-PARITY-FIX-1 — page A in the audit/fix series): full view of all orders across every store the user owns; auto-refreshes via SSE stream when partner or employee activity occurs (10 s polling fallback); manual refresh button in header; pending-count and requiresAttention count badges in sticky header; "Track partner →" button when `vehicleId` is set and `deliveryStatus = "out_for_delivery"`; shows active step chip (grey, links into `/store/[id]/orders`) + requiresAttention red dot per order. **`deliveryStatus` renders as a plain read-only badge — no click-to-advance** (the old clickable stepper force-dispatched normal workflow steps as deliveries; removed). The legacy "Assigned to" dropdown shows only when the order has a genuine legacy delivery assignment (`assignedToId`/`assignedToUserId` set); orders driven by a normal active workflow step instead show a read-only "Assigned via workflow" card sourced from `activeStep.assigneeName` with a "Manage on store page →" link into `/store/[id]/orders`. Cancel remains the only mutating control directly on this page. **`/store/[id]/orders` (page B) is the one true confirm/workflow surface — A only monitors and funnels there.**
- `/store/[storeSlug]/orders` — per-store active orders. Each order card shows:
  - **Delivery status bar** (read-only pipeline display) — the 5-step stepper is display-only; **only Cancel remains clickable**. Assignment dropdown and delivery note still functional for manual override.
  - **Self-delivery**: "Deliver myself" button on each order card sets `assignedToId = null` and advances `deliveryStatus` directly, bypassing partner assignment.
  - **WorkflowSection** — shown for every order in one of four states: (A) no initiative linked: "No workflow set up" + link to initiative; (B) order pending: "Confirm the order to activate"; (C) active step: full **numbered STEPS list** (OWNER-STEPVIEW-1, replaces the old single "current step" chip) + per-step controls; (D) partnerStatus="rejected": reassign dropdown + Retry Step button.
    - **Numbered STEPS list (OWNER-STEPVIEW-1)** — state C now renders every `WorkflowStep` for the order as `1. Name → Assignee  [State]`, sourced entirely from `allSteps`/`activeStep` (already fetched for this page — no new query). State label (`Done ✓` / `Active — your turn` / `Waiting on step N` / `Failed — needs attention`) is derived honestly from each step's `OSP.status`, never guessed. **Assignee name is resolved server-side in `GET /api/store/orders?storeId=X` via `stepAssigneeName()`** (see below) — normal steps read `OSP.currentAssigneeId → WorkflowStepAssignee → Collaboration`, delivery steps read the real dispatched `Order.assignedToId`/`assignedToUserId` (only once OSP status leaves `"pending"`). **Never reads legacy `Order.assignedToId` for normal-step display** — that field is delivery-only (see `### Known Footguns`). Inline controls on the active row only: "Mark Complete ✓" / "Confirm Dispatch 🚚" / "⚡ Complete All" call the existing `PATCH /api/order/[id]/step/[stepId]/confirm` (no new endpoint). **Reassign** for delivery steps reuses the existing per-order override (`onAssignDelivery` → `PATCH /api/order/[id]/delivery { assignedToId | userId }`) inside a `<details>` disclosure — same mechanism as the legacy "ASSIGN DELIVERY" dropdown, never writes to the `WorkflowStep` template. **Documented gap**: there is no per-order override for *normal*-step reassignment — only the template-level Workflow tab editor exists (which would change the assignee for all future orders, violating "never write to the template from an order screen"). The UI surfaces this honestly with an italic note rather than inventing new infrastructure; building a real per-order override is a future prompt.
- `/store/[storeSlug]/orders/delivered` — read-only archive of delivered orders for one store; "← Active Orders" back link

**`GET /api/store/orders?storeId=X` response** enrichment per order: `activeStep { stepId, stepName, assigneeName, quoteRequired }`, `allSteps [{ stepId, stepName, sequence, quoteRequired, ospStatus, activityType, assigneeName }]`, `quotes [{ id, stepId, partyName, amount, status }]` sorted by amount asc, `requiresAttention Boolean`, `subOrders [{ id, subOrderType, agreedAmount, userId }]`, `initiativeId` (= store.pageId). **`assigneeName` on both `activeStep` and every `allSteps` row is resolved by `stepAssigneeName()`** — branches on `WorkflowStep.activityType`: `"normal"` → `OSP.currentAssigneeId → WorkflowStepAssignee → Collaboration` (mirrors the `partyName()` "Unknown" fallback for orphaned references); `"delivery"` → real dispatched `Order.assignedToId`/`assignedToUserId` once `OSP.status !== "pending"`, else `null` ("Not yet dispatched" — honest, not "Unassigned").

### Mobile Orders Page (`/app/orders`)
Client component in the mobile shell. **Five** internal tabs (initial tab set by `?tab=` URL param — notification links use this):
- **My Orders** — fetches `GET /api/store/orders` (buyer view, no params); filters to orders where `parentOrderId === null` (regular purchases only — assignment sub-orders are excluded). Shows store name, items summary, status badge; "Track 📍" button appears when `deliveryStatus === "out_for_delivery"`. **Auto-refreshes via SSE stream** (`/api/notifications/stream`) — buyer orders re-fetch on any notification event; reconnects after error (10 s delay) and on `visibilitychange`.
- **Store Orders** — two sections: (1) **Assignments** — sub-orders from `buyerOrders` where `parentOrderId != null` (delivery/service tasks assigned to this user via the workflow system); shows "Assignment" pill, `subOrderType` chip, agreed fee, and "Deliver 🚚" / "Parent →" links. (2) **Seller orders** — fetches `GET /api/store/orders?all=true`; each card links to `/store/[slug]/orders`; "Manage all orders →" shortcut. Both sub-sections are rendered inside the same Store Orders tab.
- **Requests** — fetches `GET /api/orders/requests`; shows Quote rows where the current user's collaborations are the `requestedPartyId`. Cards show order ref, step name, items summary, time-remaining countdown, and a quote submission UI: pending=amount input+submit, submitted=quote+edit, accepted=green badge+"View Assignment →", rejected=grey "Not selected". Badge on tab shows count of pending+submitted quotes.
- **Tasks** (TASK-SURFACE-1) — fetches `GET /api/orders/tasks`; lists active `OrderStepProgress` rows (normal steps only, `activityType: "normal"`) where the current user resolves as the assignee. Each `TaskCard` shows order ref, step name, **correct store name** (joined off `Order.store`, not `receiverPage`), items summary, total, and a single "Confirm completed ✓" button that PATCHes the existing `/api/order/[id]/step/[stepId]/confirm` endpoint — the same one the owner uses. No new model: the active OSP row **is** the task record (see `### Process Tasks surface` in `docs/START_HERE.md` for the model-choice rationale). Badge on tab shows pending-task count. The `order_assigned` notification fired by `assignNormalStep` links here (`?tab=tasks`), not to `?tab=my`.
- **Tracking** — filters regular buyer orders (`parentOrderId === null`) where `deliveryStatus === "out_for_delivery"`; assignment sub-orders are excluded (the user is the deliverer, not the recipient); each renders `TransportMap` (dynamic import, ssr:false) polling `GET /api/transport/vehicles?id={vehicleId}` every 5 s; badge on tab shows count of active tracking orders

### Buy Now / Quick Order UX
- "Buy Now" button on product cards opens `QuickOrderModal` (ephemeral React state — never touches cart)
- "Add to Cart" button flashes green "✓ Added" for 2 seconds on successful add
- `QuickOrderModal` steps: Items review (with inline qty stepper) → Delivery address → Invoice profile (optional, from billing profiles) → Confirmation
- Managed in `components/store/QuickOrderModal.tsx`
- Also available on the **Saved Products** page (`/app/saved`) — wishlist items have a "Buy Now" button that opens `QuickOrderModal` directly
- **Guest checkout** — guest users (`status: "guest"`) can complete the full checkout flow without registering. The order is created under the guest `User.id` and transferred to the real account automatically on login or email verification via `mergeGuestToReal`.

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
- **Active initiative types**: `store`, `service`, `fleet` (controlled by `ACTIVE_INITIATIVE_TYPES` at `app/app/initiatives/page.tsx:54`). Coming-soon types (`health`, `learning`, `helping`, `community_group`) are built and gated — add the key to that array to re-enable with no other changes needed.
- **Server component** — auth via `cookies()` from `next/headers` + `verifySessionToken()` from `lib/session.ts`. Does NOT use `getServerUser(req)` (that requires a Request object for API routes). Redirects to `/earn` if unauthenticated or not the page owner.
- **Data fetched server-side**: Page (with `healthBusiness` only — `collaborationsIn`/`collaborationsOut`/`course`/`helpingInitiative` were removed; collab data is loaded client-side by `InitiativeTabs`), linked Store, all pages owned by the user (`ownerPages`)
- **Client shell**: `components/earn/InitiativeTabs.tsx` — manages `activeTab` state; fetches `GET /api/initiative/[pageId]/team` on mount to derive `canEdit` (founder/co_founder → true; null → true for owner; others → false); renders Overview / Store / Team / Partners / Workflow
- **Team tab**: `components/earn/TeamTab.tsx` — lists team-scope Collaborations; "Invite Member" promotes a partner-scope Collab to team via `PATCH /api/initiative/[pageId]/team/[collaborationId]`; role tags: Founder, Co-founder, CEO, Partner, Employee, Custom
- **Partners tab**: `components/earn/PartnersTab.tsx` — active partners, incoming requests, invite form with store-name autocomplete
- **Workflow tab**: `components/earn/WorkflowTab.tsx` — sortable step list (dnd-kit); each step: inline-editable name, assignee dropdown (ALL accepted collabs for the page, any scope), quote-required toggle, timeout hours; "Add Step" / "Confirm Step" / drag-to-reorder. **canEdit** prop gates all edit controls — read-only for non-founder/co_founder team members.

### Delivery Tracking

The `Order` model has five delivery scalar fields (added via `db push`, no migration file):

| Field | Type | Default | Purpose |
|---|---|---|---|
| `deliveryStatus` | `String` | `"pending"` | Delivery pipeline: `pending → confirmed → processing → out_for_delivery → delivered` (or `cancelled` at any point) |
| `assignedToId` | `String?` | `null` | `Collaboration.id` of the partner assigned to deliver — **not a FK**, stored as a plain string. Mutually exclusive with `assignedToUserId`. |
| `assignedToUserId` | `String?` | `null` | `User.id` of a team member directly assigned for delivery (user-type assignment, no collab ID). Mutually exclusive with `assignedToId`. |
| `deliveryNote` | `String?` | `null` | Free-text instructions from owner to delivery person |
| `vehicleId` | `String?` | `null` | `Vehicle.id` of the partner's active GPS broadcast — set automatically when the delivery person clicks "Start GPS"; cleared to null when unlinked |
| `partnerStatus` | `String?` | `null` | Partner acceptance state: `null` = unassigned, `"assigned"` = owner assigned (awaiting acceptance), `"accepted"` = accepted, `"rejected"` = declined (owner must reassign), `"completed"` = delivered |

**Two assignment paths for delivery:**
- **Partner page (collab-based)**: `PATCH { assignedToId: collabId }` — sets `assignedToId`, clears `assignedToUserId`. Auth: `partnerPage.ownerId === session.userId` grants delivery access.
- **Team member (user-based)**: `PATCH { userId }` — sets `assignedToUserId`, clears `assignedToId`. Validated: the target user must have an accepted `scope=team` Collaboration with `receiverUserId = userId` for this store's initiative page. Both paths set `partnerStatus = "assigned"`.

**GPS flow is identical for both assignment types.** The employee/partner accepts → `partnerStatus = "accepted"` → GPS button appears in `/earn/deliveries` → Broadcaster creates a `Vehicle` row → `PATCH { vehicleId }` links it to the order. For user-assigned employees (`isDirectEmployee`), setting `vehicleId` **automatically advances `deliveryStatus` to `"out_for_delivery"`** (if the current status is pending/confirmed/processing) so the customer's tracking map activates. Collab partners get `out_for_delivery` via the workflow OSP confirm instead. Both paths fire an `out_for_delivery` buyer notification.

**`PATCH /api/order/[id]/delivery` — authorization gate (three principals)**
1. **Store owner** (`store.ownerId === userId`): all fields — `deliveryStatus`, `assignedToId`, `userId`, `deliveryNote`, `vehicleId`, all `partnerAction` values.
2. **Collab partner** (`assignedToId` Collaboration's `partnerPage.ownerId === userId`): `partnerAction: "accept" | "reject" | "complete"`, `deliveryStatus`, `vehicleId`. Reject triggers next-partner cycling via `assignNextPartner`.
3. **Direct employee** (`assignedToUserId === userId`): same as collab partner. Reject clears `assignedToUserId` and sets `requiresAttention = true`.
- Buyer: no PATCH access.

**`GET /api/order/[id]/delivery`**
- Allowed for: store owner, assigned collab partner, directly assigned user (`assignedToUserId`), or the order's buyer.
- Returns: `id, deliveryStatus, partnerStatus, assignedToId, assignedToUserId, deliveryNote, vehicleId, items, total, createdAt, address, pickupConfirmedAt` + `assignedCollab` (has `receiverPage` field, not `receiver`; null for user-assigned orders).

**`Order.pickupConfirmedAt` (PICKUP-CONFIRM-1)** — `DateTime?`, added via raw SQL `ALTER TABLE` (not `db push` — db push's diff would have dropped the unrelated `Block.search_vector` generated column, which isn't modeled in `schema.prisma`; same caution applies to any future field add while that drift exists). Read/written via `prisma.$queryRaw`/`$executeRaw` until a full `prisma generate` runs (stale-client pattern, same as the other delivery scalar fields). Set by `PATCH /api/order/[id]/delivery { partnerAction: "picked_up" }` — explicit manual milestone tapped by the delivery person at the pickup point. **Deliberately never inferred from `deliveryStatus`/`vehicleId`** — GPS broadcast can legitimately start before the partner physically reaches the pickup point (so the customer can watch them approach), so treating "GPS started" as "picked up" would point Navigate at the customer too early. Reset to `null` on every reassignment path (`assignNextPartner`, owner manual `assignedToId`/`userId` PATCH, `assign_block`, `self_assign`, and all partner-reject branches) — a newly assigned partner hasn't picked up yet regardless of what the prior assignee did.

**Owner order management UI** (`app/store/[id]/orders/page.tsx`):
- **"ASSIGN DELIVERY" section** (visible when order is `confirmed` and partners or team members exist) — grouped `<select>` with `<optgroup>` for "Partner Businesses" (collab-based) and "Team Members" (direct user assignments). Submits `PATCH { assignedToId }` or `PATCH { userId }` based on selection.
- WorkflowSection renders in 4 states: (A) no initiative, (B) pending order, (C) active step with Confirm/Quote controls, (D) rejection panel.

**Partner/employee delivery dashboard** (`app/earn/deliveries/page.tsx`):
- Server component with cookie auth.
- Finds orders via three paths: (1) `assignedToId IN (collabIds)` — collab partner assignments; (2) LATERAL join on items JSON — block-employee assignments; (3) `assignedToUserId = userId` — direct personal assignments.
- Direct-assignment orders carry `isPersonal: true` → `DeliveriesClient` shows a purple "Assigned to you personally" badge.
- Renders `DeliveriesClient` (`components/earn/DeliveriesClient.tsx`) — cards differ by `partnerStatus`: amber Accept/Reject UI for `"assigned"`, green GPS + **Confirm Delivery** UI for `"accepted"`. GPS start modal auto-fills the partner's name and phone from their user profile.
- Every card (both states) shows a **PICK UP FROM** section above the delivery address: store name, owner's default `Address` row as a pickup location proxy (lat/lng or text-search fallback → Google Maps), and a `tel:` link to the owner's phone. Shows "Contact store owner for pickup location" if the owner has no default address. This is a temporary proxy — see TODO comment in `DeliveriesClient.tsx`; replace with `Store.address` once that field is added to the schema.
- **Navigate links are phase-aware (PICKUP-CONFIRM-1)** and use the Maps **directions** URL (`https://www.google.com/maps/dir/?api=1&destination={lat},{lng}&travelmode=driving`, `navLink()` helper in `DeliveriesClient.tsx`) — **origin is deliberately omitted** so Maps always routes from the device's live GPS, never a stale baked-in starting point. Before `pickupConfirmedAt` is set: the PICK UP FROM section shows "🗺️ Navigate to pickup", and the accepted-state action area shows the same pickup link plus a **"📦 Mark picked up"** button (`PATCH { partnerAction: "picked_up" }`). After pickup is confirmed: the PICK UP FROM section shows a static "📦 Picked up ✓" badge (no more link — no longer relevant), and the action area shows **"🗺️ Navigate to customer"** targeting the delivery address instead. Re-clicking either link later always reflects the current phase off live DB state — never a link baked in at GPS-start time, which is what made the old single static link replay the wrong route after the partner had already moved on.
- Delivery address lat/lng (`addrLat`, `addrLng`) and pickup address fields (`pickupLine1/City/State/Pincode/Lat/Lng`) are fetched in all three raw SQL queries in `page.tsx` — collab-assigned, block-assigned, and self-assigned — via `a.lat/lng` and a `LEFT JOIN "User" ou ... LEFT JOIN "Address" pa ON pa."userId" = ou.id AND pa."isDefault" = true`.
- **Confirm Delivery** flow: (1) `PATCH /api/order/[id]/step/[activeStepId]/confirm` → advances workflow; (2) `PATCH /api/order/[id]/delivery { partnerAction: "complete" }` → sets `partnerStatus = "completed"`, clears `vehicleId`; (3) deletes vehicle row; (4) shows "Delivery complete ✅" state for 2.5 s then removes card. Customer then sees "Confirm you received this order?" prompt on the tracking page.

**Customer tracking page** (`app/order/[id]/track/page.tsx`):
- Client component; fetches `GET /api/order/[id]/delivery` (buyer is allowed). Also polls every 5 s to detect `partnerStatus` changes.
- Read-only stepper + partner name + delivery note + order summary.
- When `deliveryStatus === "out_for_delivery"` AND `Order.vehicleId` is set: polls `GET /api/transport/vehicles?id={vehicleId}` every 5 s, shows that exact vehicle on `TransportMap`. If `vehicleId` is null, shows "Delivery partner hasn't started GPS yet." instead of the map.
- When `partnerStatus === "completed"` (partner confirmed delivery): shows "Confirm you received this order?" prompt. On click → `POST /api/order/[id]/customer-confirm` → `deliveryStatus = "delivered"`, `partnerStatus = "completed"`. Shows thank-you state afterward.

### Collaboration / Partners
Partnership system. The requester is always a `Page`; the receiver is either a `Page` (page-to-page) or a `User` (page-to-user). The `Collaboration` model links a requesting Page to a receiving Page or User with a role and status.

- **Collaboration supports two member types:**
  - **Page-to-page**: `receiverPageId` set (delivery partners, suppliers, external collaborators)
  - **Page-to-user**: `receiverUserId` set (employees, personal team members)
  - Both use the same `scope`/`teamRole`/`status` fields. Exactly one of `receiverPageId` or `receiverUserId` must be set — enforced at API level, not DB level.
- **Model**: `Collaboration` — `requesterId` (Page), `receiverPageId` (Page, optional), `receiverUserId` (User, optional), `role` (string enum: `delivery_partner | supplier | employee | marketing | other`), `status` (`pending | accepted | rejected | cancelled`), optional `message` and `metadata`. Unique on `[requesterId, receiverPageId, role]` and `[requesterId, receiverUserId, role]`. All FK sides cascade-delete.
- **`Page` model** has `collaborationsOut` (`@relation("CollabRequester")`) and `collaborationsIn` (`@relation("CollabReceiver")`); **`User` model** has `receivedCollaborations` (`@relation("CollabReceiverUser")`)
- **Auth**: requester ownership checked on POST (requester page must be owned by session user); receiver ownership checked for accept/reject; requester ownership for cancel; either side for DELETE.
- **Receiver resolution**: `POST /api/collaboration` accepts a Store ID, store slug, Page ID, or User ID as `receiverId` — it resolves store → its linked `pageId` automatically for page-to-page collabs. Returns 404 if no Page or User can be found.
- **PATCH must include page relations**: `prisma.collaboration.update` must include `requester`/`receiverPage` in the response or the frontend will crash reading `.title` off `undefined`.

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

### Menu Parse Feature
Two-route API that creates a complete store from a restaurant menu photo.

#### `POST /api/store/parse-menu` (multipart/form-data)
Accepts **1–6** `image` parts (`formData.getAll("image")`, capped at 6) + `storeId: string`. Returns `{ parsed, flags, lowConfidenceItems }`.

**Multi-photo batching (MENU-MULTIPHOTO-1):** a menu is often several pages/boards, so the route accepts up to 6 photos. **The vision models are single-image** (`llama-3.2-11b-vision` silently ignores extra images in one content array), so each image runs the provider cascade **independently** via `extractOneImage(image)`, then results are merged. Extraction is **concurrency-capped at 3** (`Promise.allSettled` over chunks) so all 6 never hit NIM's 40 rpm limit at once. Per-image results are merged by `mergeMenuSections()` (`lib/store/mergeMenuSections.ts`) — sections combined by case-insensitive title (items concatenated), scalars take first non-empty. **isMenu gate is per-image**: a stray non-menu photo is skipped, not fatal; only if *none* qualify is the 400 returned. The Step-2 validator runs **once** on the merged structure. **Client downscales before upload** (`downscaleImage()` in `app/store/[id]/setup/page.tsx` — canvas, 1600px longest edge, JPEG 0.8) so 6 photos stay well under the Vercel ~4.5 MB serverless request-body cap; already-small images (≤1600px and ≤1.5 MB) pass through untouched.

**Two-step LLM chain (NVIDIA-VISION-WIRE-1 — NIM now primary):**
1. **Extractor** (per image, `extractOneImage`) — three-tier priority:
   - **NIM (primary, if `NVIDIA_KEY` is set)**: uploads image to Cloudinary (`folder: menu-parse-temp`, `resource_type: image`) to get a public URL, then calls `https://integrate.api.nvidia.com/v1/chat/completions` with `model: meta/llama-3.2-11b-vision-instruct`, `response_format: { type: "json_object" }`, image as `image_url.url` (NOT base64 — URL avoids large payloads and gives 2.5–5.4 s latency). **Timeout: 30 s**. `nemotron-3-nano-omni` was tested and rejected — silent vision failure (returns text, not image data). If NIM fails, falls back to OpenRouter.
   - **OpenRouter (fallback A, if `OPENROUTER_API_KEY` is set)**: `model: MENU_VISION_MODEL ?? "google/gemini-2.5-flash-lite"`, image as base64 `image_url` data URI. **Timeout: 60 s**.
   - **Ollama llava (fallback B)**: `MENU_VISION_FALLBACK_MODEL ?? "llava:7b"`, 120 s timeout, `keep_alive: "10m"`. Only used when neither cloud key is configured.
   - Returns raw JSON matching `{ isMenu: boolean, confidence: number, storeName, sections[{ title, items[{ title, description, price, searchQuery }] }], phone, address, hours }`.
   - **isMenu gate** (all paths): after Step 1, if `isMenu === false` OR `confidence < 0.4` → return 400 `{ error: "This doesn't look like a menu. Please upload a photo of your menu or price list." }`. Step 2 is NOT called for non-menu images.
2. **Validator** — calls `chatComplete()` with `MENU_VALIDATOR_MODEL ?? "anthropic/claude-haiku-4-5"`. Adds `confidence` (0–1) per item and a `flags` array. Items with confidence < 0.5 are surfaced in `lowConfidenceItems` but are **not removed** — the caller decides. Unchanged from LOCAL-AI-FIX-1.

Requires env vars: `NVIDIA_KEY` (NIM primary), `OPENROUTER_API_KEY` (OpenRouter fallback + Step 2 validator), `CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`/`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (Cloudinary upload for NIM path). `OLLAMA_BASE_URL` only needed for the local llava fallback.

**Cloudinary temp cleanup (NVIDIA-VISION-WIRE-1c, per-image since MENU-MULTIPHOTO-1):** each NIM upload to `menu-parse-temp/` is now cleaned up **inside `extractOneImage`'s own `finally`** (one publicId per image) — fire-and-forget `cloudinary.uploader.destroy()`, covering NIM success, NIM failure→fallback, and any throw. The old centralized `publicIds[]`/outer-`finally` cleanup was removed; cleanup is local to each per-image cascade. Failures are logged as `[parse-menu] Cloudinary cleanup failed` but never propagate.

**Why NIM vision (2026-06-14 → NVIDIA-VISION-WIRE-1):** `meta/llama-3.2-11b-vision-instruct` on NVIDIA NIM delivers 2.5–5.4 s end-to-end. Image must be passed as an HTTP URL — the Cloudinary upload step adds ~1 s but avoids the large base64 JSON payload that made OpenRouter slow. The NIM path uses a single clean JSON response via `response_format: json_object` with no markdown stripping. OpenRouter Gemini Flash-Lite remains the fallback if `NVIDIA_KEY` is not set. **NVIDIA NIM 40 rpm rate limit applies** — this route is single-user interactive (one image upload per session), well within the limit.

#### `POST /api/store/warm-vision` (auth-guarded)
**No-op since LOCAL-AI-FIX-1** — vision extraction runs on cloud, so there is no local model to pre-warm. Returns `{ warming: false }` immediately. Kept as an endpoint only because the client still fire-and-forgets a POST to it on upload-start.

**Client trigger**: `app/store/[id]/setup/page.tsx` fires a fire-and-forget POST to this endpoint the first time the user clicks the upload button ("Upload menu photos" / "Add another photo"), guarded by a `warmupFiredRef`. Now inert — left in place to avoid an unnecessary client change.

#### `POST /api/store/parse-menu/apply` (JSON)
Accepts `{ storeId, parsed: { sections } }`. Resolves images, builds sections + blocks in a Prisma transaction, returns `{ success, sectionCount, blockCount }`.

- Images are resolved via `lib/imageCache.ts` `resolveImage()` — items 0 and 1 are prioritised (resolved before the rest), remaining items in batches of 5 via `Promise.all`.
- **Unsplash rationing (MENU-IMG-RATION-1):** `UNSPLASH_PER_BUILD = 10` — only the first 10 items (by menu order) may use Unsplash; the rest pass `allowUnsplash: false` so they resolve to free providers (Pexels/Pixabay/Picsum). This is a **per-build** cap (one store generation), not a persistent per-user quota — for the normal one-store-per-user flow it's effectively the same; switch to a Redis rolling counter only if users build many stores. **Cache hits cost zero provider calls**, so the cap only governs fresh fetches. `resolveImageFresh` (cron upgrade) and `ai-setup` banners are unaffected — they keep full Unsplash access (default `allowUnsplash: true`).
- Block creation sets `mediaUrl`, `imageProvider`, `imageQuality` (new fields on `StoreBlock`).
- Layout auto-derives from item count: `"1"` (1 item) → 1 column, `"1-1"` → 2, `"1-1-1"` → 3+.
- Does **not** call `/api/store/ai-setup/apply` via HTTP — replicates the Prisma transaction directly so the new image fields can be written in the same call.

#### ImageCache model (`prisma/schema.prisma`)
Deduplicates image provider calls. Keyed by **normalised query** (lowercase, alphanumeric + spaces only). Fields: `id`, `query (unique)`, `imageUrl`, `provider`, `quality (0–3)`, `usageCount`, `createdAt`, `lastUsedAt`. Quality scale: unsplash=3, pexels=2, pixabay=1, picsum=0.

`lib/imageCache.ts` exports:
- `resolveImage(query)` — check cache first; fetch + save on miss.
- `resolveImageFresh(query)` — always fetches from providers (used by cron upgrade). Updates cache.

Provider detection is URL-based (pattern match on response URL) since `lib/imageSearch.ts` returns only the URL string.

#### Cron: `GET /api/cron/upgrade-images`
Vercel cron runs daily at 02:00 UTC (`vercel.json`). Requires `Authorization: Bearer ${CRON_SECRET}`.

Finds up to 20 `StoreBlock` rows where `imageQuality < 2` AND `imageProvider != 'user'`, ordered by the owning store's `createdAt DESC`. For each block, looks up the original query via `ImageCache.imageUrl` match, calls `resolveImageFresh`, and updates the block only if `newQuality > currentQuality`. Hard-stops when Unsplash API calls in this run reach 15 (well within the 50/hour free tier). Returns `{ upgraded, skipped }`.

#### New env vars
- `MENU_VALIDATOR_MODEL` — optional; overrides the model string passed to `chatComplete()` for the Step 2 validator (default `"anthropic/claude-haiku-4-5"`). Note: `chatComplete()` routes through `OPENROUTER_API_KEY` and uses `OPENROUTER_MODEL` for the actual API call — this env var documents intent and is available for when `chatCompleteInternal` is updated to respect the caller's model param.
- `CRON_SECRET` — required to authenticate the upgrade-images cron endpoint

### Charaivati AI Chatbot (floating guide widget)
A floating chat widget powered by `chatComplete()` in `app/api/aiClient.ts` — primary provider is local Ollama via Cloudflare tunnel (`https://ollama.charaivati.com`); fallback chain is OpenRouter → Groq → Vercel AI Gateway. Visible to logged-in users on every page.

- **Widget**: `components/chat/ChatBot.tsx` — bottom-right floating bubble; opens a 380×520 dark panel. Props: `isLoggedIn: boolean` (gates rendering), `currentSection?: string` (passed to the API for context; defaults to `"Self"`).
- **Shared pipeline (CONSULT-1a)**: `lib/ai/chatPipeline.ts` is the shared guarded AI-chat machinery — `/api/chat` (and future callers such as `/api/listen`) both import it; prompt assembly stays per-route. It owns auth resolution (`authenticateChat`), input guardrail scanning of message + attached document (`runInputGuard` → `scanInput` + `notifyAdmin` for BLOCK/WARN), the 30 s `withChatTimeout` wrapper, and the guarded completion (`runGuardedCompletion` → `chatCompleteWithMeta` + `scanOutput` + tier resolution + fallback catch). System-prompt assembly (companion branching, persona, context loading) and the profile-sync proposal step (`buildProfileProposal`/`tryProposeGoal`) stay in the route. Extraction was behavior-preserving — HTTP responses for normal/companion/WARN/BLOCK cases are byte-identical.
- **API route**: `POST /api/chat` — auth-gated (manual `getTokenFromRequest` + `verifySessionToken`, now via `authenticateChat` in the shared pipeline). Loads `Profile`, active `Page` records, and `UserCompanionProfile` server-side. Derives `energyScore` (0–100) from steps + sleep. Builds a layered system prompt, calls `chatCompleteWithMeta()`, returns `{ reply, tier, tierUI, source, coldStart, localExpected }`. Falls back to a canned message with `_fallback: true` if all providers fail. **System prompt order** (each block omitted when empty/inapplicable): (1) companion profile block — `arcStage > 0` only; (2) arc stage instruction from `getArcInstruction()` — `isCompanionSession` only; (3) `loadPlatformContext()` — `PLATFORM.txt` + `DRIVES.txt` + `RESPONSE_GUIDE.txt`, always; (4) `loadInitiativeContext()` — `INITIATIVES.txt`, always; (5) hardcoded user data (drives, goals, energy, initiatives); (6) `loadRawFile("COMPANION_PHILOSOPHY.txt")` — `isCompanionSession` only. `isCompanionSession` is derived server-side from `getArcInstruction()` in `lib/companion/arcStateMachine.ts` — true when `arcStage < 7`, nudge is due, or first session. Gated on companion profile existing with `arcStage > 0`.
- **Integration**: `ChatBot` is rendered directly in `app/layout.tsx` (root layout). The layout reads the session cookie server-side and passes `isLoggedIn` — no extra client fetch.
- **Conversation history**: stored in `useState` only — not persisted to DB. Cleared by the "Clear chat" button in the panel header.
- **Environment**: `CHAT_AI_MODEL` (default `llama3:8b`) — the `model` param passed to `chatComplete()`; used by OpenRouter/Groq/Vercel fallbacks. Ollama always uses `OLLAMA_MODEL` regardless. `LOCAL_AI_ENABLED=true` + `OLLAMA_BASE_URL` must be set for Ollama to be the primary provider.
- **Companion mode** — opens the widget **in place**, no navigation. "Companion mode" just means the AI spoke first: the widget opens with a seeded greeting already in the message list. Visual differences vs regular mode: header reads "Check-in with Charaivati" (title only — background and border are the same `gray-950`/`gray-800` as regular mode), input placeholder is "What's on your mind?". After each successful chat reply, fires a fire-and-forget `POST /api/companion/session { message }` (cookie auth) to update `UserCompanionProfile`.
- **Two identical entry points** — both produce companion mode + seeded greeting + nudge acknowledged: (1) **Red dot bubble tap**: when `nudgePendingRef.current` is true at click time, `openCompanion(true)` is called instead of `setOpen(true)`; (2) **Home page banner "Let's chat"**: dispatches `new Event("charaivati:open-companion")` on `window` → ChatBot listener calls `openCompanion(true)`. Both paths set `openedFromNudgeRef = true` which triggers the greeting seed effect.
- **Seeded waiting greeting** — when companion mode opens with `openedFromNudgeRef = true` AND `greetingSeededRef = false` AND messages is empty: injects one assistant message: `"Hey — got a few minutes to catch up? If now's not a good time, just close this and we'll talk again later."` Uses a functional `setMessages` updater so it checks live state (not stale closure). `greetingSeededRef` prevents re-injection on re-open or after clearing; `openedFromNudgeRef` prevents injection when companion mode was opened via URL param only.
- **Companion nudge red dot** — on mount, the widget fires `GET /api/companion/nudge` (read-only, no side effects) for non-guest logged-in users. If `nudgeDue: true`, a small red dot (`#ef4444`, 11×11px, `border: 2px solid #4f46e5`) appears top-right of the bubble. Acknowledge paths: (1) either entry point calls `openCompanion()` → `acknowledgeNudge()` fires `POST /api/companion/nudge`; (2) banner dismiss X → fires `new Event("charaivati:nudge-acknowledged")` → ChatBot listener calls `acknowledgeNudge()`. Double-fire prevented by `nudgeAcknowledgedRef`. POST handler is idempotent.
- **`GET /api/companion/nudge`** — **read-only**. Returns `{ nudgeDue: boolean, message: string | null }`. Does NOT advance `nudgeDueAt`. Safe to call on every page load. Called by both ChatBot (on mount) and `/app/home` (when `loadState` becomes `"returning"`).
- **`?mode=companion` URL param** — kept for backwards compat with bookmarked URLs. Calls `openCompanion(false)` (companion mode, no seeded greeting) since there is no confirmed pending nudge at bookmark-navigation time. There is no dedicated `/chat` page.
- **`POST /api/companion/nudge`** — **acknowledge**. Advances `nudgeDueAt` based on `energyState` (charged +2d, grounded +3d, stretched +4d, depleted +5d). Creates a bare `UserCompanionProfile` if none exists (uses grounded default). **Idempotent**: if `nudgeDueAt` is already in the future, returns `{ acknowledged: true, nextNudgeAt }` with no write.

### Document Reader (PDF/Word ingestion)
A generic text-extraction pipeline that lets the AI chat widget (and future modules) read uploaded files — manifestos, syllabi, menus, business plans, textbooks, etc. Full design: `docs/modules/document-reader.md`.

- **Files**: `lib/documents/parseDocument.ts` (`parseDocument({ buffer, filename, mimeType })` — dispatches to PDF/DOCX/TXT parsers), `lib/documents/ocrPages.ts` (`ocrPdfPages(buffer, pageNumbers)` — vision-model OCR for low-text pages), `POST /api/documents/parse` (the one generic endpoint, multipart/form-data).
- **Supported types**: PDF (`unpdf` — serverless pdfjs build, no native canvas deps), DOCX (`mammoth.extractRawText()`), TXT/MD (UTF-8). **No `.doc` (legacy binary Word) support** — users must save as `.docx`.
- **Limits**: 15MB max file size (413 if exceeded); rate limit 30 uploads/user/hour via `checkRateLimit()` (**permissive on Redis failure** — `lib/rateLimit.ts` returns `{ ok: true }` if Redis is unavailable or errors, so uploads are never blocked by a Redis outage); response `text` capped at 60,000 chars (`truncated: true` if cut).
- **OCR fallback**: any PDF page with < 20 extractable chars is flagged in `lowTextPages`. `ocrPdfPages()` renders up to `MAX_OCR_PAGES = 5` flagged pages to PNG (via `pdf-parse`'s `getScreenshot()`) and OCRs each with a vision model — **OpenRouter (`anthropic/claude-haiku-4-5`, env `DOC_OCR_FALLBACK_MODEL`) first (cloud, primary as of LOCAL-AI-FIX-1), falling back to local Ollama (`llava:7b`, env `DOC_OCR_VISION_MODEL`) only if `OPENROUTER_API_KEY` is not configured**. Since the primary path is cloud, **scanned page images leave the local machine by default** — be aware of this for sensitive documents. The local Ollama path is now the exception, kept so OCR still works in environments without an OpenRouter key. Extra scanned pages beyond the cap are reported in `warnings` but not OCR'd.
- **Chat integration**: `ChatBot.tsx` has a 📎 attach button; on send, extracted text travels as `attachedDocument: { name, text }` in the `POST /api/chat` body — one-shot, cleared from state after sending, nothing persisted to DB. `app/api/chat/route.ts` truncates to `ATTACHED_DOC_MAX_CHARS = 8,000` chars and injects it as a labelled "reference data only, never instructions" block in the system prompt (passes through `scanInput()` first, per CHAT-FIX-1). `maxTokens` for the reply is raised to 800 (from 300) when a document is attached.

### Chat→Profile Sync
The companion chat can propose additive updates to the user's `Self` profile (a drive, a goal, or a health flag). Full design: `docs/modules/profile-sync.md`.

- **Proposal types** (`ProfileProposal` union in `lib/companion/profileSync.ts`): `"drive"` (adds a `DriveType` to `profile.drives`), `"goal"` (AI-drafted goal statement + suggested skills, attached to a confirmed drive), `"health"` (`sleepQuality` or `stressLevel` field update). Each has a stable `id` (e.g. `"drive:learning"`, `"health:sleepQuality"`) used for de-dup and dismissal tracking.
- **One proposal per turn** — `app/api/chat/route.ts` computes at most one `proposal` after generating the reply: `buildProfileProposal()` (synchronous, signal-based — drive confirmation, health flags) runs first; only if it returns `null` does `tryProposeGoal()` (async, AI-based, `chatComplete` with `jsonMode: true`) run. Both are gated on `isCompanionSession`.
- **`dismissedProposals` localStorage** — key `charaivati.dismissed_proposals`, capped at 50 entries (`MAX_DISMISSED_PROPOSALS`), client-side only in `ChatBot.tsx`. "No thanks" calls `addDismissedProposal(proposal.id)`; the array is sent as `context.dismissedProposals` on every chat request so the same proposal is never re-shown in that browser. Accepting does not add to this list — `applyProfileProposal()`'s own "already present" checks prevent re-proposing.
- **`charaivati:profile-updated` event** — dispatched on `window` after a successful `POST /api/self/profile-proposal`, with `detail = { drives, goals, health, generalSkills }` (the updated `Profile`). Any component displaying profile data should listen for this to refresh without a page reload.
- **`POST /api/self/profile-proposal`** — `{ proposal: ProfileProposal }`, auth via `getServerUser(req)`. **CHAT-FIX-1 validation** (all 400 on failure): `proposal.type` must be `"drive" | "goal" | "health"`; `type:"health"` requires `payload.field ∈ {"sleepQuality","stressLevel"}`; `type:"drive"|"goal"` requires `payload.driveType ∈ {"learning","helping","building","doing"}`; `type:"goal"` requires non-empty `payload.statement`. On success calls `applyProfileProposal(userId, proposal)` → `db.profile.upsert()`, returns `{ ok: true, profile }`.

### Listener ("Saathi") — /api/listen (CONSULT-1b)
A **parallel** guided-conversation system, NOT a mode of the chatbot. It shares exactly four seams with the existing chat stack and nothing else: (1) `lib/ai/chatPipeline.ts` (auth + input guard + timeout + guarded completion), (2) the guardrails inside it (`scanInput`/`scanOutput`/`notifyAdmin` — BLOCK/WARN behavior identical to `/api/chat`), (3) the **proposal mechanism** (`tryProposeGoal` from `lib/companion/profileSync.ts` — called directly from `/api/listen`; its internals are untouched, the route passes a *synthetic* `companionProfile` param built from Listener insights since the function only reads `primaryDrive`/`driveConfirmedByUser` off the param and never queries UCP), and (4) the chat bubble CSS (UI prompt, later). Full doc: `docs/listen.md`.

- **Models**: `ConsultSession` (one per user — `userId @unique`; guests are real User rows so guests work; `consultStage Int 0-5`, `insights Json`, `language` captured from the `lang` cookie at create) and `ConsultMessage` (role/content, cascade-delete, `@@index([sessionId, createdAt])`). Migration: `20260611000000_add_consult_session`. Use `(db as any).consultSession`/`.consultMessage` until a full `prisma generate` runs (Windows: `--no-engine` while server up).
- **`POST /api/listen { message, dismissedProposals? }`** → `{ ok, reply, consultStage, proposal? }`. History is rebuilt server-side from the last 20 `ConsultMessage` rows — client-sent history is never trusted (guests, reloads). System prompt = PERSONA + NEVER + CRISIS always, plus method sections by stage (0-1 Rogerian, 1-3 MI, 3-4 SFBT), PHASES, PARAMETER_SENSING (stages ≤3), compact insights summary, language instruction. **No platform/initiatives/mentor blocks.** temperature 0.7, maxTokens 220. Blocked input returns the pipeline's canned reply and persists nothing.
- **`GET /api/listen`** → `{ ok, consultStage, insights, messages: last 50 }` for page hydration.
- **Extraction pass** — every 4th user message, one `chatComplete` `jsonMode` call (local-first via the normal provider chain) merges into `insights` via `lib/listener/insights.ts` `mergeInsights()` — lists union-deduped (cap 12), scalars fill-in-only, a `confirmed` driveCandidate is never overwritten or downgraded. Stage advance re-evaluated after each extraction (`evaluateStageAdvance` — at most one stage per pass): 0→1 any theme; 1→2 ≥2 themes + a parameter touched; 2→3 driveCandidate sensed; 3→4 goal emerging in conversation AND time+energy+funds each touched; **4→5 only on accepted proposal** (wired by the UI prompt, not the extraction pass).
- **insights JSON shape** (`ConsultInsights` in `lib/listener/insights.ts`): `{ themes: string[], driveCandidate: { value: "learning"|"helping"|"building"|"doing"|null, confidence: "sensed"|"confirmed" }, skills: { items: string[] }, health: { notes: string[], senseLevel: number|null }, environment: { notes: string[] }, time: { notes: string[], dailyHours: number|null }, funds: { notes: string[], pressure: "low"|"medium"|"high"|null }, network: { notes: string[] }, energy: { senseLevel: number|null } }`. **There is deliberately NO goal field** — goal candidates flow exclusively through the proposal mechanism, never stored in insights.
- **Context file**: `ai-context/CONSULT_LISTENER.txt` (committed like all `ai-context/*.txt` files since UCTX-1b — canonical copy in `docs/listen.md` appendix). Sections: PERSONA / METHOD_ROGERIAN / METHOD_MI / METHOD_SFBT / PHASES / PARAMETER_SENSING / CRISIS / NEVER. Crisis protocol: drop all extraction/goal behavior, warmth first, offer Tele-MANAS 14416 and KIRAN 1800-599-0019 (free, India).
- **Page (CONSULT-2)**: `/listen` — `app/(listen)/listen/page.tsx` (route group, root layout only, mobile-first; later ships as a standalone Capacitor app). Guest-first: on 401 the page silently POSTs `/api/user/guest` then re-hydrates via `GET /api/listen`. `/listen` is in the middleware language-gate skip list (guests have neither session nor `lang` cookie on first visit). The floating ChatBot bubble is suppressed on `/listen` by `components/chat/ChatBotGate.tsx` (pathname wrapper in `app/layout.tsx` — ChatBot internals untouched). English chrome for v1; AI replies in the user's language.
- **Components**: `components/listen/ListenChat.tsx` (bubbles copied from ChatBot styling; rotating contextual status lines — "Listening…" etc., cycling 1.5 s — NOT three dots; steer chips; crisis banner), `components/listen/MindMap.tsx` (hand-rolled inline SVG bottom sheet, 9 fixed nodes: Drive → Goal → 7 parameters; grey/dashed = unknown, soft fill = sensed, solid+✓ = confirmed; Energy shows `senseLevel` and is marked derived/read-only; Network is display-only), `components/chat/ProposalCard.tsx` (the shared proposal Yes/No card — lifted verbatim from ChatBot, which now imports it; also exports the `charaivati.dismissed_proposals` localStorage helpers for ListenChat).
- **Map triggers**: `lib/ai/mapTrigger.ts` — `isMapRequest(msg)` + `MAP_TRIGGERS` (mirrors `councilTrigger.ts`). Checked client-side in ListenChat BEFORE sending; on match the sheet opens locally and the model is NOT called.
- **Steer protocol**: tapping a map node sends `POST /api/listen { message: "", steer: "<node>" }` (`correction: true` from long-press/right-click "That's not right"). The route appends a one-turn system hint ("the user wants to talk about X next" / "re-ask rather than assume"); steer-only turns use an in-flight `[map tap: X]` marker user message for the model and persist NO user `ConsultMessage` (no fake user text in the transcript — the UI shows a "You chose: Health" chip instead). Valid steer keys: drive/goal/skills/health/environment/time/funds/network/energy.
- **Crisis mode (CONSULT-2)**: `scanInputCrisis()` in `lib/ai/guardRail.ts` (separate function — `scanInput`/`scanOutput` untouched, `/api/chat` byte-identical). On match: `ConsultSession.crisisFlag` latches `true` (migration `20260612000000_add_consult_crisis_flag`; **never auto-cleared** — manual DB clear only), `notifyAdmin` fires a `LISTEN_CRISIS` GuardrailEvent (type union extended — additive), the system prompt collapses to PERSONA + CRISIS + NEVER + language (no stages/methods/sensing/insights), and extraction/proposals/stage-advance are skipped for the rest of the session. Responses carry `crisis: true`; the UI renders the Tele-MANAS/KIRAN helpline banner persistently above the input (UI-rendered, not model-rendered — model output is not a reliable channel for emergency numbers).
- **Personality layer (UCTX-3, locked doctrine)**: `PersonalityProfile` (one row per user, `(db as any).personalityProfile`, migration `20260614000000_add_personality_profile`) is a **hypothesis-grade, tone-steering-only** signal — DISC (D/I/S/C) + the 4 drive archetypes, each `{ score: 0-1, evidence: int }`. Built **slowly**: a separate `chatComplete` jsonMode extraction call every 8th user message (`PERSONALITY_EVERY = 8`, distinct from the every-4th insights pass — separate call for truncation isolation on the local 8b model), applying deltas clamped to **±0.1 per pass** (`lib/listener/personality.ts` `applyPersonalityDeltas`). **Local-tier composer use ONLY** — `lib/ai/userContext.ts` appends a one-line tone-steering hint when `confidence >= 0.3` (`PERSONALITY_COMPOSER_THRESHOLD`), and `buildCloudBlock` never includes it. **Never user-facing** — no DISC labels, drive-type names, or "you seem like a [X]" framing anywhere in the UI or model output; `[SECTION: PERSONALITY_GUIDANCE]` in `ai-context/CONSULT_LISTENER.txt` enforces this (loaded only when the tone-steering line was emitted). Standing ban applies: `lib/listener/personality.ts` doesn't import `db` and nothing in this pass reads or writes `UserCompanionProfile`; `driveScores` here are independent from `ConsultSession.insights.driveCandidate` and never cross-written.
- **Admin bridge (PERSONA-1, locked doctrine)**: `lib/listener/adminBridge.ts` is the admin-side counterpart to the Listener — admin recognition, teaching mode, and the question queue. Full design: `docs/listen.md` § Admin Bridge.
  - **Admin = `ADMIN_EMAIL` (or `ADMIN_ALERT_EMAIL`) only** — `isAdminUser(userId)` does a DB lookup + case-insensitive email compare, mirroring `/admin/security`/`/api/admin/verify`. When `isAdmin && !crisisActive`, `/api/listen` swaps the stage/method/sensing/personality semi-static blocks for `[SECTION: ADMIN_MODE]` and skips insights extraction, personality extraction, stage advancement, and `tryProposeGoal` entirely.
  - **Persona writes are card-confirmed deterministic code, never raw model side effects** — `handleAdminCommand` intercepts admin commands ("save this as X philosophy", "show draft personas", "activate X persona", "revise it: ...", "answer question N: ...", "skip that question") and routes them to deterministic DB reads/writes in `adminBridge.ts`. A model `chatComplete` call only *distills* a `PhilosophyPersona` draft (`distillPersona`/`revisePersona`/`distillAnswer`) — the actual `PhilosophyPersona` upsert happens only in `POST /api/listen/persona` after the admin accepts a `PersonaProposalCard`, and that route re-checks `isAdminUser` server-side (403 for non-admins, never trusts a client flag).
  - **Personas are tone lenses, not characters** — `DISTILL_RULES` enforces: capture the *way of thinking*, never name or identify the admin/teacher, a referenced thinker/tradition may appear in `attribution` only (never a direct quote, never in `body`), and the assistant's core truths/values stay constant (tone-and-lens adjustment, not a new character or belief set).
  - **`AdminQuestion` is anonymized by design — no `userId` field.** `fileAdminQuestion` runs `anonymizeQuestion()` (strips emails/long numbers/"my name is X") before writing, and is rate-capped to ~1/30min per user. The admin teaches general knowledge, not user cases.
  - `PhilosophyPersona`/`AdminQuestion` require `(db as any)` until a full `prisma generate` (migration `20260615000000_add_persona_admin_question`). **PERSONA-2 (user-facing persona injection, routed by `PhilosophyPersona.triggers`) is deferred** — PERSONA-1 is admin-side only and does not change what regular users see.
- **Action layer (PRIV-ACT-1, locked doctrine)**: the Listener can take a small set of deterministic actions — sending a friend request, sending a short reminder to an existing friend, and (UNFRIEND-1) removing an existing friend — described honestly to the model via `[SECTION: CAPABILITIES]` in `ai-context/CONSULT_LISTENER.txt` (loaded always, non-crisis, between CRISIS and the language line). Full design: `docs/listen.md` § Action Layer.
  - **Privacy doctrine first**: `User.discoverable Boolean @default(true)` (migration `20260616000000_add_user_discoverable`) lets a user opt out of name search entirely. `lib/users/searchUsers.ts` `searchUsers()` is the single shared search impl for both `GET /api/users/search` and the Listener — returns only `{ id, name, avatarUrl, location }` (never email/phone), filters `discoverable: true` and `status != "guest"`. `PATCH /api/user/privacy { discoverable }` is the user-facing toggle.
  - **Trigger → extraction → action → confirm**: `lib/ai/actionTrigger.ts` `isFriendRequest`/`isReminderRequest` (substring match, checked server-side in `/api/listen` only, gated `text && !crisisActive && !isAdmin`, before the conversational model call) → one `chatComplete jsonMode` extraction (`extractFriendQuery`/`extractReminderQuery` in `lib/listener/actions.ts`) → deterministic action built from DB lookups only (`buildFriendSearchAction`/`buildReminderAction`, types in `lib/listener/actionTypes.ts`) → reply text generated without a model call (`describeFriendSearchReply`/`describeReminderReply`) → response includes `action` (not persisted — only the reply text is saved as the `ConsultMessage`).
  - **UI**: `components/listen/FriendSearchCards.tsx`, `components/listen/ReminderCard.tsx`, `components/listen/ActionAvatar.tsx` — rendered by `ListenChat.tsx` below the assistant bubble.
  - **Writes happen only in dedicated confirm routes**: `POST /api/listen/actions/friend-request { targetUserId }` (mirrors `POST /api/friends/request` checks) and `POST /api/listen/actions/reminder { recipientUserId, text }` — recipient must already be an accepted friend (re-checked server-side), `scanInput()` BLOCK rejects, rate-limited (5/day sender, 1/hour per recipient).
  - **Reminder doctrine split (ACTION-INTENT-5b, locked)** — reminders to existing friends are LOW-STAKES and are **send-and-report, no confirm card**, distinct from destructive relationship changes (unfriend/block), which KEEP their confirm cards. `lib/listener/actions.ts` exports `sendReminder(senderId, recipientUserId, rawText)` — the shared send path (friendship check, `scanInput()` BLOCK, day + per-recipient rate limits, `createNotification()` whose real boolean result gates the reply per ACTION-INTENT-5a). Both `/api/listen` (direct send) and `POST /api/listen/actions/reminder` (the `reminder_pick`/`reminder_non_friend` confirm-card path) call this same helper — no duplicated logic.
    - **Collapsed both-present case**: when `extractReminderQuery` returns both `recipientName` and `reminderText` (and `reminderText` is not just an echo of `recipientName`) AND `buildReminderAction` resolves to exactly one friend (`reminder_confirm`), `/api/listen` calls `sendReminder()` immediately and replies `Sent "{text}" to {name}.` (`describeReminderSentReply`) — `action: null`, no card, one turn. On failure, `describeReminderFailedReply(message)` reports the real error (rate limit, not-friends, delivery failure). Ambiguous matches (`reminder_pick`) and non-friend/not-found cases are unchanged — pick-list / non-friend reply still shown, still card-driven for `reminder_pick`'s eventual send.
    - **`pendingReminder` continuation (fixes the "remind X" dead-end)** — `ConsultSession.pendingReminder Json?` (migration `20260619000000_add_consult_pending_reminder`, `(db as any)` until full `prisma generate`), shape `{ recipientName: string, awaitingText: true }`. When `recipientName` resolves but `reminderText` is missing (or is just an echo of the name), `/api/listen` sets `pendingReminder` and replies once with `describeReminderAskTextReply(name)` ("What should I remind {name}?"). **Strict one-turn window**: on the very next turn, BEFORE any other intent/trigger handling, `/api/listen` reads `pendingReminder` and **unconditionally clears it** (regardless of outcome — never persists past one turn). Then: (1) a cancel phrase (`isReminderCancel()` — "never mind", "nevermind", "nvm", "cancel that/it", "forget it"/"forget about it", "don't bother", "no need") → `describeReminderCancelledReply()`, nothing sent; (2) the new text matches ANY other recognized action trigger (friend request, new reminder, unfriend, logout, clear-chat, login-offer-for-guest) → the pending reminder is abandoned (already cleared) and the NEW intent is processed normally — **precedence**: other action triggers always win over a pending reminder; (3) otherwise the text IS the reminder message — `resolveAndSendReminder(pendingReminder.recipientName, text)` runs the same send-and-report (or pick/non-friend/not-found reply) as the collapsed case. There is currently only ONE pending-continuation field; any future pending-state addition must follow the same "read once, always clear immediately, then branch" pattern to avoid cross-field collisions.
  - **Self friend-requests (FRIEND-BUG-1)** — `searchUsers()` already excludes the current user and both `/api/friends/request` and `/api/listen/actions/friend-request` already reject `receiverId/targetUserId === self`; `buildFriendSearchAction` additionally tags a self-match as `relationship: "self"` and `FriendSearchCards.tsx` renders "This is your own account" instead of an Add friend button, as defense in depth.
  - **Notification-reuse decision**: reminders reuse the existing `Notification` model with `type: "friend_reminder"` (added to the documented type union below) rather than a new model — no migration needed (`type` is a plain `String`), and the existing bell/SSE/`createNotification()` infra works unchanged. Recipient privacy (no read receipts to sender) falls out for free since the confirm route never reads the notification back.
  - **Pending friend requests (FRIEND-NOTIFY-1)** — the Listener surfaces a user's pending `FriendRequest` rows (`receiverId = user, status = "pending"`, cap 5, minimal public sender fields via `getPendingFriendRequests()` in `lib/listener/actions.ts`) conversationally, **once per session** — reusing `FriendRequest` + `POST /api/friends/accept` unchanged, no new notification infra. `ConsultSession.friendReqSurfacedAt` (migration `20260617000000_add_consult_friend_req_surfaced`, `(db as any)` until full `prisma generate`) tracks the last-surfaced timestamp; only requests created AFTER it are "new" and trigger a re-surface. A dynamic-zone hint line (local-tier only, per UCTX-1b) is added to the system prompt when there's something new; the `friend_requests_pending` action card (`components/listen/FriendRequestCard.tsx`) is attached to the response **only if no goal proposal fired this turn** (the two never compete), and `friendReqSurfacedAt` is updated at that point. **"Accept"** calls `POST /api/friends/accept` unchanged. **"Ignore" is dismiss-only** — it does NOT decline or delete the request server-side; the request stays `pending` so the sender can still be handled from the Social page. Suppressed entirely during crisis (`crisisActive`) and admin mode (`isAdmin`).
  - **Unfriend (UNFRIEND-1)** — available from both the user profile page (`app/user/[id]/page.tsx` — "Friends" badge becomes a "Remove friend" button with a `confirm()` step) and the Listener chat, both reusing the existing `POST /api/friends/remove { friendId }` (audited and found pre-existing — no new endpoint built). In chat: `isUnfriendRequest()` (`lib/ai/actionTrigger.ts`, `UNFRIEND_TRIGGERS` — "unfriend", "remove friend", "delete friend", etc.) → `extractUnfriendQuery` (jsonMode) → `buildUnfriendAction(userId, name)` resolves **only against the user's accepted `Friendship` rows** (never `searchUsers()` — unfriend cannot target non-friends) → `unfriend_confirm` / `unfriend_pick` (ambiguous name) / `unfriend_not_found` (types in `lib/listener/actionTypes.ts`). The confirm card (`components/listen/UnfriendCard.tsx`, rendered by `ListenChat.tsx`) is **one-time/non-persistent** — "Confirm" POSTs to `/api/friends/remove` and shows "Removed X from friends.", "Cancel" just dismisses. Confirmation is required because this is destructive.
  - **Block / unblock (ACTION-INTENT-6)** — `UserBlock` model (`id, blockerId, blockedId, createdAt`, `@@unique([blockerId, blockedId])`, cascade-delete both sides via `User.blocksMade`/`blocksReceived`; migration `20260620000000_add_user_block`, requires `(db as any).userBlock` until a full non-`--no-engine` `prisma generate` with the dev server stopped). **Block is one-directional in intent but bilateral in effect**: `POST /api/users/block { targetUserId }` upserts the `UserBlock` row (idempotent), then auto-unfriends the pair (`db.friendship.deleteMany` via `canonicalPair`) and clears any pending `FriendRequest` in either direction — block implies unfriend. `POST /api/users/unblock { targetUserId }` deletes the `UserBlock` row only (does not restore the friendship). Bilateral enforcement: `lib/users/searchUsers.ts` excludes a candidate user `u` from results if EITHER side has blocked the other (`u.blocksReceived: { none: { blockerId: excludeUserId } }` AND `u.blocksMade: { none: { blockedId: excludeUserId } }`) — so neither party can find the other in search. `POST /api/friends/request` and `POST /api/listen/actions/friend-request` reject with `{ ok: false, error: "blocked", message: "Couldn't send a friend request." }` (400) if a `UserBlock` exists in either direction — **deliberately neutral wording, never reveals which side blocked**.
    - **In chat**: `isBlockRequest()` (`lib/ai/actionTrigger.ts`, `BLOCK_TRIGGERS = ["block", "unblock"]` — broad substring match, intentionally simple; see `TECH_DEBT.md` for the false-positive tradeoff) → `extractBlockQuery` (jsonMode) → `buildBlockAction(userId, name)` resolves against **friends first, then falls back to `searchUsers()`** (unlike unfriend, block can target a non-friend) → `block_confirm` / `block_pick` (ambiguous name, friends or non-friends) / `block_not_found`. Looser phrasings ("I don't want X to contact me anymore", "stop him from messaging me") are caught by the intent classifier's `block_user` intent (`lib/listener/intentClassifier.ts` — explicitly disambiguated from `remove_friend`: "if the user wants to cut off ALL contact, use block_user").
    - **Shared `FriendshipActionCard` (`components/listen/FriendshipActionCard.tsx`)** — extracted from the original `UnfriendCard` so Unfriend and Block reuse one `idle → sending → done/dismissed/error` confirm machine and styling. Props: `{ friend: {id,name,avatarUrl}, verb: "Unfriend"|"Block", endpoint, confirmText?, sendingText?, successText? }`. POSTs `{ friendId, targetUserId, userId }` (all the same id) to `endpoint` so either `/api/friends/remove` (reads `friendId`) or `/api/users/block` (reads `targetUserId`/`userId`) works unchanged. `UnfriendCard.tsx` and the new `BlockCard.tsx` (`components/listen/BlockCard.tsx`, rendered by `ListenChat.tsx`) are now thin wrappers that resolve the target (friend list / pick list / search results) and render this shared card. `describeBlockReply` for `block_confirm`: "Are you sure you want to block {name}? They won't be able to find you, friend you, or contact you, and any existing friendship will be removed." Confirmation required — block is destructive and is never auto-applied.
- **Login / logout / clear chat + intent classifier (ACTION-INTENT-3, locked doctrine)**: full design `docs/listen.md` § Part F.
  - **`ConsultSession` per-user conversational bookkeeping** (migration `20260618000000_add_consult_action_intent3`, `(db as any).consultSession` until full `prisma generate`): `greetedThisSession Boolean`, `loginDeclined Boolean`, `loginLastAskedAt DateTime?`, `chatResetAt DateTime?`, `recentIntentNote String?`. None of these are ever merged into `insights`. `recentIntentNote` (last 200 chars of the user's text) is written AFTER it is read for the current turn, so `classifyIntent()` always sees the *previous* turn's note as `recentContext` — this is how pronouns ("him"/"her") get resolved across turns.
  - **Intent classifier (`lib/listener/intentClassifier.ts`)** — second-tier recognition, runs only when Parts B–D's strict-keyword checks AND the logout/clear-chat keyword checks all miss: `looksActionShaped(text)` is a cheap synchronous pre-filter (substring match against `ACTION_WORDS`); on a hit, one `chatComplete jsonMode` call (`classifyIntent`) returns `{ intent, params }` with `intent ∈ {add_friend, remove_friend, send_reminder, logout, clear_chat, show_map, accept_friend_request, chat, unknown_capability}`. Only `add_friend`/`remove_friend`/`send_reminder`/`unknown_capability` are acted on (routed into the existing Part B/D builders — no new write paths); `logout`/`clear_chat`/`chat`/`show_map`/`accept_friend_request` from the classifier are never acted on directly. `unknown_capability` → `fileAdminQuestion(userId, text, "capability_request")` (fire-and-forget) + fixed reply "I can't do that here yet — I've passed it along so the team can consider adding it. Is there something else I can help with?"
  - **AdminQuestion's tracker is `AdminQuestion`, written by `fileAdminQuestion()` (`lib/listener/adminBridge.ts`)** — FIX-UNKNOWN-CAP-1 audited why realistic out-of-scope asks ("book me a cab", "open my calendar and add a meeting") never reached it: `looksActionShaped()`'s keyword pre-filter (a) doesn't match novel phrasings ("book", "cab", "weather", "calendar" weren't in `ACTION_WORDS`) so the classifier never ran, and (b) even when it did run, `classifyIntent` tended to return `"chat"` rather than `"unknown_capability"` for these without explicit examples in its prompt. **Fix is two-layered, not a single broadened pre-filter** (a single keyword list can never enumerate every "book/order/pay/navigate/play/..." phrasing): (1) `ACTION_WORDS` gained a few more common verbs (`book`, `order`, `schedule`, `calendar`, `weather`, `pay`, `navigate`, `play`, ...) and `classifyIntent`'s prompt now gives explicit `unknown_capability` examples (book a cab, order food, calendar, weather, pay a bill, call someone, play music, translate) vs. explicit `chat` examples (casual conversation, opinions, feelings) — improves the classifier path when it does run. (2) **The real backstop is post-reply**, independent of any pre-filter: `lib/ai/capabilityGapTrigger.ts` exports `isCapabilityDeclineReply(reply)` — regexes matching the `[SECTION: CAPABILITIES]` "DECLINING WARMLY" wording ("not something I can do from here yet... I've noted it", "I can't book/order/schedule/pay that", etc.). `/api/listen` now files an `AdminQuestion` whenever EITHER `isCapabilityGapCandidate(text) && replyHedges(reply)` (original knowledge-gap signal, unchanged) OR `isCapabilityDeclineReply(reply)` (new action-capability-gap signal) is true — so any turn where the model itself declines an action gets logged, regardless of whether the user's phrasing matched a keyword list. Casual chat ("my friend told me a joke") produces neither hedge nor decline language in the reply, so it is not logged.
  - **LOGOUT — strict-keyword-only, never via the classifier**: `isLogoutRequest()` (`lib/ai/actionTrigger.ts`, `LOGOUT_TRIGGERS` — "log out", "logout", "sign out", "signout", "log me out", "sign me out") → `action: { type: "logout_confirm" }`, reply from `describeLogoutReply()` ("Want me to sign you out?"). `components/listen/LogoutConfirmCard.tsx` → "Sign out" POSTs the existing `/api/auth/logout` (no new endpoint) → `ListenChat.tsx`'s `handleLoggedOut()` calls `window.location.reload()`, which re-triggers the bootstrap guest-creation flow.
  - **CLEAR/RESET CHAT — strict-keyword-only, never via the classifier**: `isClearChatRequest()` (`lib/ai/actionTrigger.ts`, `CLEAR_CHAT_TRIGGERS` — "clear chat", "reset chat"/"reset our conversation", "start over", "start fresh", "wipe this chat", etc.) → `action: { type: "clear_chat_confirm" }`, reply from `describeClearChatReply()`. `components/listen/ClearChatConfirmCard.tsx` → "Clear chat" POSTs `POST /api/listen/clear` (new route, auth via `verifySessionToken`) which sets `ConsultSession.chatResetAt = new Date()`, `rollingSummary = ""`, and `foldedThrough = chatResetAt` — **`ConsultMessage` rows are never deleted** (fold-don't-delete, same doctrine as the UCTX-1b rolling-summary fold). `ListenChat.tsx`'s `handleClearedChat()` calls `setMessages([])` — clears on-screen state only.
  - **`chatResetAt` is read on both `/api/listen` paths (ACTION-INTENT-5c)** — previously written but never read, so "clear chat" only cleared the client's view; reload brought the old conversation back, and a later fold could even pull pre-reset rows into `rollingSummary` and feed them to the model forever. Fixed: (1) **GET** (display) filters `ConsultMessage` rows to `createdAt > session.chatResetAt` — a cleared chat reloads empty (rows are untouched, just hidden). (2) **POST** (model window) computes `windowBoundary = max(foldedThrough, chatResetAt)` and uses it for both the window query and fold eligibility — cleared rows can never re-enter the model's context or be folded into `rollingSummary`. **Invariant**: `/api/listen/clear` sets `foldedThrough = chatResetAt` and blanks `rollingSummary` at clear time, so `foldedThrough >= chatResetAt` holds going forward and the `max()` in POST is a defensive backstop, not the primary mechanism. Normal (non-cleared) sessions are unaffected — `chatResetAt` is `null`, `windowBoundary` collapses to the existing `foldedThrough` behavior.
  - **LOGIN offer (`SecureChatCard`, built in UCTX-2, now wired into `/listen`)**: `GET /api/listen` returns `isGuest` (from `payload.role === "guest"`), `loginDeclined`, `loginLastAskedAt`, and server-computed `showLoginOffer = isGuest && !loginDeclined && (!loginLastAskedAt || now - loginLastAskedAt > 3 days)`. `POST /api/listen/login-offer { action: "shown" | "dismiss" }` (new route) updates `loginLastAskedAt` ("shown") or additionally sets `loginDeclined = true` ("dismiss", never re-offered). `ListenChat.tsx`'s empty state renders `<SecureChatCard onDismiss={dismissLoginOffer} onSuccess={handleLoginSuccess} />` when `isGuest && showLoginOffer && !loginOfferDismissed`.
  - **Fixed greeting line** — `ListenChat.tsx`'s empty state always shows "You can say 'logout' any time to sign out." below "What's on your mind?", making the LOGOUT-disambiguation guidance in `[SECTION: CAPABILITIES]` honest.
  - **Warm capability-declines (TONE-DECLINE-1)** — `[SECTION: CAPABILITIES]`'s DECLINING WARMLY block requires every "I can't do that" to offer the real alternative, never a flat refusal or "I am not an X" framing. For login specifically: `isLoginRequest()` (`lib/ai/actionTrigger.ts`, `LOGIN_TRIGGERS`) on a guest → `action: { type: "login_offer" }`, reply from `describeLoginOfferReply()` — `ListenChat.tsx` renders `<SecureChatCard>` inline in the bubble (dismiss just clears that message's `action`, no `/api/listen/login-offer` write — distinct from the empty-state nudge's 3-day-cooldown card). Signed-in users asking to log in get no card; the model declines warmly per the same section.
  - **In-chat login, both modes (LOGIN-IN-CHAT-1)** — `SecureChatCard` (`components/listen/SecureChatCard.tsx`) is now two-mode with an in-card toggle: "secure this account" (signup — username+password → `POST /api/user/guest-upgrade`, same user) and "log in to an existing account" (login — email+password → `POST /api/user/login`, `credentials: "include"`). The login mode reuses the existing login route unchanged, including its guest-merge behavior (`mergeGuestToReal`, which already moves `ConsultSession`/`ConsultMessage` per UCTX-2) — so a guest's Listener conversation transfers onto the account they log into. **Credentials never enter `/api/listen`, `ConsultMessage`, or any model call** — both modes `fetch()` straight from the card component to their respective auth routes; the trigger/classifier path only ever produces `action: { type: "login_offer" }` + a fixed reply string. **No navigation away from `/listen`** — on success, `ListenChat.tsx`'s `handleLoginSuccess()` calls `hydrateSession()` (the same logic as the initial guest-bootstrap effect, now factored out) to re-fetch `GET /api/listen` and reset `stage`/`insights`/`crisis`/`personalityTopDrive`/`isGuest`/`showLoginOffer`/`messages` in place. `describeLoginOfferReply()` now reads "I can sign you in right here — just tap below to log in or secure this account." — no "login page" wording anywhere in the Listener's prompt or fixed strings.
- **Site awareness (PERSONA-2, locked doctrine)**: gives the AI honest knowledge of what Charaivati the platform actually is, so it stops denying live features or inventing fake ones. KNOWLEDGE ONLY — distinct from, and never expands, the action layer above.
  - **Single source of truth**: `lib/site/capabilityRegistry.ts` (`SECTIONS` — live/scaffolded/planned per layer, routes, `liveFeatures`/`plannedFeatures`/`eta`/`interim`). `lib/site/siteAwareness.ts` only *summarizes* this registry for prompts — never authors new status/route data. `buildSiteAwareness()` (full per-layer map, ~150-250 tokens, local tier) and `buildSiteAwarenessCompact()` (one-line summary, cloud tier — platform structure is non-sensitive but cloud prompts stay lean per UCTX-1b).
  - **Site-can-do vs chat-can-do**: the AI must distinguish "the SITE can do X (here's the route, or here's the interim if planned)" from "I, in THIS chat, can do X" (only the Listener's two `[SECTION: CAPABILITIES]` actions — friend request, reminder). Never conflate "where do I see my orders" (site feature) with "can you remind my friend" (chat capability).
  - **Never invent or deny**: a `live` section → tell the user where to go; `scaffolded`/partial → say what works today vs what's coming; `planned` → say so honestly and offer the `interim` alternative, never a fake link.
  - **Placement — semi-static**: the block is built once at module load (changes only when `capabilityRegistry.ts` changes, not per turn) and sits in the semi-static prompt zone for prefix-cache stability (UCTX-1b). In `/api/listen`: `[SECTION: SITE_AWARENESS]` (full instruction) + `buildSiteAwareness()` for local, `buildSiteAwarenessCompact()` + a short instruction for cloud; included in both normal and admin-mode prompts, excluded from crisis. In `/api/chat`: a single `buildSiteAwarenessCompact()`-based line in the static zone of `assemble()` — `PLATFORM.txt`'s `[SECTION: layers]` is conceptual only (no live/planned/route data), so this is additive, not a duplicate.
  - **Privacy honesty**: the AI may describe that a setting (e.g. `User.discoverable`, `PATCH /api/user/privacy`) exists and where to find it, but must never claim to know the user's *current* value — reading it is a future action (see `TECH_DEBT.md` § 12).

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
- `components/brand/Wordmark.tsx` — **the ONE canonical "Charaivati" logo wordmark** (bold, `tracking-tight`, white→gray-400 gradient text; sizes `sm`/`md`/`lg`/`xl`, optional `href`). Three shells render the logo through it: `app/(with-nav)/WithNavClient.tsx` (desktop header), `app/app/layout.tsx` (mobile top bar), and `app/store/[id]/layout.tsx` (store top bar) — plus the landing page (`app/page.tsx`), login page, and `/verified`. **Never hand-roll the logo font/styling in a layout or page** — import this component so the brand stays identical everywhere.
- `components/nav/AccountMenu.tsx` — **the shared account/profile dropdown**, used by both `app/app/layout.tsx` and `app/store/[id]/layout.tsx` (LAYOUT-SYNC-1 — the two layouts stay separate files, never merged/re-exported, but share this one dropdown for structural parity). First item is always "🏠 Home" → `/app/home`. Optional `storeContext` prop (`{ deliveryLabel, onOpenAddress, isOwner, storeId }`) is passed only by the store layout and adds delivery-address/My Orders/Manage Orders/My Businesses items. Optional `t` prop (i18n translator) is passed only by `app/app/layout.tsx` — falls back to English when omitted, so the store layout (no i18n) works unchanged. Do not hand-roll a second account dropdown in either shell.
- `components/store/` — e-commerce builder (filters, banners, image library, QuickOrderModal, StoreImagePickerModal, DiscoveryFilterModal, **`FilterPill`** — shared taxonomy-filter pill atom used by DiscoveryFilterModal body and saved-page Browse header; import from `components/store/FilterPill`)
- `components/social/` — chat panel, friend requests
- `components/timeline/` — project timeline with phases and milestones
- `components/business/` — question cards, scoring dashboard
- `components/earth/` — signal board, impact lens
- `components/health/` — health profile modals
- `components/transport/` — live vehicle tracking map; `Broadcaster` uses `useGeolocation` hook (not `navigator.geolocation` directly)
- `components/earn/` — Initiative Hub shell (`InitiativeTabs.tsx`), Partners tab (`PartnersTab.tsx`), delivery dashboard client (`DeliveriesClient.tsx` — Mark Delivered button + GPS modal with Broadcaster), Team tab (`TeamTab.tsx`), Workflow tab (`WorkflowTab.tsx` — sortable step list with per-step assignee management)
- `components/shared/` — reusable non-domain components: `AddressForm.tsx` (address form with GPS, pincode auto-geocode, drag-pin map), `MapPicker.tsx` (Leaflet drag-pin map, always loaded client-side via `dynamic(..., { ssr: false })`), `StatusMessages.tsx` (cycles through a `messages: string[]` array with a fade transition every `intervalMs` ms; default 1500 ms; used in menu parse + apply loading states and intended for chatbot reuse)

### Loading State Conventions

Full reference: `/docs/modules/loading-states.md`. Summary:

- **Skeleton over spinner** for page-level and list loading: use `animate-pulse` blocks shaped to match actual content dimensions (`#E2E8F0` primary, `#F1F5F9` secondary). Never render a plain text "Loading..." or a lone full-screen spinner where layout dimensions are known.
- **`loading.tsx` for non-dynamic routes**: every App Router route that is not a `"use client"` dynamic component needs a `loading.tsx` sibling that mirrors the page shell with skeletons. Existing: `app/app/saved/`, `app/app/initiatives/`, `app/app/orders/`, `app/app/notifications/`. Still missing: all `app/store/` routes, `app/fleet/[pageId]/`, `app/(with-nav)/self/`.
- **Button guard pattern**: every async button must (1) track in-flight state per item (`useState<string | null>(null)` keyed by ID), (2) guard at top of handler (`if (loading === itemId) return`), (3) set/clear in `.finally()`, (4) pass `disabled={loading === itemId}` to the element. High-visibility actions show an inline spinner; low-visibility actions (mark-read, soft toggles) use `opacity: 0.5` only.
- **No artificial delays**: do not use `setTimeout` to reveal content. Render skeleton while data loads, swap when ready.

### Key Libraries
- `lib/featureFlags.ts` — feature flag system (check before adding major features)
- `lib/rateLimit.ts` — rate limiting for API routes
- `lib/csrf.ts` — CSRF protection
- `lib/writeQueue.ts` — queued write operations
- `lib/timeline-templates.ts` — predefined timeline templates
- `lib/sectionTagMappings.ts` — maps store section types to tags
- `lib/mergeGuest.ts` — `mergeGuestToReal(guestId, realId)`: atomic guest-to-real account merge inside a single Prisma transaction; moves cart, wishlist, pinned stores, page follows, addresses, orders, owned pages and stores, then deletes the guest user
- `lib/imageSearch.ts` — `fetchImage(query, { allowUnsplash? })`: multi-provider image search with rotating load distribution (Unsplash → Pexels → Pixabay, `callCount % 3`) and guaranteed Picsum fallback (no key, deterministic seed). `allowUnsplash` defaults `true`; passing `false` filters Unsplash out of the chain so the query lands on a free provider (used by the menu-apply route to ration Unsplash quota — MENU-IMG-RATION-1). `fetchImages(queries[], opts?)` / `resolveImage(query, opts?)` (`lib/imageCache.ts`) thread the same option through. Any provider whose key is missing is skipped silently.
- `lib/store/uploadImage.ts` — `uploadStoreImage(file, storeId)`: dedup-aware upload utility; single source of truth for all store image uploads
- `lib/store/generateSlug.ts` — `generateSlug(name)` + `randomSuffix()`: slug generation for stores
- `lib/store/getStoreSlugs.ts` — `getStoreSlugs(ids[])`: batch raw-SQL slug lookup; used by all store-listing APIs to add slug to responses without depending on the Prisma typed client
- `lib/invoice/generateInvoiceNumber.ts` — `generateInvoiceNumber()`: sequential `INV-YYYY-NNNNN` counter; queries `Order.count({ where: { invoiceNumber: { not: null } } })`
- `lib/invoice/InvoiceDocument.tsx` — `@react-pdf/renderer` Document component; renders TAX INVOICE or BILL OF SUPPLY layout with seller/buyer blocks, items table, GST totals
- `hooks/useGeolocation.ts` — `useGeolocation()`: GPS abstraction hook; tries `@capacitor/geolocation` first (requests permission, then `watchPosition`), falls back to `navigator.geolocation.watchPosition` in browser. Returns `{ startWatch, stopWatch }`. Always use this hook for any new GPS feature — never call `navigator.geolocation` directly.
- `lib/pages/kindLabel.ts` — `kindLabel(page)`: returns a human-readable page type string given `{ type, pageType }`. Handles the `type: "health"` edge case and all `pageType` values (`"store"`, `"helping"`, `"learning"`, `"service"`, `"fleet"`). Used by the home dashboard, EarningTab, Initiative Hub, and `add-new-page-type` flow. Do not inline this logic elsewhere.
- `lib/sendEmail.ts` — `sendEmail({ to, subject, text?, html? })`: sends via Nodemailer/Gmail. **Throws** if `EMAIL_USER`/`EMAIL_PASS`/`EMAIL_FROM` are not set — callers must wrap in try/catch. In development with missing env vars the function still throws, but the register route logs the verification link to console before attempting the send.
- `lib/notifications/createNotification.ts` — `createNotification({ userId, type, title, body, link? })`: writes a `Notification` row. Never throws — wraps in try/catch and logs. Uses `(prisma as any).notification` because the Prisma client may be stale.
- `lib/workflow/createSubOrder.ts` — `createSubOrder({ parentOrderId, assigneeUserId, storeId, stepId, stepName, agreedAmount?, subOrderType })`: creates a child `Order` row (copies parent items/address, sets `status="confirmed"`, `deliveryStatus="processing"`) and fires an `order_assigned` notification. Idempotent — skips if a sub-order with the same parent+user+type already exists. Uses `(prisma as any).order` because new fields aren't in the stale client.
- `lib/utils/timeAgo.ts` — `timeAgo(iso)`: converts an ISO timestamp to a human-readable relative string ("5m ago", "3h ago", "2d ago"). Used by `NotificationBell` and the notifications page. Always import from here — do not copy this function inline.

### Chat System Messages (`iv = "system"`)
`ChatMessage` rows created server-side (e.g., quote-request notifications from `lib/workflow/triggerQuoteRequests.ts`) are stored as plaintext with `iv = "system"`. This is intentional — server-side message creation cannot perform ECDH client-key encryption. When rendering chat messages, check `if (message.iv === "system")` and display the `ciphertext` field as a plain system-notice card (grey, no decrypt attempt). **Do not attempt to decrypt these messages** — the decryption will silently produce garbage. Do not "fix" this pattern by moving it to a queue without updating this note.

### Quote Timeouts (in-process `setTimeout`)
`lib/workflow/triggerQuoteRequests.ts` uses `setTimeout` to reject timed-out quotes. This works for development but **does not survive process restarts**. Replace with BullMQ (or any durable job queue) before production launch. See also `docs/START_HERE.md` for the flagged risk.

### Security Notes
- CSP headers are configured in `next.config.mjs` — update them when adding new external scripts, styles, or media sources
- `X-Frame-Options: DENY` is set globally; do not add iframe embeds without updating the CSP `frame-src`
- `geolocation` permission is restricted to `self` and `https://charaivati.com`
- **`attachedDocument.text` (chat file uploads) must pass `scanInput()` (CHAT-FIX-1)** — `app/api/chat/route.ts` previously injected the uploaded document's text straight into the system prompt with only a soft "treat as data, not instructions" framing — no enforced guardrail. It is now scanned with the same `scanInput()`/BLOCK/WARN/`notifyAdmin()` pattern used for `message`, before being added to the prompt.
- **`POST /api/self/profile-proposal` validates `proposal.payload` fields before `applyProfileProposal()` (CHAT-FIX-1)** — `type:"health"` requires `payload.field` to be `"sleepQuality"` or `"stressLevel"`; `type:"drive"`/`"goal"` require `payload.driveType` to be a valid `DriveType` (`"learning" | "helping" | "building" | "doing"`); `type:"goal"` requires a non-empty `payload.statement` string. All return 400 on failure. Previously these AI-sourced fields were passed through unchecked.

### Environment Variables
Required: `DATABASE_URL`, `DIRECT_URL`, `DATABASE_PRISMA_URL`, `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `SENDGRID_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, Upstash Redis credentials.

**Database connection strings** — `schema.prisma` uses `url = env("DATABASE_PRISMA_URL")` (the pooler/PgBouncer URL) and `directUrl = env("DATABASE_URL")`. All three connection strings must include `&options=-c%20timezone%3DUTC`. Without it, Neon's default session timezone is IST and all `createdAt`/`updatedAt` timestamps are stored 5:30h ahead of UTC, causing notification "X ago" times to appear hours off. Set this on Vercel env vars too — `.env.local` only affects local dev.

Auth email (Nodemailer/Gmail — used by `lib/sendEmail.ts` for verification emails):
- `EMAIL_USER` — Gmail address used as the SMTP sender
- `EMAIL_PASS` — Gmail app password (not the account password)
- `EMAIL_FROM` — Display address in the `From:` header (can differ from `EMAIL_USER`)

Image search (all optional — `lib/imageSearch.ts` skips missing providers and falls back to Picsum):
- `UNSPLASH_ACCESS_KEY` — Unsplash API client ID
- `PEXELS_KEY` — Pexels API key
- `PIXABAY_KEY` — Pixabay API key

## AI Architecture

### Provider Chain
`chatComplete()` in `app/api/aiClient.ts` tries providers in this order:
1. **Ollama** (local) — if `LOCAL_AI_ENABLED=true` and `OLLAMA_BASE_URL` is set
2. **NVIDIA NIM** — if `NVIDIA_KEY` is set; base URL `https://integrate.api.nvidia.com/v1`; default model `meta/llama-3.1-8b-instruct` (override with `NVIDIA_NIM_MODEL`). **NVIDIA NIM: 40 rpm rate limit on current account (CHARAIVATI.FORWARD@GMAIL.COM). Do NOT use NIM for batch jobs, bulk AI processing, or any loop that fires multiple requests in quick succession. NIM is fallback for interactive single-user requests only when Ollama tunnel is down.**
3. **OpenRouter** — if `OPENROUTER_API_KEY` is set
4. **Groq** — if `Charaivati_groq` is set
5. **Vercel AI Gateway** — if `Charaivati_Health` is set (final fallback)

**Footgun fixed (UCTX-1a)** — the Ollama path previously ignored `maxTokens`/`temperature` and set no `num_ctx`, so the `/api/chat`/`/api/listen` token caps had no effect locally and large prompts were **silently top-truncated** to Ollama's default context window. `callOllamaResilient` now sends explicit `options: { num_ctx, num_predict: maxTokens, temperature }` + `keep_alive`, threaded down from `chatCompleteInternal`. Env vars: `OLLAMA_NUM_CTX` (default 8192), `OLLAMA_KEEP_ALIVE` (default `"24h"` as of LOCAL-AI-FIX-1, was `"30m"` — set to `-1` in `.env.local` to never evict). Local Ollama replies now respect `maxTokens` (e.g. `/api/listen`'s 220 cap) — an intended behavior change. Also added a **`cloudMessages?: ChatMessage[]` seam** to `chatCompleteInternal`/`chatCompleteWithMeta` (threaded through `runGuardedCompletion` in `lib/ai/chatPipeline.ts`): the Ollama (local, trusted) branch always uses `messages`; cloud branches use `cloudMessages ?? messages`, so a privacy-tiered prompt can be sent to cloud providers without changing local behavior. Default `undefined` → zero behavior change for all existing callers.

### Prompt Assembly Doctrine (UCTX-1b — locked)
- **Order is always static → semi-static → dynamic.** Static = platform/initiative/persona/philosophy + (listener) PERSONA/NEVER/CRISIS/languageLine. Semi-static = stage/method/parameter-sensing blocks + (listener) the folded `rollingSummary`. Dynamic = the per-user/per-turn context block + attached document + steer hint. **Never place per-turn content before stable blocks** (it busts the prompt cache and is the opposite of what you want).
- **SECURITY RULES (`/api/chat`) are deliberately LAST.** Recency position is a safety choice; keep them last despite the caching cost. Do not move them.
- **Unified composer**: `lib/ai/userContext.ts` `buildUserContext(userId, { tier })` builds the dynamic user block. `tier: "local"` = the rich block (drives, goals, derived energy, initiatives, section, compact health + skills, UCP companion fields when `arcStage > 0`) — replaces the old inline blocks + `buildCompanionContext` in `/api/chat`. `tier: "cloud"` = the **minimal** block ONLY (language, arc/consult stage, drive name, current section). It is the single reviewed definition of *what cloud providers see about a user* — **keep it minimal; review contents periodically.** No health, skills, insight notes, or personality in the cloud block.
- **Two prompt variants per request**: routes build a local system prompt (full block) and a cloud system prompt (minimal block), identical otherwise, and pass both arrays to `runGuardedCompletion({ messages, cloudMessages })`. Ollama gets `messages`; cloud fallbacks get `cloudMessages` (UCTX-1a seam).
- **`/listen` history folds in blocks of 16 past 30 messages (stable-prefix scheme).** While the unfolded window ≤ 30 messages it is sent append-only; once it exceeds 30, the oldest 16 are summarized (one `chatComplete` `jsonMode` call) into `ConsultSession.rollingSummary` and excluded from the model window thereafter (`foldedThrough` marks the boundary). The summary lives in the semi-static zone (changes only at fold events). The unpersisted `[map tap: X]` steer marker is a known, minor, accepted prefix perturbation on steer-only turns. Full transcript is still stored — folding only affects what the model sees, not what `GET /api/listen` returns for display.

### Local AI Setup (Dev + Production)
Ollama runs locally on the dev machine and is exposed permanently via Cloudflare Tunnel:
- Tunnel URL: `https://ollama.charaivati.com`
- Cloudflare service auto-starts on Windows boot
- Ollama auto-starts via Windows Task Scheduler (`OllamaServe` task)
- `OLLAMA_HOST=0.0.0.0` set as permanent Windows system env var
- **Current version: v0.30.4** (upgraded from v0.21.2 on 2026-06-04 — v0.21.x had a crash bug with llava vision queries)

**Text-only local + cloud-vision split (LOCAL-AI-FIX-1, 2026-06-14)** — the local 6 GB RTX 3050 can only keep one model resident at a time:
- **Chat (text) = local Ollama** — `llama3:8b` (text-only, `capabilities: ["completion"]`, fits mostly on-GPU). Previously `gemma4:e2b` (Gemma 3n unified multimodal — vision+audio weights baked into the GGUF, cannot be stripped), which always spilled ~4.4GB to CPU (`CUDA_Host` buffer) on this card, making every load slow enough to risk timing out.
- **Vision (menu photos, scanned-PDF OCR) = cloud** — `google/gemini-2.5-flash-lite` via OpenRouter for menu parsing (`MENU_VISION_MODEL`), `anthropic/claude-haiku-4-5` via OpenRouter for document OCR (`DOC_OCR_FALLBACK_MODEL`, now primary). Loading a local vision model (`llava:7b`) would evict the resident `llama3:8b` and force a ~20s reload on the next chat — cloud vision avoids this entirely. Local `llava:7b` fallback paths remain for environments without `OPENROUTER_API_KEY`, but are no longer the default.
- **Keep-alive + timeouts** — `OLLAMA_KEEP_ALIVE=-1` (never evict `llama3:8b`) in `.env.local`; code fallback default raised to `"24h"`. Ollama emits **zero response bytes until the model finishes loading** (measured 19-32s cold-load time-to-first-byte on this 3050) — the old 8s `OLLAMA_CONNECT_TIMEOUT` aborted every cold load before Ollama could respond at all, producing "client connection closed before llama-server finished loading" (HTTP 499). `OLLAMA_CONNECT_TIMEOUT` and `OLLAMA_GEN_TIMEOUT` defaults raised to 45s/90s (from 8s/60s) in both `.env.local` and `aiClient.ts`'s fallback defaults — see `FIX-OLLAMA-TIMEOUT-1` in Known Footguns for why these stay two separate budgets.

### Installed Models
| Model | Size | Purpose |
|---|---|---|
| `llama3:8b` | 4.7 GB | **Primary local chat model (text-only)** — `OLLAMA_MODEL`/`CHAT_AI_MODEL`, kept resident via `OLLAMA_KEEP_ALIVE=-1` |
| `gemma4:e2b` | 7.2 GB | No longer the active local chat model (LOCAL-AI-FIX-1 — unified multimodal weights spill to CPU on a 6GB card) |
| `llava:7b` | 4.7 GB | Local vision fallback only — used by menu parse / document OCR when `OPENROUTER_API_KEY` is unset |

### Environment Variables
Local `.env.local`:
```
LOCAL_AI_ENABLED=true
OLLAMA_BASE_URL=https://ollama.charaivati.com
OLLAMA_MODEL=llama3:8b
CHAT_AI_MODEL=llama3:8b
OLLAMA_KEEP_ALIVE=-1
OLLAMA_CONNECT_TIMEOUT=45000
OLLAMA_GEN_TIMEOUT=90000
MENU_VISION_MODEL=google/gemini-2.5-flash-lite
```
Vercel (production) — same vars, Ollama is the primary provider when the dev machine is on.
When machine is off, falls back to OpenRouter → Groq → Vercel automatically.

### Context Strategy
Ollama calls are free — pass full user context:
- All drives, all goals, full skill list
- Energy score (derived from sleep + steps)
- Health flags, fund independence score, network gaps
- Active initiatives, current section
- Full conversation history

Cloud fallbacks are token-cost-sensitive — keep prompts lean (~400 tokens max).

### Chatbot Widget
- Component: `components/chat/ChatBot.tsx`
- API route: `POST /api/chat`
- Rendered in root `app/layout.tsx`, visible to all logged-in users
- Conversation history in `useState` only — not persisted to DB
- System prompt built from user profile data at request time

### AI Guardrails
Three-layer security system on every `POST /api/chat` request. Full details: `docs/AI_SECURITY.md`.

- **`lib/ai/guardRail.ts`** — `scanInput(msg)` / `scanOutput(reply)`: regex pattern matching, returns `{ level: 'BLOCK'|'WARN'|'PASS', reason, matchedPattern }`. **Do not remove — active security control.**
- **`lib/ai/adminNotify.ts`** — `notifyAdmin(event)`: persists a `GuardrailEvent` DB row + sends email to `ADMIN_ALERT_EMAIL` via `lib/sendEmail.ts`. Fire-and-forget (call as `notifyAdmin(...).catch(console.error)`). **Do not remove.**
- Wired into `app/api/chat/route.ts`: input scan → BLOCK returns canned reply; WARN continues + notifies; security rules appended to system prompt; output scan → BLOCK returns fallback reply.
- Admin view at `/admin/security` — gated by `ADMIN_EMAIL` env var (must match session user email).
- `GuardrailEvent` model added to schema via `db push` — use `(db as any).guardrailEvent` until `prisma generate` runs.

### Model Tiers (`lib/ai/modelTiers.ts`)
Every model name maps to a tier that controls chatbot UI labels and provider-awareness metadata.

| Tier | Models |
|---|---|
| `junior` | `gemma4:e2b`, `llama3:8b`, `openai/gpt-4o-mini` |
| `assistant` | `gemma4:e4b`, `openai/gpt-4o` |
| `senior` | `gemma4:26b-a4b` |
| `council` | (reserved for multi-step deliberation flows) |

`getTierUI(modelName)` returns a `TierUI` object with `label`, `responding`, `waiting`, `cloudFallback`, and `disclaimer` strings. `getTier(modelName)` returns the raw tier level. Unmapped models default to `junior`.

`POST /api/chat` now returns `{ reply, tier, tierUI, source, coldStart, localExpected, model? }`:
- `source`: `"local"` (Ollama) or `"cloud"` (fell through to OpenRouter/Groq/Vercel)
- `coldStart`: `true` if Ollama returned empty on first attempt but succeeded on retry (model was loading)
- `localExpected`: `true` when `LOCAL_AI_ENABLED=true` + `OLLAMA_BASE_URL` are set — lets the widget show "Local assistant unavailable" when `source === "cloud"`
- `model`: present only in development (`NODE_ENV !== 'production'`)

`chatCompleteWithMeta()` in `app/api/aiClient.ts` is the metadata-aware variant of `chatComplete()`. Use it in routes that need to know which provider responded. `chatComplete()` is unchanged for all other callers.

**Ollama resilient caller** (`callOllamaResilient` in `aiClient.ts`):
- First attempt: 8 s AbortController timeout
- Timeout or connection error → `state: 'unavailable'`, falls through to cloud immediately
- Empty/malformed response (model cold-starting) → wait 8 s, retry once
- Retry succeeds → `state: 'cold_start'`; retry fails → `state: 'unavailable'`

### Council Feature (`lib/ai/council*`, `app/api/council/route.ts`, `components/chat/CouncilView.tsx`)

The Council is a multi-perspective deliberation mode for high-stakes decisions. Phase 1 — deliberation only, no voting.

**Trigger**: always explicit — no auto-routing. Two entry points:
1. **"⚖️ Ask the Council" button** (bottom of chat widget) — works for any message in the input
2. **"Ask the Council" inline prompt** — appears below regular assistant responses when `isCouncilWorthy(userMessage)` is true; clicking it re-sends that question to `/api/council`

`isCouncilWorthy()` is still imported in ChatBot — used only for the inline "go deeper" prompt display, never for auto-routing sends.

**Four-file structure**:
| File | Purpose |
|---|---|
| `lib/ai/councilTrigger.ts` | `isCouncilWorthy(msg)` — phrase matching; `COUNCIL_TRIGGERS` array for extension |
| `lib/ai/councilPersonas.ts` | `COUNCIL_PERSONAS` map (guardian/seeker/builder); `buildPersonaPrompt()` builds `{ systemPrompt, prompt }` for `callAI` |
| `app/api/council/route.ts` | POST `/api/council` — auth-gated; **NDJSON streaming**; Guardian+Builder local, Seeker+Verdict+Synthesis cloud; verdict+synthesis parallel |
| `components/chat/CouncilView.tsx` | Progressive rendering; `_pending`/`_statusSteps` support; `onCancel` prop; framer-motion; exports `CouncilResponse`, `StatusStep` types |

**Route — NDJSON streaming** (`Content-Type: application/x-ndjson`, abort-aware):

Chunks sent in order: `status:2` → `position:guardian` → `status:3` → `position:seeker` → `status:4` → `position:builder` → `status:5` → `verdict` (which carries verdict+synthesis+trigger+tier). Error/abort: `{type:"aborted"}` or `{type:"error"}`. Abort detected via `req.signal.aborted` between calls. Verdict and synthesis are parallelized (`Promise.all`).

**CouncilResponse** (updated interface):
```typescript
{ positions[], verdict, synthesis, trigger, tier:'council', _fallback?, _pending?, _statusSteps?: StatusStep[] }
```

**CouncilView progressive rendering**:
- While `_pending`: status steps (active=bright/muted progression) + cards as they arrive + [✕ Cancel] via `onCancel` prop
- After `_pending` false: verdict + synthesis animate in; status steps stay as muted journey record
- Persona cards animate on mount individually (no stagger delay — stream provides natural timing)

**ChatBot integration** (`components/chat/ChatBot.tsx`):
- `dispatchCouncil(text, trigger, addUserMessage)` — reads NDJSON stream; updates pending message via `updatePendingCouncil()`; `councilAbortRef` tracks abort controller
- `cancelCouncil()` calls `.abort()`; catch block in dispatchCouncil shows `"Council dismissed."`
- **Fix 1**: "⚖️ Ask the Council" button uses `input.trim() || lastUserMessage`; `addUserMessage: true` when using input text, `false` when reusing last message (no duplicate bubble); disabled with tooltip when no target exists
- **Fix 2**: `councilAbortRef = useRef<AbortController | null>` — cancel button rendered inside CouncilView via `onCancel` prop
- **Fix 3**: `councilPending = messages.some(m => m.council?._pending)` — council loading state is inside CouncilView; regular 3-dot indicator only shows when `loading && !councilPending`
- Inline "Ask the Council" prompt after regular responses calls `dispatchCouncil(originUserMessage, "manual", false)`

**Phase roadmap**:
- **Phase 1** (current): deliberation only — 3 personas + verdict + synthesis, no further user interaction
- **Phase 2** (planned): user can respond to a specific persona, drilling deeper into one lens
- **Phase 3** (planned): voting / consensus — personas "agree" or "object" to proposed actions; outcome written to user's goals

### Planned: Context Layer
`/ai-context/` directory (not yet built):
- `PLATFORM.md` — Charaivati philosophy, 6-layer model
- `DRIVES.md` — 4 drive archetypes in depth
- `RESPONSE_GUIDE.md` — AI tone and behavior rules
- `lib/ai/promptBuilder.ts` — assembles platform + user context + task prompt
- `lib/ai/userContextBuilder.ts` — builds per-user context, cached in Redis

## AI Context Files

Philosophy and behavior context for the Charaivati AI lives in `/ai-context/`. The `.txt` files **are committed** (UCTX-1b — `.gitignore` un-ignores `ai-context/*.txt` so the prompts load in production); only non-`.txt` working files stay local.
Files use `[SECTION: name]...[/SECTION]` format parsed by `lib/ai/contextLoader.ts`.

### Files
- `PLATFORM.txt` — mission, 6 layers, philosophy
- `DRIVES.txt` — 4 drive archetypes (Brahmin/Kshatriya/Vaishya/Shudra) and combinations
- `RESPONSE_GUIDE.txt` — tone rules, energy gates, forbidden patterns
- `INITIATIVES.txt` — store/service/fleet/helping initiative types and workflow

### Periodic Review Instructions (for Claude Code)
When asked to review AI context files:
1. Read all four files in `/ai-context/`
2. Check each section has content (warn if any `[SECTION]` block is empty)
3. Check for navigation issues — sections that are too long (>300 words), ambiguous, or redundant
4. Suggest structural improvements only — do NOT rewrite or change the philosophy content
5. Check `lib/ai/contextLoader.ts` still parses all sections correctly
6. Check `app/api/chat/route.ts` is still injecting platform context into system prompt
7. Report: which sections are populated, which are empty, any structural issues found

### Adding New Sections
To add a new section to any file:
1. Add `[SECTION: new_name]...[/SECTION]` block to the file
2. No code changes needed — `contextLoader.ts` parses all sections automatically
3. To use a specific section in a route: `loadSection('DRIVES.txt', 'builder')`

### When to Update Context Files
- New initiative type added → update `INITIATIVES.txt`
- Drive archetype understanding deepens → update `DRIVES.txt`
- AI tone feedback from users → update `RESPONSE_GUIDE.txt`
- New layer becomes active → update `PLATFORM.txt`

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

## Email Friend Invite & Admin Direct-Create

Full spec in `docs/modules/auth.md` §§ Feature A and Feature B. Summary:

### Feature A — Email friend invite (`POST /api/invite`)
- Caller: any `active` or `lite` user. Rate limit: 10/inviter/24h.
- **No enumeration**: response is always `{ ok: true, message: "If they're not already on Charaivati, they'll get an email to join." }` regardless of whether the email is registered.
- Email not registered → create shell user (`status: "invited"`), create `Invite` row, send join email containing `https://charaivati.com/claim/{rawToken}`.
- Email already registered → send silent security notice to that address, log attempt; do NOT create anything.
- Token: `createToken(32)` + `hashToken()` from `lib/token.ts`. Only `sha256(rawToken)` stored. TTL 7 days. Single-use.
- Claim page: `app/claim/[token]/page.tsx` (server component). On success → Server Action `claimInvite(token)` → atomic transaction: `status → lite`, `contactVerified → true`, `emailVerified → true`, issue session, redirect `/self`.
- `Referrer-Policy: no-referrer` set in `next.config.mjs` for `/claim/*` routes.
- UI widget: `import { InviteFriend } from "@/components/social/FriendRequestsBox"` — email input, shows generic message on send.

### Feature B — Admin direct-create (`POST /api/admin/users`)
- Gate: `ADMIN_EMAILS` env var (comma-separated). Server re-checks inside the route — never trust client flags.
- Rate limit: 50 admin-creates/admin/24h.
- Creates user: `status: "lite"`, `mustChangePassword: true`, `contactVerified: false`, `createdByAdminId: <admin.id>`.
- Every creation logged server-side (admin ID + target email + timestamp).
- UI at `/admin/users` — mirrors existing `/admin/security` pattern.

### `mustChangePassword` enforcement
- `mustChangePassword` is embedded in the session JWT at login time (login route computes it before `createSessionToken`).
- `middleware.ts` reads the flag from the JWT and redirects every page request to `/change-password` until cleared — except `/change-password` itself. This is server-side enforcement; cannot be bypassed by direct navigation.
- `POST /api/user/login` also returns `{ mustChangePassword: true, redirect: "/change-password" }` for the client to act on.
- `POST /api/user/change-password` clears the DB flag AND re-issues the session cookie with `mustChangePassword` omitted, so the middleware stops redirecting.
- Voluntary password change also available from the same route (requires `currentPassword` when `mustChangePassword` is false).

### `contactVerified` gating
- Gate Earn-layer money actions with `lib/requireVerifiedContact.ts`: `const block = await requireVerifiedContact(req); if (block) return block;`
- Currently guarded routes (money actions only): `POST /api/store/billing-profiles`, `PATCH /api/store/billing-profiles/[profileId]`, `POST /api/orders/[orderId]/invoice`, `POST /api/orders/[orderId]/invoice/sign`.
- Set to `true` by: invite claim, email verification magic link.
- Admin-created accounts start with `false` until a future OTP flow (not yet built).

### Social recovery (2-of-3) — NOT YET BUILT
When built, enforce: at least 3 trusted contacts before recovery can activate. A single party must never be sufficient.

### Environment variable
- `ADMIN_EMAIL` — existing var (also used by `/admin/security`). `POST /api/admin/users` and `/admin/users` use the same variable — no new env var needed.

### Schema additions (migration: `20260604000000_add_invite_contact_verified`)
- `User.contactVerified Boolean @default(false)`
- `User.mustChangePassword Boolean @default(false)`
- `User.createdByAdminId String?`
- New `Invite` model (see `prisma/schema.prisma`)

### New user statuses
- `"invited"` — shell user created when an invite is sent to an unknown email (no password, no emailVerified)
- `"lite"` — account after invite claim or admin-create with password set (contactVerified depends on path)

---

## Business Document PDF + Share System (BIZDOC-2)

### PDF generation — reuses invoice stack
`lib/business/BusinessDocumentPdf.tsx` — `@react-pdf/renderer` components: `SWOTPdf` (4-quadrant), `BMCPdf` (landscape 9-block), `FinancialsPdf` (Year 1/2/3 table). Same primitives (`Document`, `Page`, `View`, `Text`, `StyleSheet`) as `lib/invoice/InvoiceDocument.tsx`. No new PDF library.

`lib/business/uploadDocumentPdf.ts` — Cloudinary `upload_stream` helper. `type: "upload"` (public, not authenticated like invoices). folder: `biz-docs/`. Raw Cloudinary URL never sent to browser — always proxied via server routes.

**pdfUrl invalidation**: `PUT /api/business/documents` sets `pdfUrl: null` on every save. Forces re-generation on next download. Generate-on-download (via `GET /api/business/documents/pdf/download`) or pre-generate (via `POST /api/business/documents/pdf`).

### Share token system
`POST /api/business/share { ideaId, type }` — mints a `randomUUID()` shareToken on the BusinessDocument if none exists. Idempotent. Auth: ownership guard.

`GET /api/business/share/[token]` — **public, no auth**. Returns only: `type, title, content, status, pdfUrl, updatedAt`. Excludes ideaId and all ownership fields. One token → one document, never a bundle.

`GET /api/business/share/[token]/pdf` — **public, no auth**. Generates + proxies PDF. Token is the access grant.

Public share page: `app/(business)/business/share/[token]/page.tsx` — server component, no auth, read-only render + "↓ Download PDF" link.

Plan page: "🔗 Share" button mints token + copies URL to clipboard. "↓ PDF" button proxies download. Share URL strip shown below the type tabs.

### No i18n system found
No i18n/translation system exists in this codebase. All UI strings are inline English throughout. Document this if a translation system is added in the future.

## Adaptive Evaluation Engine (BIZDOC-3)

Replaces the old batch 12-question form with a turn-by-turn AI conversation. Three roles handle each evaluation:

| Role | Provider | Trigger |
|---|---|---|
| **Interviewer** | Local Ollama via `chatComplete()` | Every turn — scores answer, returns confidence |
| **Assessor** | Cloud via `callAI({ provider:"openrouter" })` — bypasses Ollama | When local confidence < `CONFIDENCE_THRESHOLD`, once per dimension |
| **Cross-check** | Server logic | After both scores exist: if `|local − assessor| > DISAGREEMENT_THRESHOLD`, queue one probe |

### Tunable constants — `lib/business/interviewConfig.ts`
`CONFIDENCE_THRESHOLD = 0.55`, `DISAGREEMENT_THRESHOLD = 1.0`, `MAX_PROBES_PER_DIM = 2`, `LOCAL_TIMEOUT_MS = 12_000`, `ASSESSOR_TIMEOUT_MS = 20_000`. Also contains `PROBE_TEMPLATES` (sector-tuned static list), `detectSector()`, and all prompt-builder functions.

### Rail-guided questions
The 12 seeded `IdeaQuestion` rows are the base menu. The server deterministically advances `interviewState.currentIndex`. The AI does **not** invent questions — it only adds to `probeQueue` by selecting from `PROBE_TEMPLATES`. This keeps the question set auditable.

### Graceful degradation
When Ollama is unavailable, `chatComplete()` falls through to cloud automatically. `interviewState.localUnavailable = true` is set. Effect: no cloud Assessor is triggered (redundant), all provenance stays `"local_estimate"`, and the UI shows `"Quick evaluation — senior review unavailable"` on each turn + a yellow badge in `ResultsReport`.

### Provenance display
`dimProvenance[dim]` is `"local_estimate"` or `"senior_reviewed"`. Shown in `LiveScoreDashboard` (✦ / ~ badges per dimension) and in `ResultsReport` (per-dim badge + overall tier banner). Stored on `BusinessIdea.dimProvenance` (JSONB).

### New DB fields on `BusinessIdea` (added via Neon migration)
- `transcript JSONB` — `ConversationTurn[]` — full conversation with dim and questionKey per turn
- `dimProvenance JSONB` — `Record<dim, "local_estimate" | "senior_reviewed">`
- `interviewState JSONB` — `InterviewState` (currentIndex, sector, probeQueue, probeCount, provisionalScores, assessorScores, assessorRun, done, localUnavailable)

Use `(db as any).businessIdea` until `prisma generate` has been run with these fields present.

### Key API routes added
- `POST /api/business/idea/interview` — main turn handler; `{ ideaId, userMessage: string | null }`; returns `{ question, dim, done, provisional, tier, turnNum }`
- `POST /api/business/idea/interview/finalize` — runs cloud Assessor on unreviewed dims, calls `runFinalVerdict()`, persists final scores; returns `{ scores, overallScore, report, tier, dimProvenance }`

### Key lib files
- `lib/business/interviewConfig.ts` — all static config, types, sector detection, prompt builders
- `lib/business/runInterviewer.ts` — `runInterviewer(dim, questionText, answer, sector)` → `{ score, confidence, followUpNeeded, source }`
- `lib/business/runAssessor.ts` — `runAssessor(...)` → `AssessorResult | null`; `runFinalVerdict(...)` → `FinalVerdictResult` with local fallback

### UI changes (`app/(business)/business/idea/page.tsx`)
Replaced the batch form with a chat-bubble layout (user right / assistant left). `handleStart()` creates the idea then calls interview with `userMessage: null` to get the first question. `handleAnswer()` submits turns. `handleFinalize()` calls the finalize route and renders `ResultsReport`. `LiveScoreDashboard` sidebar updates provisionally after every turn.

## Market-Sizing Deepening + Validation Tasks (BIZDOC-4)

Extends BIZDOC-3 with three additions: (a) AI reaction per answer, (b) TAM/SAM/SOM market-sizing on first `marketNeed` answer, (c) assumption → validation task → Todo. Full design spec: `docs/BUSINESS_ANALYSIS_FLOW.md`.

### Math-in-code contract
**MATH IN CODE, JUDGMENT IN MODEL** — the cloud model returns only: population basis, SAM%, SOM%, and rationale. ALL arithmetic (`tam = pop`, `sam = round(tam × samPct)`, `som = round(sam × somPct)`) is computed in `components/business/MarketSizingPanel.tsx` and by `computeSizing()` in `lib/business/runMarketSizing.ts`. Never let the AI compute numbers.

### AI reaction per answer
`runInterviewer()` in `lib/business/runInterviewer.ts` now returns `reaction: string | null`. The prompt wrapper `buildInterviewerPromptWithReaction()` appends a `reaction` field to the JSON template — one short honest sentence reacting to the user's answer. The interview route passes `reaction` through in the turn response. On the idea page, reactions render as small italic text between the user bubble and the next question bubble. Graceful degradation: if the model returns no reaction, the field is null and nothing renders.

### Market-sizing deepening (TAM/SAM/SOM)
Fires exactly once per interview — on the first `marketNeed` dimension answer — controlled by `interviewState.marketSizingDone` (added to `InterviewState` in `lib/business/interviewConfig.ts`).

- **`lib/business/runMarketSizing.ts`** — `runMarketSizing(title, desc, sector, answer)`: calls cloud OpenRouter model, parses JSON `{ populationBasis, samPct, samRationale, somPct, somRationale, samValidationTask, samSuccessThreshold, somValidationTask, somSuccessThreshold }`, runs `computeSizing()` to produce `{ tam, sam, som, assumptions[] }`. Returns `MarketSizing | null` (null when cloud unavailable).
- **`BusinessIdea.marketSizing JSONB`** — stored on the idea. Added via Neon migration alongside the `Todo` table.
- **Fire-and-forget** — `runMarketSizing()` runs as a background promise in the interview route. Client gets `marketSizingPending: true` and polls `GET /api/business/idea?ideaId=` every 3 s until `marketSizing` appears.
- **`components/business/MarketSizingPanel.tsx`** — client component. Props: `{ sizing: MarketSizingData, ideaId, isGuest }`. User can adjust `samPct`/`somPct` sliders; numbers recompute instantly in component code. Shows TAM/SAM/SOM grid + sliders + validation task cards. Guest footer says "Sign in to save"; logged-in footer links to todo list.
- **User-adjustable sliders** — `samPct` (1–80%), `somPct` (1–50%). Initialized from model's values, editable client-side only (not persisted).

### Assumption → validation task → Todo
When market sizing completes server-side, `createValidationTodos(userId, ideaId, sizing)` writes one `Todo` row per assumption (SAM + SOM tasks). For guests: sizing is stored on the idea JSON and surfaced read-only by `ValidationTasks` from `guestSizing` prop — no DB write.

### Todo model (added BIZDOC-4, updated BIZDOC-5)
Fields: `id`, `userId`, `title`, `completed`, `freq?` (schedule frequency: "daily"/"weekly"/"monthly" — NOT an assumption key), `assumptionKey?` ("sam"/"som" — which market assumption this validates), `hobbyId?`, `ideaId?`, `validationLabel?`, `successThreshold?`, `createdAt`. Use `db.todo` (typed after full `prisma generate`).

**`freq` vs `assumptionKey`** — `freq` is for schedule frequency only. BIZDOC-4 incorrectly used `freq` to store "sam"/"som"; BIZDOC-5 migrated those rows to `assumptionKey` and cleared `freq`. Do not store assumption keys in `freq`.

### Two-view pattern (ONE list, two views — BIZDOC-5, corrected by TODO-SCOPE-FIX-1)
- **Self-tab** (`components/self/TodoList.tsx`) — all user todos; idea-tagged todos show indigo badge.
- **Business idea sidebar** (`components/business/ValidationTasks.tsx`) — filtered by `?ideaId=`.
- `GET /api/self/todos` accepts `?ideaId=`, `?hobbyId=` filters.
- `POST /api/self/todos` accepts `ideaId`, `validationLabel`, `successThreshold`, `assumptionKey`.
- **The Initiative Hub overview no longer renders a validation-tasks card** (TODO-SCOPE-FIX-1, completed by TODO-LEAK-FIX-2, 2026-06-08) — `BusinessIdea` has NO foreign key to `Page`/`Store`/initiative (it is a fully independent entity, same as `AiGoal` per BIZDOC-5's linking philosophy). The removed `validationOnly=true` mode queried ALL of the user's validation todos (`validationLabel IS NOT NULL`, scoped only by `userId`) and rendered them on every initiative's Overview tab — so a user with two businesses ("Selling toys" store + "Breakfast by Arun" evaluation) saw the other business's tasks bleed onto each initiative's page. There is no schema field to scope by initiative; do not re-add a cross-business validation card to `InitiativeTabs.tsx` without first adding a real `BusinessIdea → Page` link (migration) and filtering on it.
  - **The leak had exactly ONE render site, not two** — TODO-LEAK-FIX-2 ran an exhaustive repo-wide grep (`ValidationTasks`, `validationOnly`, `VALIDATION TASKS`, `business evaluations`, `Self → Tasks`) and confirmed the only place that ever rendered the cross-business card was `<ValidationTasks validationOnly isGuest={false} />` in `components/earn/InitiativeTabs.tsx`'s Overview tab — removing it (and deleting the now-dead `validationOnly` prop + its self-contained-card branch from `components/business/ValidationTasks.tsx`, and the param read from `GET /api/self/todos`) closes every leak. If the card appears to "still" show up after this fix is in the working tree, suspect a **stale dev bundle** first (the component is loaded via `dynamic(() => import(...), { ssr: false })`; removing the import leaves an orphaned chunk in `.next` that a client-side navigation can keep serving from cache) — restart the dev server and hard-refresh before assuming a new render site exists.
  - Validation tasks remain visible (correctly scoped) in exactly two places: the Self tab (`components/self/TodoList.tsx`, all todos, idea-tagged badge) and the specific business idea's page (`app/(business)/business/idea/page.tsx` → `<ValidationTasks ideaId={...} />`, plus the guest-only read-only view in `components/business/MarketSizingPanel.tsx`).

### Guest handling
- Guests cannot create Todo rows (session-only auth on the todos API).
- Market sizing is stored on `BusinessIdea.marketSizing` (accessible via guest cookie ownership).
- `ValidationTasks` receives `guestSizing` prop — renders assumption tasks read-only from the JSON with a "Sign in to save" note.
- `createValidationTodos()` is gated on `sessionUserId` — no-op for guests.

## Business↔Goal Linking (BIZDOC-5)

Goals (`AiGoal`) and businesses (`BusinessIdea`) are **separate independently-created entities**. A goal can have many businesses linked. A business does NOT require a goal and is NOT promoted into a goal. The link is mutable — add or remove at any time.

### Link storage
`BusinessIdeaGoal (businessIdeaId, goalId)` — many-to-many join table, composite PK, cascade-delete on both sides. Added via Neon MCP migration. **Uses raw SQL (`$queryRaw`/`$executeRaw`) until full `prisma generate` is run** — the new model is not in the stale DLL engine.

### API routes (`app/api/business/idea/goals/route.ts`)
| Method | Auth | Action |
|---|---|---|
| GET `?ideaId=` | Session or biz-guest cookie | List linked goals (guests always return `[]`) |
| POST `{ ideaId, goalId }` | Session required | Link idea → goal (idempotent, ownership verified) |
| DELETE `{ ideaId, goalId }` | Session required | De-link |

### UI
`components/business/GoalLinker.tsx` — rendered below `ResultsReport` on the idea page after evaluation completes. Fetches `/api/self/goals` + linked goals in parallel. Toggle-style selection. Guests see nothing.

### freq → assumptionKey migration
`Todo.freq` is now schedule-frequency only. The "sam"/"som" discriminator was migrated to `Todo.assumptionKey String?` via Neon SQL. All three write paths (`createValidationTodos`, market-sizing PATCH, todos POST) now use `assumptionKey`. `market-sizing/route.ts` reconciles labels using `{ ideaId, assumptionKey: "sam"/"som" }`.

## Business Document System (BIZDOC-1b)

Per-idea typed documents replace the old `BusinessPlan` model (retired — table still exists in DB but Prisma client no longer exposes it).

### BusinessDocument model
`@@unique([ideaId, type])` — one document per type per idea. Types: `SWOT | BMC | FINANCIALS | PROPOSAL | COMPETITOR`. `content` is Json, shape is type-specific. `status` is `DRAFT | COMPLETE`.

### Guest ownership
`BusinessIdea` has a `guestSessionId String?` field. When a non-logged-in user creates an idea, a UUID is stored there and set as the `biz-guest` HTTP-only cookie. All document read/write routes check this cookie if no userId is matched. Clearing the cookie orphans the ideas.

### Claim on login
`lib/business/claimGuestIdeas.ts` — `claimGuestIdeas(guestSessionId, userId)`: `updateMany` where `guestSessionId=X AND userId IS NULL`. Called in `POST /api/user/login` (parses Cookie header) and `GET /api/user/magic` (via `NextRequest.cookies`). Idempotent.

### AI document assist
`POST /api/business/documents/generate` — calls `chatComplete()` with a minimal prompt per type. System context from `ai-context/BUSINESS_AI_PHILOSOPHY.txt`. Real sector intelligence deferred to BIZDOC-3/-4. The financials prompt uses `year1/year2/year3` shape matching the page's `FinancialPlan` type — not the old `phase1/phase2` format.

### Plan page (app/(business)/business/plan/[ideaId]/page.tsx)
- Loads all docs on mount via `GET /api/business/documents?ideaId=`
- Saves with 1.5 s debounce via `PUT /api/business/documents`
- Document type dropdown: SWOT / BMC / Financials / Competitor Study (disabled, "Soon" badge)
- "✨ AI Draft" button calls generate route and merges returned content into current state
- Auto-save status shown inline ("Saving…" / "✓ Saved")
- BMC layout: 5-col grid, Value Propositions and Customer Segments span rows; Key Resources col 1, Channels col 4 in row 2; Cost Structure + Revenue Streams in row 3 (2-col)

## Architecture Docs
Before making any change, read the relevant doc in /docs.
For any new feature, check /docs/flows/ for the step-by-step procedure.
Start every session by reading /docs/START_HERE.md.

## Known Footguns (read these before touching anything)
- **Store soft-delete open-order check (STOREDEL-FIX-1)**: `lib/store/softDeleteStore.ts` uses `ACTIVE_DELIVERY_STATUSES` (`confirmed`/`processing`/`out_for_delivery`) as the delivery-side block, NOT a NOT-IN-closed check. `deliveryStatus = "pending"` on a terminal-status (`delivered`/`cancelled`) order is NOT an open order — delivery was simply never initiated. The old OR-of-NOT-IN logic incorrectly blocked deletion for every order cancelled pre-confirmation or fulfilled without the GPS delivery-tracking flow.
- **A success/confirmation string must be downstream of the operation's real success, never unconditional** (ACTION-INTENT-5a doctrine) — `POST /api/listen/actions/reminder` used to call `createNotification(...)` (which swallows all errors internally and returned `void`) and then unconditionally return `{ ok: true, message: "Reminder sent." }`. If the `Notification` row write threw, the user was told "sent" while nothing was delivered. Fixed: `createNotification()` now returns `Promise<boolean>` (true = row written), and the reminder route returns `{ ok: false, error: "delivery_failed" }` (500) when it's `false` — `ReminderCard.tsx` already branches on `data.ok` so no UI change was needed. The ~15 other `createNotification` callers are unaffected (deliberately fire-and-forget side-channel notifications on top of an already-successful primary write — see `TECH_DEBT.md` § 12 for why those are fine as-is). Apply this doctrine to any future route whose entire effect (not just a side-channel) is the notification.
- **`lib/mergeGuest.ts` was an N+1 transaction time-bomb — see the `lib/mergeGuest.ts` entry under `### Guest Account Merge` for the (ACTION-INTENT-5a) fix.** Short version: don't `findUnique` + `update`/`delete` per row inside a `$transaction` for guest-merge-style "diff two users' rows and reconcile" logic — precompute the diff with a couple of `findMany`s outside the transaction, then do bulk `updateMany`/`deleteMany` inside it.
- **Ollama timeout cleared on headers left generation unbounded — now two budgets (connect vs generation); cold prefill needs ~60s, never hard-cap total at the connect value** (FIX-OLLAMA-TIMEOUT-1) — `callOllamaResilient` in `app/api/aiClient.ts` previously used a single `AbortController` timer (`ATTEMPT_TIMEOUT=8s`) that was cleared once `fetch()` resolved headers, leaving the subsequent `res.json()` body-read completely unbounded — the nominal "8s timeout" did nothing, and the old "empty response → wait 8s → retry once" cold-start heuristic masked this. Fixed with two distinct budgets: **`OLLAMA_CONNECT_TIMEOUT`** — time to first byte; if Ollama is unreachable or never starts responding, abort and fail to cloud fast. **`OLLAMA_GEN_TIMEOUT`** — spans the full streamed response read; cold-prefill on this hardware legitimately takes 40-55s, so a hard cap at the connect budget would abort EVERY cold start to cloud and local would never be used. The call now uses `stream: true` and accumulates NDJSON `message.content` chunks manually; `coldStart` is derived from time-to-first-byte exceeding `OLLAMA_CONNECT_TIMEOUT`, not from the old retry heuristic. `lib/ai/chatPipeline.ts`'s `CHAT_TIMEOUT_MS` (the outer `withChatTimeout` wrapper around the whole `chatCompleteWithMeta` call, including any cloud fallback) is derived as `OLLAMA_GEN_TIMEOUT + 15_000` — otherwise the outer wrapper would kill a legitimate cold-start reply before `callOllamaResilient`'s own generation timer ever fires. **Defaults raised again under LOCAL-AI-FIX-1 (2026-06-14)**: `OLLAMA_CONNECT_TIMEOUT` 8000→45000ms, `OLLAMA_GEN_TIMEOUT` 60000→90000ms (so `CHAT_TIMEOUT_MS` is now 105s) — measured cold-load time-to-first-byte on the 3050 is 19-32s, which the old 8s connect budget could never survive, producing repeated HTTP 499s ("client connection closed before llama-server finished loading"). Do not collapse these back into one timeout, and do not lower the outer wrapper below the inner generation budget plus fallback headroom.
- **`gemma4:e2b` (and other thinking models) can return `message.content: ""` with `done_reason: "length"` while `message.thinking` is full — do not mistake this for "Ollama unavailable"** (FIX-THINKING-MODEL-1) — thinking models spend their `num_predict` budget on `message.thinking` before emitting `message.content`; with a small budget (e.g. 220, tuned for cloud) the model never gets to the actual reply, `content` stays empty, and `callOllamaResilient` correctly-but-misleadingly falls through to cloud as if Ollama were down. Fixed in `callOllamaResilient` (`app/api/aiClient.ts`): (1) the Ollama request now sends top-level `think: false` to suppress reasoning output; (2) `num_predict` for the local path is `Math.max(OLLAMA_NUM_PREDICT default 512, maxTokens)` — independent of the caller's (cloud-tuned) `maxTokens`, so local always gets headroom regardless of what `/api/listen`'s 220 cap requests; (3) if `content` is still empty but `thinking` is non-empty, this is logged loudly (`done_reason` included) as a distinct case rather than silently reported as `unavailable` — a regression here should be visible in logs, not masked. Do not lower `OLLAMA_NUM_PREDICT` below ~512 for thinking models, and do not remove `think: false`.
- **Listener side-calls (insights/personality/fold) run post-response and on offset cadences to avoid stacking prefills in one turn** (FIX-OLLAMA-TIMEOUT-1) — `/api/listen` previously ran insights extraction (every 4th user message), personality extraction (every 8th — `8 % 4 === 0`, so it always coincided with insights and ran via `Promise.all`), and fold summarization (when the window exceeds `FOLD_THRESHOLD`) all *inline before* the reply was returned — each is an extra Ollama prefill (10-50s), so coincident turns took 20s+. Fixed two ways: (1) **`PERSONALITY_OFFSET = 2`** — personality extraction now fires on `userMsgCount % PERSONALITY_EVERY === PERSONALITY_OFFSET` (i.e. `% 8 === 2`), which never coincides with insights' `% 4 === 0`, so at most one extraction runs per turn. (2) All three side-calls (fold, insights extraction, personality extraction) now run inside a single `after(async () => {...})` callback (from `next/server`) registered just before `return NextResponse.json(responsePayload)` — the user gets the reply immediately, bookkeeping happens after. The response's `consultStage` reflects the *pre-turn* stage (`stage`, not a same-turn `nextStage`); a stage-4 transition or updated insights/personality from this turn's background extraction lands in the DB before the next user message in the normal case and is picked up by the next turn's reads — a documented one-turn lag, not a lost update. The goal-proposal check (`stage === 4 && insights.driveCandidate.value`) likewise uses pre-turn values for the same reason. Do not move these back inline, and do not change the offset without re-verifying `% PERSONALITY_EVERY !== 0 (mod EXTRACTION_EVERY)` for any new cadence values.
- **Never duck-type the Redis client by checking `.multi` — both `@upstash/redis` and `ioredis` implement it, with incompatible argument shapes** (FIX-RATELIMIT-1) — `lib/redis.ts` previously exported `isIORedis(client)` which returned `!!client && typeof client.multi === "function"`. This is true for BOTH client kinds, so `lib/rateLimit.ts` always took the ioredis branch — including for Upstash — and called `tx.zadd(bucket, now, member)` (ioredis's positional `(key, score, member)` signature) on an Upstash pipeline, whose `zadd` expects `(key, { score, member })`. Every call threw `TypeError: Cannot use 'in' operator to search for 'score' in <number>`, was caught, and silently converted to permissive `{ ok: true }`. **Net effect: every `checkRateLimit()` call in the app was a no-op** — guest-creation caps, `/api/chat` and `/api/listen` message caps (UCTX-2), the Listener's friend-request/reminder limits (PRIV-ACT-1), invite (10/24h), and admin-create (50/24h) were all inactive with no error surfaced. Fixed: `lib/redis.ts` now returns `{ client, kind }` from `getRedisClient()` where `kind: "ioredis" | "upstash" | "none"` is tagged at construction time (env-var branch), never inferred by duck-typing. `lib/rateLimit.ts` dispatches on `kind` and uses each client's real API — ioredis keeps `multi()/zadd(key,score,member)/exec()` (tuple results); Upstash uses `pipeline()/zadd(key,{score,member})/exec()` (raw-value results). `checkRateLimit(key, limit, windowSec)`'s signature is unchanged (17 call sites). **Outage vs. code-bug are now distinguished**: connectivity errors (`fetch failed`, `ECONNREFUSED`, `ENOTFOUND`, `ETIMEDOUT`, etc.) still fail open permissively with a single `console.warn` per process (per CLAUDE.md's permissive-on-outage doctrine — see `### Guest-Creation Protection` above); a wrong-API-shape error (`Cannot use 'in' operator`, `is not a function`, `is not iterable`) is `console.error`'d loudly every time and additionally **thrown** when `NODE_ENV !== "production"` so a regression can never silently reappear. `getRedisClient()` also logs once at first call which client kind was detected ("rate limiting ACTIVE" / "INACTIVE"). Do not reintroduce a `.multi`-based or any other duck-typed client check.
- **Listener code must NEVER write `UserCompanionProfile` fields** (CONSULT-0c §4) — `primaryDrive`, `driveConfirmedByUser`, `dailyAvailableHours`, `healthFlags` gate the companion arc state machine (`lib/companion/arcStateMachine.ts`). Nothing under `app/api/listen/` or `lib/listener/` may write UCP; *reading* UCP is fine. The Listener's drive sense lives in `ConsultSession.insights.driveCandidate` only. When the Listener needs `tryProposeGoal`, it passes a synthetic `companionProfile` *parameter* built from insights — the function only reads two fields off the param and performs no UCP queries or writes.
- **`ConsultSession`/`ConsultMessage` require `(db as any)`** — added in migration `20260611000000_add_consult_session`; same stale-client pattern as `Notification`/`WorkflowStepAssignee` until a full `prisma generate` runs.
- **Listener insights JSON has no goal field — do not add one** — goal candidates flow exclusively through the `ProfileProposal` mechanism (`tryProposeGoal` → client Yes/No card → `POST /api/self/profile-proposal`). Storing a goal in `ConsultSession.insights` would create a second, unvalidated write path into the user's goals.
- **Crisis input in the Listener is a SOFT OVERRIDE, never a guardrail BLOCK** — a canned redirect is the worst possible response to "I want to hurt myself". `scanInputCrisis()` (`lib/ai/guardRail.ts`) is a separate function from `scanInput`; do not merge crisis patterns into `BLOCK_PATTERNS` or route crisis hits through the blocked-reply path. Crisis latches `ConsultSession.crisisFlag` and switches the prompt + UI banner; the model still responds with warmth. `/api/chat` does not use crisis scanning at all.
- **contextLoader section names must match `\w+`** — the parser regex is `/\[SECTION:\s*(\w+)\]([\s\S]*?)\[\/SECTION\]/g` (`lib/ai/contextLoader.ts`). A section named with spaces, hyphens, or unicode silently fails to parse and `loadSection()` returns `""` — the prompt block just disappears with no error. Verify new sections against the regex before shipping.
- **`pdf-parse`/`pdfjs-dist` needs native canvas (`@napi-rs/canvas`) and browser globals (`DOMMatrix`, `ImageData`, `Path2D`) absent on Vercel serverless** — `lib/documents/parseDocument.ts` previously used `pdf-parse` for PDF text extraction; it worked on localhost but crashed in production with `ReferenceError: DOMMatrix is not defined` / `Cannot find module '@napi-rs/canvas'` (PDFPARSE-1). Fixed by switching to **`unpdf`** (`getDocumentProxy()` + `extractText(pdf, { mergePages: false })`) — a serverless pdfjs build with zero native deps, text-extraction only. Do not reintroduce `pdf-parse` for text extraction. **`pdf-parse` is still a dependency** — `lib/documents/ocrPages.ts` uses its `getScreenshot()` to render scanned pages to PNG for vision-OCR (no `unpdf` equivalent exists); that path may have the same crash risk and is unverified in production. See `docs/modules/document-reader.md`.
- **`DATABASE_PRISMA_URL` is the primary Prisma connection, not `DATABASE_URL`** — `schema.prisma` sets `url = env("DATABASE_PRISMA_URL")` (the Neon PgBouncer pooler) and `directUrl = env("DATABASE_URL")`. Neon's session default is IST; without `&options=-c%20timezone%3DUTC` on all three connection strings, every `createdAt`/`updatedAt` is stored 5:30h ahead of UTC and notification timestamps appear hours wrong. Local `.env.local` is fixed — **Vercel env vars must also include the parameter or prod will regress**.
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
- **`Order.pickupConfirmedAt` was added via raw `ALTER TABLE`, not `db push` or a migration file** — `npx prisma db push` currently wants to drop the unrelated generated column `Block.search_vector` (PRODSEARCH-1's tsvector index) because it isn't modeled in `schema.prisma`; doing a full `db push` right now would destroy that index's data. Add columns with `npx prisma db execute --stdin` instead until that drift is resolved. Same stale-client situation as the other delivery scalar fields above — use `prisma.$queryRaw`/`$executeRaw` for this column until a full `prisma generate` runs.
- **`Store.deletedAt` / `Page.deletedAt` were also added via `db push`, not a migration file** — same situation as the delivery fields above; no migration SQL exists for these two columns. If the DB is ever reset from migrations, re-add them with `db push`. See `### Store Soft-Delete` and `docs/modules/store-deletion.md` for the full soft-delete + action-guard system built on top of them.
- **`BusinessIdeaGoal` and `Todo.assumptionKey` require raw SQL** — both added via Neon MCP migration (BIZDOC-5). The DLL engine does not know about them until a full `npx prisma generate` (server stopped). `BusinessIdeaGoal` queries use `$queryRaw`/`$executeRaw` in `app/api/business/idea/goals/route.ts`. `db.todo.assumptionKey` is typed (--no-engine ran) but only works at runtime after full regenerate.
- **`Todo.freq` is for schedule frequency only — do not put assumption keys in it** — the BIZDOC-4 pattern of storing "sam"/"som" in `freq` was corrected in BIZDOC-5. Use `assumptionKey` for market-sizing assumption discrimination. Existing rows were migrated.
- **`Todo.hobbyId` is an orphaned FK** — references a `Hobby` model that does not exist in schema. The column exists in the DB but is always null. Do not add FK constraint or a Hobby model without deliberate planning.
- **`UserCompanionProfile.healthFlags` is `String[]` with NO `@default([])` and is `NOT NULL` at the DB level** — any `(db as any).userCompanionProfile.create(...)` that omits `healthFlags` throws an unhandled `PrismaClientKnownRequestError` (`P2011 Null constraint violation on the fields: (healthFlags)`) — this was the actual cause of the `POST /api/companion/nudge` 500 (NUDGE-500-FIX-1): every brand-new user has no profile row, so the create-on-first-acknowledge path fired and crashed unconditionally (not a flaky race — 100% reproducible for any user without an existing profile). Always pass `healthFlags: []` explicitly on create. Both `app/api/companion/nudge/route.ts` and `app/api/companion/session/route.ts` do a find-then-create on the same unique `userId` and can race (P2002) when both fire close together (e.g. opening companion mode + the first session save) — both now use `upsert` instead of `findUnique`+`create` to make profile creation atomic. Wrap all `UserCompanionProfile` DB operations in try/catch with a graceful fallback — a nudge is non-critical and must never 500 the page.
- **`/api/self/todos/stats` does not exist** — `components/SelfAnalyticsDashboard.tsx` calls this route; it 404s silently. The analytics page at `app/(with-nav)/self/analytics/page.tsx` is rarely visited so the impact is low.
- **`Order.assignedToId` and `Order.vehicleId` are NOT Prisma relations** — both are plain `String?` fields. `assignedToId` stores a `Collaboration.id`; `vehicleId` stores a `Vehicle.id`. Resolve them manually; do not use Prisma `include` or `connect` on them.
- **There are FOUR owner-assignment branches in `delivery/route.ts` PATCH and ALL must fire `order_assigned` notifications** (NOTIFY-FAST-1) — (1) user-type/team assignment (`{ userId }`, ~line 360) notifies; (2) collab-based partner assignment (`{ assignedToId }`, ~line 421) now notifies — this was the gap (DELIV-ENGINE-AUDIT-1 found it skipped notification entirely; the partner got the assignment with no alert); (3)/(4) the `partnerAction`/auto-dispatch paths (`assignNextPartner`) already notified. When adding a fifth assignment path, mirror the existing `createNotification({ type: "order_assigned", title: "Delivery assigned to you", link: "/earn/deliveries" })` shape and fire it AFTER the successful `order.update`, not before.
- **`createSubOrder` must write the ASSIGNEE's `userId`, not the parent/customer's** — `lib/workflow/createSubOrder.ts` previously set `userId: parent.userId` (the customer) on the sub-order row. This made the sub-order invisible to the partner's "Assignments" view (`/app/orders` filters `buyerOrders` — fetched via `GET /api/store/orders` `where: { userId: user.id }` — by `parentOrderId != null`) and incorrectly surfaced it under the *customer's* buyer-orders fetch instead. Fixed (NOTIFY-FAST-1) to `userId: assigneeUserId`; the dedup check (`findFirst` before create) was updated to match on `assigneeUserId` too. The customer continues to see only the PARENT order; the partner now sees the SUB-order under Assignments.
- **`Order.vehicleId` is NOT cleared when the vehicle broadcast stops** — the partner's `stop()` call deletes the `Vehicle` row but leaves `Order.vehicleId` set. The tracking page handles this correctly because the vehicles API filters by `updatedAt >= 2 min ago`, so a deleted vehicle returns no rows and the map shows no marker.
- **Delivery partner PATCH is restricted** — partners can only send `partnerAction`, `deliveryStatus`, or `vehicleId`. Any attempt to send `assignedToId` or `deliveryNote` from the partner returns 400. The owner UI must not expose those fields to partners.
- **`partnerStatus` is always derived server-side** — never send `partnerStatus` directly from the owner UI. Set `assignedToId` and the API sets `partnerStatus = "assigned"` automatically. Partners use `partnerAction: "accept" | "reject"`. The only client-set `partnerStatus` value is `"completed"` (sent by `DeliveriesClient` on mark-delivered, but also auto-set by the API when `deliveryStatus = "delivered"`).
- **Quote-accept must gate delivery-pipeline writes on `activityType === "delivery"`** (DISPATCH-FIX-1) — `POST /api/order/[id]/quote/[quoteId]/accept` only writes `assignedToId`/`partnerStatus: "assigned"` onto the parent `Order` when the accepted quote's step has `activityType === "delivery"` (read via the same raw-SQL pattern as `confirm/route.ts:32-35`). Quotes now also apply to `third_party` **normal/service** steps — an accepted quote there must NOT be treated as a delivery dispatch (it would otherwise funnel the assignee into `/earn/deliveries` GPS dispatch). Normal/service quote-accepts rely solely on `createSubOrder({ subOrderType: "service" })` + its `order_assigned` notification; the parent order's delivery fields stay untouched. `/earn/deliveries` mirrors this: its raw SQL queries fetch the active step's `activityType` and filter out rows whose active step is explicitly non-delivery — but never filter out rows where `activeStepId`/`activityType` is null/absent (that would risk hiding a real delivery assignment during the timing window before the OSP row goes `'active'`).
- **Quote/negotiation is conceptually a SEPARATE interaction from normal-step confirm and delivery dispatch** (QUOTE-DOCTRINE-NOTE) — it is multi-round and two-sided (request → respond → accept/reject/counter), unlike the linear single-actor step flows. DISPATCH-FIX-1 already de-coupled quote-accept from delivery dispatch (gated on `activityType`). Do NOT re-entangle quote logic into the normal/delivery dispatch paths. A dedicated quote block (QUOTE-BLOCK-1) is deferred; until then the existing quote endpoints are sufficient for users to self-handle, but the conceptual separation must be preserved in any future change touching `accept/route.ts` or step assignment.
- **`Collaboration` PATCH must include page relations in the response** — `prisma.collaboration.update` without an `include` returns only flat fields. The frontend reads `updated.requester.title` / `updated.receiver.title` to optimistically add the accepted partner to the active list. Omitting the include causes a `Cannot read properties of undefined (reading 'title')` crash.
- **`Collaboration.receiverId` must be a `Page.id`** — the API resolves Store IDs and store slugs to their linked `pageId` automatically, but stores with `pageId: null` cannot participate. Pages created outside the normal `openStore()` flow may have no linked store pageId.
- **Never call `navigator.geolocation` directly in new code** — always use `useGeolocation()` from `hooks/useGeolocation.ts`. The hook tries Capacitor first (works in the Android/iOS native shell) and falls back to the browser API automatically. Direct `navigator.geolocation` calls will silently fail on Android when the Capacitor plugin is expected. `TransportMap.tsx` still uses the browser API for its one-shot centering call — that is the only permitted exception.
- **`geocodeSearch` (MAP-SEARCH-1b) uses Photon (`photon.komoot.io`), not Nominatim — and returns an array, not a single object** — `lib/geo/geocode.ts`'s `geocodeSearch(query, bias?)` now resolves `Promise<Array<{lat,lng,label}>>` (up to 5 candidates), used only by the errand pickup/drop `TempPicker` in `app/app/requests/page.tsx`. **Photon's GeoJSON `geometry.coordinates` is `[lon, lat]` order** — swapping it silently lands the pin in the wrong place (often the ocean) with no error. `geocodePincode` and `reverseGeocode` are untouched and still call Nominatim.
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
- **The per-order assignment dropdown in `app/store/orders/all/page.tsx` enumerates BOTH user-type and page-type collabs** — team members (receiverUserId set) are loaded from `/api/initiative/[pageId]/team`; partners (receiverPageId set) come from `/api/collaboration?direction=out&status=accepted`. The two groups are rendered as separate `<optgroup>` elements ("Team Members" / "Partners"). Selecting a team member sends `{ userId }` to the delivery PATCH route (sets `assignedToUserId`); selecting a partner sends `{ assignedToId: collabId }`. These are distinct backend paths — do NOT send a user-type collab ID as `assignedToId` because `resolveAssignedCollab` resolves `receiverPage.ownerId` for auth (null for user-type collabs), which would make `isPartner` false and break partner-side delivery actions. This per-order assignment is an override only — it does NOT write to `WorkflowStep` or `WorkflowStepAssignee`.
- **`GET /api/store/orders?all=true` does NOT return `assignedToUserId`** — it uses the typed Prisma client which does not include this db-push column. After a user-type assignment is made in the current browser session it is tracked in React state; on page reload the dropdown shows "Unassigned" for any order where only `assignedToUserId` was set. Fix: add a raw-SQL augmentation pass to the all=true branch of `app/api/store/orders/route.ts` (similar to the `requiresAttention`/`quoteSummary` raw SQL block).
- **WorkflowSection has four distinct states — do not merge them** — (A) no `initiativeId` on the store: show the "no workflow" setup link; (B) `initiativeId` set but order not yet confirmed: show "confirm to activate"; (C) `activeStep` present: show step chip + **"Mark Complete ✓"** (normal step) or **"Confirm Dispatch 🚚"** (delivery step) or quote list; (D) `partnerStatus === "rejected"` with `activeStep`: show rejection panel + Retry Step. Collapsing these states or adding an early-return before all four checks will hide workflow controls.
- **WorkflowSection no longer collapses after a delivery dispatch (OWNER-DELIV-VIEW-1)** — delivery is the FINAL step, so confirming it flips its OSP from `"active"` to `"confirmed"`/`"failed"` and `activeStep` becomes `null`; the section's "nothing to show" gate used to read that as "workflow complete" and `return null` the entire block, hiding the STEPS list and any delivery view at the exact moment the owner most needs to watch the order. The gate now keeps the section open via an explicit `isPostDispatch` condition (`deliveryStep exists && its OSP status is "confirmed"|"failed" && order/deliveryStatus isn't "cancelled"`) — keyed off the delivery step's own OSP status rather than `Order.deliveryStatus` alone, because `confirm/route.ts` flips `deliveryStatus` to `"out_for_delivery"` in the same beat it confirms the OSP, *before* `assignNextPartner` runs (so OSP status is the more honest "has dispatch happened?" signal either way). The numbered STEPS list (OWNER-STEPVIEW-1) renders through this state too — its delivery row's label is derived honestly from `deliveryStatus` (`"Out for delivery 🚚"` / `"Delivered ✓"` / `"Dispatched ✓"`) instead of the generic `"Done ✓"`, which would falsely read as "arrived".
- **Owner reuses the customer's exact tracking component for the post-dispatch map** — while `deliveryStatus === "out_for_delivery"`, `WorkflowSection` renders a "DELIVERY TRACKING" block built from the **same** `TransportMap` (`@/components/transport/TransportMap`, dynamically imported `ssr: false`) and the same `GET /api/transport/vehicles?id=` 5-second poll the customer already uses on `/order/[id]/track` — no second tracking system. Three honest states, never a blank/broken map: assigned + GPS live → map with `deliveryStep.assigneeName` as the partner label; assigned but no `vehicleId` yet → "Delivery partner hasn't started GPS yet."; nothing in `Order.assignedToId` → amber "Awaiting delivery partner assignment — no partner has accepted this dispatch yet." (the genuinely-no-partner / escalation outcome from `assignNextPartner`, still under separate audit — this view is correct regardless of how that audit resolves).
- **"Mark Complete ✓" vs "Confirm Dispatch 🚚"** — the confirm button in `WorkflowSection` is labelled by `activeStep.activityType`: `"normal"` → "Mark Complete ✓" (teal); `"delivery"` → "Confirm Dispatch 🚚" (dark teal). Both call the same `/api/order/[id]/step/[stepId]/confirm` endpoint — the branching happens server-side (WORKFLOW-1).
- **⚡ Complete All (N) stops at delivery steps** — `startFastTrack` in `WorkflowSection` filters out steps where `activityType === "delivery"`. The count N reflects only normal steps remaining. When the active step is delivery (or no normal steps remain), "Complete All" is hidden and only "Confirm Dispatch" is shown. Do not remove the `activityType !== "delivery"` filter.
- **"Reassign / assign manually" is a collapsed `<details>`** — the manual delivery assignment dropdown (collab + team member) is hidden under a `<details>/<summary>` disclosure. It is an override path; the primary dispatch path is "Confirm Dispatch" via the workflow. Do not promote it back to an always-visible primary control.
- **`WorkflowStep.activityType` is a new column — read via `$queryRaw`** — added via migration `20260605000000_add_workflow_activity_type`. The Prisma client may not know about it until the next full `prisma generate` (stop server first on Windows). Always fetch it with `` prisma.$queryRaw<{activityType:string}[]>`SELECT "activityType" FROM "WorkflowStep" WHERE id = ${stepId}` `` and fall back to `"normal"`. Do NOT add it to a typed `select` block while the client may be stale.
- **`activityType === "delivery"` steps can ONLY be confirmed by the store owner** — delivery steps have no pre-assigned partner at activation time. `assignNextPartner` runs at confirm-time (dispatch), not at activation-time. Do not allow partners to confirm delivery steps.
- **`createSubOrder` is now called ONLY for delivery steps** — it is invoked inside `assignNextPartner`, which is only called from the confirm route when `activityType === "delivery"`. Normal steps use `assignNormalStep` (no sub-order). Do not add `createSubOrder` calls to normal-step activation paths.
- **Both order pages render `deliveryStatus` as a read-only display — neither may mutate it via click (CONFIRM-PARITY-FIX-1)** — `/store/[id]/orders` (page B, the per-store surface) has no `onClick` on its 5-step stepper pills; only Cancel fires `onPatch`. `/store/orders/all` (page A, cross-store) previously had a clickable "next step +" pill that PATCHed `/api/order/[id]/delivery { deliveryStatus }` directly with no `activityType` awareness — this force-dispatched **normal** workflow steps as if they were delivery steps (the root cause of the A/B mis-dispatch bug; CONFIRM-PARITY-AUDIT-1). That control was stripped; A's stepper is now plain badges, matching B. **Page A = read-only cross-store monitor + funnel to B; Page B = the one true confirm/workflow surface.** Do not add click handlers that mutate `deliveryStatus` to either page — the workflow system (`activateWorkflow`/`advanceToNextStep`/`assignNextPartner`, gated by `activityType`) is the only thing that may advance it, plus the owner's explicit "Confirm Step"/"Confirm Dispatch" actions on page B. The assignment dropdown and delivery note on B remain editable for manual override; A keeps them too, but **only** for orders with a genuine legacy delivery assignment (see next note) — for normal-step orders A shows a read-only OSP-sourced assignee + a "Manage on store page →" link into B instead.
- **`Order.assignedToId`/`assignedToUserId` are delivery-only — never use them to display normal-step assignment** — these legacy fields are written exclusively by the delivery dispatch path (`assignNextPartner` / manual `{ assignedToId }`/`{ userId }` delivery PATCH). Normal-step assignment lives on `OrderStepProgress.currentAssigneeId` (set by `assignNormalStep`), surfaced to the frontend as `activeStep.assigneeName` in `GET /api/store/orders?storeId=X`. Reading `assignedToId`/`assignedToUserId` for a normal-step order returns `null` and renders a misleading "Unassigned" even though the engine already auto-assigned someone (CONFIRM-PARITY-FIX-1 fixed this on page A — it now branches on whether a legacy delivery assignment exists before falling back to legacy-field display).
- **Workflow assignee dropdown includes ALL accepted collabs** — `GET /api/initiative/[pageId]/workflow` returns assignees from any collaboration scope (`partner`, `team`, `third_party`) as long as `status = "accepted"`. An earlier version filtered to `scope IN ("team","third_party")` only, which caused delivery partners (scope="partner") to disappear from the dropdown. Do not re-introduce the scope filter.
- **`WorkflowTab` activityType selector persists via PATCH** — the "Normal work" / "Delivery (GPS)" pill buttons in each `StepCard` call `onUpdate(step.id, { activityType })` which PATCHes `/api/initiative/[pageId]/workflow/[stepId]`. The PATCH route handles `activityType` via `$executeRaw` (old engine DLL won't include the field in a typed Prisma update). The selector shows different help text per type: delivery = "Delivery steps assign a courier and share live GPS with the customer." normal = "Normal steps just need a completion tap." Seeded "Dispatch & Deliver" steps start as `"delivery"` automatically. New steps added via "Add Step" start as `"normal"`.
- **`GET /api/orders/requests` is separate from `GET /api/store/orders`** — it returns Quote rows (not Order rows) addressed to the current user's collaborations. Do not confuse it with the buyer/seller order list endpoints.
- **`WorkflowStep.assigneeId` and `assigneeIds` are deprecated — use `WorkflowStepAssignee` rows** — the scalar fields still exist in the schema for backwards compatibility but new code must add assignees via `POST /api/initiative/[pageId]/workflow/[stepId]/assignees`. `assignNextPartner` reads only `WorkflowStepAssignee` rows. `triggerQuoteRequests` was fixed (May 2026) to also read only `WorkflowStepAssignee` rows — previously it read the deprecated scalar fields. The step-confirm route also checks `WorkflowStepAssignee` membership for partner auth. **A step with zero `WorkflowStepAssignee` rows no longer sets `requiresAttention`** — `activateWorkflow` and `advanceToNextStep` now call `ensureOwnerAssignee(pageId, stepId)` first, which creates a self-team `Collaboration` for the initiative owner (scope="team", teamRole="founder") and a `WorkflowStepAssignee` row, then proceeds with the normal `assignNextPartner` cycling. This means every store owner is automatically the fallback assignee for steps they have not yet configured. Retroactive backfill: run `npx ts-node --project tsconfig.scripts.json scripts/backfill-owner-assignees.ts`.
- **`WorkflowStepAssignee` requires `(prisma as any).workflowStepAssignee`** — the model was added after the last successful `prisma generate`. Use the `any` cast until generate runs. Same pattern as `Notification` and `Order` new fields.
- **`assignNextPartner` falls back to owner's default address for distance** — if either the delivery address or the store owner's default address lacks `lat/lng`, `distanceKm` is 0 and all per-km cost components are zero. Address coordinates are captured by `AddressForm` but only if the user confirms the map pin — they are optional.
- **`assignNextPartner` routes user-type WSA collabs via `assignedToUserId`, NOT `assignedToId` (DELIV-DISPATCH-FIX-1)** — when the resolved `partnerUserId` comes from a `WorkflowStepAssignee` whose backing `Collaboration` has `receiverPage: null` (i.e. a page-to-user collab — including the owner self-team collab created by `ensureOwnerAssignee`), `assignNextPartner` writes `Order.assignedToUserId = partnerUserId` and nulls `assignedToId`. For page-type collabs (`receiverPage` set), the existing `assignedToId = collabId` path is unchanged. The root cause of the pre-fix bug: writing a self-team collab's ID into `assignedToId` made the order invisible to `/earn/deliveries` because that page's `rawCollabOrders` query filters by `receiverPageId IN pageIds` (null `receiverPageId` never matches), and `rawPersonalOrders` queries `assignedToUserId`, not `assignedToId`. After the fix, self-delivery orders surface in `rawPersonalOrders` like any other user-type assignment.
- **`isOwnerAsPartner` in `delivery/route.ts` — owner-as-delivery-person can accept/reject/GPS from /earn/deliveries** — when `isOwner && order.assignedToUserId === userId`, the PATCH handler computes `isOwnerAsPartner = true`. The partner block (`accept`/`reject`/`vehicleId`) is then entered for explicit partner actions (`partnerAction != null`) or vehicleId patches. All other owner-only fields (`deliveryNote`, manual `deliveryStatus`, `assignedToId`) fall through to the owner section. Reject for `isOwnerAsPartner` cycles via OSP lookup (not the collab-based lookup that collab-partners use, since `assignedToId` is null in this path) — it queries the delivery-step OSP directly from the order's `OrderStepProgress`, nulls `assignedToUserId`, and calls `assignNextPartner` to cycle to the next WSA row. **Do not revert to writing `assignedToId = collabId` for user-type WSA collabs** — that was the audited root cause (DELIV-DISPATCH-AUDIT-1).
- **The collab-partner reject→cycle OSP lookup must derive `(orderId, stepId)` from `order.assignedToId`, NOT `findFirst({ status: "active" })`** (CYCLE-FIX-1) — by the time a partner can reject, the delivery-step OSP is already `status: "confirmed"` (set in `confirm/route.ts` *before* `assignNextPartner` runs on first dispatch), so a status-`"active"` lookup in `delivery/route.ts` always returns null and cycling/fee-hike/escalation silently never fire (CYCLE-AUDIT-1 root-caused this). The fix: read the just-rejected `order.assignedToId` (captured before it's nulled), join `WorkflowStepAssignee` → `WorkflowStep` filtered to `activityType = 'delivery'` to get `stepId`, then `findUnique({ where: { orderId_stepId: { orderId, stepId } } })` — the `@@unique([orderId, stepId])` constraint makes this unambiguous. **Do not restore OSP `status` to `"active"` on reject** — `assignNextPartner` only touches `currentAssigneeId`/`cycleCount`/`lastFeeMultiplier` and is status-agnostic; restoring `"active"` would be a regression, not a fix.
- **`/api/user/me` returns `{ ok: true, user: { id, name, ... } }` — user data is nested under `user`, not at the top level. Always access `json.user.id`, not `json.id`.**
- **`navigator.clipboard` is undefined on HTTP (local dev)** — `navigator.clipboard.writeText()` throws `TypeError: Cannot read properties of undefined` on plain HTTP. It only works on HTTPS or `localhost`. Do not add HTTP fallbacks — test the share/copy feature on `charaivati.com` (HTTPS) instead.
- **Store public URL requires `Store.id` or `Store.slug` — never use `Page.id` as a store URL** — `/store/[id]` resolves a Store record, not a Page. Using a Page ID in the URL returns 404. Always resolve: `SELECT id, slug FROM "Store" WHERE "pageId" = $pageId` and build the URL from the result.
- **A Fleet initiative's services are invisible on the generic customer Store page (`/store/[id]`) — `/fleet/[pageId]` is the only customer-facing surface that works (FLEET-ORDER-1 investigation)**. Root cause: `/fleet/[pageId]` is keyed by `Page.id`; the customer Store page is keyed by a *different* id, `Store.id`/`Store.slug` (a Store row auto-created behind every Fleet page, per `### Fleet Initiative Type`). `app/store/[id]/page.tsx` (`productBlocks = section.blocks.filter(b => b.serviceType !== "delivery")`, line ~243) and `app/store/[id]/section/[sectionId]/page.tsx` (same filter, ~line 1021) both deliberately hide every `serviceType: "delivery"` block from the customer view — Fleet's entire "Fleet Services" section is 100% delivery blocks, so it renders as `return null` (section vanishes) on the storefront and as zero products on the section deep-link. This filter is intentional for *normal* stores (delivery blocks there are internal courier-assignment blocks, never meant to be customer-orderable) but it collaterally hides Fleet's customer-facing services when reached via the wrong URL. **`GET /api/store/all` already excludes every Fleet-backed Store by default** (FLEET-ORDER-1 fix) so this dead link can't surface via `/app/discover` or an unfiltered `/app/saved` fetch. **`/app/saved` Browse → Stores (FLEET-DISCOVER-1) opts back in via `?includeFleet=1`** and links those rows to `/fleet/[pageId]` (never `/store/[id]`) — see `### Store Discovery` above. **Still open**: (a) `/app/discover`'s map has no fleet entry point (fleets have no plottable product list, so this is lower priority), and (b) a stray direct/shared `/store/{storeId}` URL for a fleet venture still renders empty — `/store/[id]/page.tsx` does not redirect to `/fleet/[pageId]` when `store.pageType === "fleet"` (same precedent as the slug→cuid canonical redirect would apply here). Until (b) lands, never hand-construct a `/store/[id]` link for a fleet venture.

## Store Initiative System

### Data Models

**`Collaboration` (extended)**
Added fields: `scope String @default("partner")` (`"team" | "third_party" | "partner"`), `initiativeId String?`, `teamRole String?` (`"founder" | "co_founder" | "ceo" | "partner" | "employee" | "custom"`), `customRole String?`. Promoting a Collaboration to `scope="team"` via `PATCH /api/initiative/[pageId]/team/[collaborationId]` makes it a team member. Scope `"partner"` is the default for external partners.

**`WorkflowStep`**
Fields: `initiativeId` (Page.id of the linked initiative), `name`, `sequence`, `assigneeType` (`"team_member" | "third_party"`), `quoteRequired Boolean`, `quoteTimeoutHours Int @default(24)`, `assignmentMode String @default("sequential")` (`"sequential" | "first_to_accept"`), `activityType String @default("normal")` (`"normal" | "delivery"`). Steps are ordered by `sequence`; `initiativeId` matches `store.pageId` for stores that have linked initiatives. **`assigneeId String?` and `assigneeIds String[]` are `@deprecated`** — use `WorkflowStepAssignee` rows instead (see below); kept for existing data only.

**`activityType` — normal vs delivery branching:** Controls how a step's *confirmation* behaves. `"normal"` steps advance the workflow to the next OSP without touching `deliveryStatus`; confirming one is lightweight (no sub-orders, no GPS handoff). `"delivery"` steps represent the dispatch point: confirming one sets `Order.deliveryStatus = "out_for_delivery"` and immediately calls `assignNextPartner` (which creates a sub-order and notifies the delivery partner). **Backfill rule:** the last step (highest `sequence`) per initiative is automatically set to `"delivery"`; all others default to `"normal"`. New steps added via the API default to `"normal"` until the owner changes them. `activityType` was added via migration `20260605000000_add_workflow_activity_type` — use `$queryRaw` to read it while the Prisma client is stale.

**`WorkflowStepAssignee`**
Replaces the deprecated `assigneeId`/`assigneeIds` scalar fields on `WorkflowStep`. One row per (step, collaboration) pair. Fields: `stepId`, `collaborationId` (Collaboration.id), `sequence Int` (controls order in sequential cycling), `costPerOrder Float?`, `costPerKg Float?`, `costPerKgPerKm Float?`, `costPerItemPerKm Float?`. `@@unique([stepId, collaborationId])`. Cascade-deletes when the step or collaboration is removed. Cost fields override the same-named fields on `Collaboration` for this assignee's cost calculation.

**`OrderStepProgress` (OSP)**
One row per (Order, WorkflowStep) pair. `status`: `"pending" → "active" → "confirmed" | "failed"`. `@@unique([orderId, stepId])`. Created in bulk by `activateWorkflow`; the active step drives delivery assignment and quote requests. Additional fields for partner cycling: `currentAssigneeId String?` (the `WorkflowStepAssignee.id` currently being tried), `cycleCount Int @default(0)` (how many full rejection cycles have completed), `lastFeeMultiplier Float @default(1.0)` (fee multiplier for the current cycle; increases 5% per cycle).

**`Quote`**
One row per (Order, step, party). `requestedPartyId` is a `Collaboration.id`. `status`: `"pending" → "submitted" → "accepted" | "rejected"`. `expiresAt` is set to `now() + quoteTimeoutHours`. `Order.quoteSummary Json?` stores the owner-preferred ordering `[{ quoteId, partyName, amount, status }]`.

**`Order` (new fields)**
`requiresAttention Boolean @default(false)` — set when a step fails or a quote times out; visible as a red banner in the owner order page. `quoteSummary Json?` — rebuilt sorted by amount on every quote response. `parentOrderId String?` — self-FK; set on sub-orders created per workflow step. `subOrderType String?` — `"delivery" | "service" | "packaging"`. `agreedAmount Float?` — the accepted quote amount or fixed assignment fee for a sub-order.

**`Notification`**
Fields: `id`, `userId` (FK → User, cascade delete), `type` (`"order_assigned" | "quote_requested" | "quote_submitted" | "step_confirmed" | "order_confirmed" | "out_for_delivery" | "delivery_complete" | "order_cancelled" | "escalation" | "workflow_attention" | "collaboration_ended" | "collaboration_request" | "friend_reminder" | "request_broadcast_created" | "request_response_submitted" | "request_accepted" | "request_rejected"`), `title`, `body`, `link String?`, `read Boolean @default(false)`, `createdAt`. Index on `userId` and `createdAt`. (The four `request_*` types are the REQBCAST-1c broadcast-engine notifications — see `### Request Broadcast Engine`.) (`type` is a plain `String` column, not a DB enum — `collaboration_ended` was added by `softDeleteStore` for the partner-notified-on-venture-close flow; see `### Store Soft-Delete`.) `collaboration_request` (COLLAB-INVITE-NOTIFY-1) is fired by `POST /api/collaboration` to the receiver page's owner when a page-to-page partner request is created — links to `/earn/initiative/[receiverPageId]?tab=partners`. Fire-and-forget; failures don't fail collaboration creation. `friend_reminder` (PRIV-ACT-1) is fired by `POST /api/listen/actions/reminder` — the Listener's deterministic reminder action — to an existing friend; `body` is the sender's reminder text, `title` is `"Reminder from {senderName}"`, no `link`. **`POST /api/initiative/[pageId]/team/invite-user` (direct friend → team-member, auto-`accepted`) does NOT notify** — flagged as a follow-up, not fixed here. Feature A's `POST /api/invite` (email friend invite) and `POST /api/admin/users` deliberately do not send this notification type — unrelated flows with their own (generic-response / admin-log) patterns.

### Helper Files

| File | Purpose |
|---|---|
| `lib/workflow/activateWorkflow.ts` | Called when `Order.status → "confirmed"`. Creates all OSP rows as `"pending"`, activates step 1. For **normal** steps: calls `assignNormalStep` (set currentAssigneeId + notify, no sub-order). For **delivery** steps: activates OSP only — confirm route handles dispatch. For quote steps: fires `triggerQuoteRequests`. |
| `lib/workflow/advanceToNextStep.ts` | Called after a **normal** step is confirmed. Finds the next step by sequence, activates its OSP. If the next step is **normal**: calls `assignNormalStep`. If the next step is **delivery**: activates OSP only (confirm route dispatches). If no next step: returns (customer confirm sets `"delivered"`). Never touches `deliveryStatus`. |
| `lib/workflow/assignNormalStep.ts` | Assigns the first `WorkflowStepAssignee` (by sequence) to a normal step: sets `OSP.currentAssigneeId` and fires `order_assigned` notification (link: `/app/orders?tab=tasks`). Does **not** create sub-orders — the active OSP row is itself the confirmable task record, surfaced via `GET /api/orders/tasks` (TASK-SURFACE-1). Called by `activateWorkflow` and `advanceToNextStep` for normal steps. |
| `lib/workflow/assignNextPartner.ts` | Sequential partner cycling for **delivery** steps only. Reads `WorkflowStepAssignee` rows in `sequence` order. If all are rejected: increments `cycleCount`, applies 5% fee hike (`lastFeeMultiplier *= 1.05`), restarts from the top. After 3 full cycles: sets `requiresAttention = true`, fires `escalation` notification. Also calculates delivery cost, creates a sub-order, and notifies the partner. Called exclusively from the confirm route when `activityType === "delivery"`. |
| `lib/workflow/triggerQuoteRequests.ts` | Creates `Quote` rows for all parties in `assigneeId + assigneeIds`, sends a system chat message (`iv="system"`) to each party, fires a `quote_requested` notification, and registers an in-process `setTimeout` to reject un-responded quotes after `quoteTimeoutHours`. |
| `lib/workflow/createSubOrder.ts` | Creates a child `Order` row for a workflow step assignee (copies parent items/address, sets sub-order type and agreed amount), then fires an `order_assigned` notification. Called from `assignNextPartner` (delivery steps) and from `accept/route.ts` (quote steps). Idempotent. |
| `lib/workflow/calculateDeliveryCost.ts` | Computes delivery cost from `{ costPerOrder, costPerKg, costPerKgPerKm, costPerItemPerKm }` pricing fields plus `totalWeightKg`, `totalItems`, `distanceKm`. Returns 0 if all pricing fields are null. Called by `assignNextPartner`. |
| `lib/workflow/ensureOwnerAssignee.ts` | `ensureOwnerAssignee(pageId, stepId)` — idempotent. Finds or creates a self-team `Collaboration` (`scope="team"`, `teamRole="founder"`, `receiverUserId=page.ownerId`) and a `WorkflowStepAssignee` row (sequence=0) for the given step. Called by `activateWorkflow` and `advanceToNextStep` when a normal step has no configured assignees. Backfill existing steps via `scripts/backfill-owner-assignees.ts`. |
| `lib/geo/haversine.ts` | `haversineKm(lat1, lng1, lat2, lng2)` — great-circle distance in km. Used by `assignNextPartner` to measure store-to-delivery-address distance. |

### Key Flows

**Order confirm → workflow activate**
1. `PATCH /api/store/orders/[orderId]` sets `status="confirmed"`
2. `activateWorkflow(orderId)` fires fire-and-forget
3. All OSP rows created as `"pending"`; step 1 set `"active"`
4. If step 1 is `activityType === "normal"` (non-quote): `assignNormalStep` sets first assignee + notifies (no sub-order, no `deliveryStatus` change)
5. If step 1 is `activityType === "delivery"`: OSP activated only — owner confirms when ready to dispatch

**Normal step confirm → auto-advance**
1. `PATCH /api/order/[id]/step/[stepId]/confirm` (owner or step assignee; confirmed by WSA-row check first, deprecated scalar fallback)
2. OSP row set `"confirmed"`; `advanceToNextStep` called
3. Next step OSP set `"active"`. If next step is `"normal"`: `assignNormalStep`. If next step is `"delivery"`: OSP activated only. Never sets `deliveryStatus`.
4. If next step has `quoteRequired=true`: `triggerQuoteRequests` fires immediately

**Delivery step confirm → dispatch**
1. `PATCH /api/order/[id]/step/[stepId]/confirm` — **owner only** (delivery steps have no pre-assigned partner)
2. OSP row set `"confirmed"`; `Order.deliveryStatus = "out_for_delivery"`
3. `assignNextPartner` runs: cycles through `WorkflowStepAssignee` rows, picks first available partner, creates sub-order, notifies partner

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

`Notification` rows are created by `lib/notifications/createNotification.ts` in these places:
- **`triggerQuoteRequests`** → `type: "quote_requested"` to each party when a quote-step activates
- **`confirm/route.ts`** (step confirm) → `type: "order_assigned"` to the next step's assignee (fire-and-forget)
- **`store/orders/[orderId]/route.ts`** (confirm order) → `type: "order_confirmed"` to the store owner **and** to the buyer; `type: "order_cancelled"` to the buyer on cancellation. Guest buyers are skipped silently (`user.status !== "guest"` check).
- **`order/[id]/delivery/route.ts`** → `type: "out_for_delivery"` to the buyer when `deliveryStatus` becomes `"out_for_delivery"` (fires from both the owner path and the partner path). Guest buyers skipped.
- **`order/[id]/customer-confirm/route.ts`** → `type: "delivery_complete"` to the store owner (existing) **and** to the buyer. Guest buyers skipped.
- **`assignNextPartner`** → `type: "order_assigned"` to newly assigned partner; `type: "escalation"` to store owner when all partners reject after 3 full cycles
- **`order/[id]/step/[stepId]/confirm/route.ts`** → `type: "step_confirmed"` to the store owner **when the confirmer is not the owner** (fire-and-forget; triggers owner's SSE stream so order pages auto-refresh without a manual reload)

UI: `components/notifications/NotificationBell.tsx` — bell icon in `app/app/layout.tsx` top bar (left of avatar, only shown when logged in). Uses SSE stream (`GET /api/notifications/stream`) for real-time updates; falls back to 10 s polling + `visibilitychange` trigger when EventSource is unavailable. Red badge shows `unreadCount`. Click opens a dropdown of 10 most recent; "See all →" links to `/app/notifications`. Full page: `app/app/notifications/page.tsx` — groups by Today / Yesterday / Earlier; "Mark all read" button.

**Auto-refresh surfaces (LIVE-REFRESH-1)** — all reuse the same SSE stream (`GET /api/notifications/stream`); no second refresh system exists:
- **`/app/orders`** (`app/app/orders/page.tsx`) — subscribes; refreshes buyer orders + tasks on any SSE message
- **`/store/[id]/orders`** (page B, `app/store/[id]/orders/page.tsx`) — subscribes; refreshes order list on any SSE message (LIVE-REFRESH-1 fixed a dead type-filter bug; the handler previously parsed `data.type` which the stream never sends)
- **`/store/orders/all`** (page A, `app/store/orders/all/page.tsx`) — subscribes (added LIVE-REFRESH-1); lightweight orders-only re-fetch on any SSE message (pool/team data not reloaded — it doesn't change mid-session)
- **`/order/[id]/track`** (customer tracking, `app/order/[id]/track/page.tsx`) — uses `setInterval` polling on `GET /api/order/[id]/delivery` every 5 s (2 s when out-for-delivery); already auto-refreshes; **deliberately NOT wired to SSE** — customer sees status only, no internal steps, and the existing poll is sufficient
- **SSE trigger for step-confirm**: when a non-owner confirms a normal step, `step_confirmed` notification fires to the store owner → owner's SSE stream detects new notification → pages A and B both re-fetch automatically

### Initiative Hub Tabs (owner-only at `/earn/initiative/[pageId]`)

| Tab | Component | Access |
|---|---|---|
| Overview | inline in `InitiativeTabs` | all |
| Store | inline in `InitiativeTabs` | all |
| Team | `components/earn/TeamTab.tsx` | canEdit = founder / co_founder |
| Partners | `components/earn/PartnersTab.tsx` | all |
| Workflow | `components/earn/WorkflowTab.tsx` | canEdit = founder / co_founder |

`canEdit` is derived in `InitiativeTabs` by fetching `GET /api/initiative/[pageId]/team` and reading `userTeamRole`. `null` (owner without explicit team record) → `canEdit = true`.

**Team tab — two invite paths:**
- **From Partners** (existing): promotes an accepted partner-scope `Collaboration` (page-to-page) to `scope="team"` via `PATCH /api/initiative/[pageId]/team/[collaborationId]`.
- **Invite Friend** (new): directly creates a `scope="team"` `Collaboration` with `receiverUserId` set via `POST /api/initiative/[pageId]/team/invite-user { userId, teamRole, customRole? }`. Only friends of the page owner are eligible. The collaboration is created with `status="accepted"` (no request flow needed). Removing a user-type team member calls `DELETE /api/initiative/[pageId]/team/[collaborationId]` (not PATCH, since there's no partner scope to demote back to).

**Team member card rendering** — cards check `member.receiverUserId`: if set, shows the `receiverUser.name` and `receiverUser.avatarUrl` (user-type); otherwise shows `receiverPage.title` and `receiverPage.avatarUrl` (page-type, existing behaviour).

**`GET /api/initiative/[pageId]/team` response** now includes `friends: FriendUser[]` — the owner's accepted friends not already added as user-type team members. Used to populate the "Invite Friend" tab in the modal.

**Fleet initiative type** — when `pageType === "fleet"`, `InitiativeTabs` renders a dedicated `FleetTabs` branch (Overview / 🚛 Services / Partners / Workflow) instead of the standard Store tab. The "Services" tab renders `components/earn/FleetEditor.tsx`.

### Fleet Initiative Type

A Fleet initiative (`pageType = "fleet"`) represents a delivery service, cab, bike rental, or any vehicle-based fleet business. It is **not a product store** — it contains only service blocks (delivery blocks with `serviceType = "delivery"`).

**Key differences from a Store initiative:**
- No sections, tiles, bulk image upload, or product blocks
- Owner editor is inline in `app/fleet/[pageId]/page.tsx` itself (an "✏️ Edit Fleet" floating toggle on the same page) — `components/earn/FleetEditor.tsx` is **deprecated**, logic moved here
- Public page lives at `/fleet/[pageId]` (client-rendered; owner sees edit controls, visitors see a booking flow — see below)
- Blocks are still `StoreBlock` rows (with `serviceType = "delivery"`) linked to a hidden backing store — reuses all existing block/delivery APIs

**Data model:**
- `Page.pageType = "fleet"` — the discriminator
- A `Store` row is created automatically the first time `GET /api/fleet/[pageId]` is called by the owner
- One hidden `StoreSection` ("Fleet Services") is created automatically as the block container
- All blocks belong to this single section; the section is not exposed in the editor UI

**API:**
- `GET /api/fleet/[pageId]` — owner: returns `{ storeId, sectionId, blocks[], deliveryFee, freeDeliveryAbove, acceptingOrders, page }`. Creates store + section if absent. Public visitor (no auth): same shape minus `storeId/sectionId` — their absence is how the client derives `isOwner`.
- Block CRUD uses the existing `/api/block` (POST/PATCH/DELETE) — same as product blocks, no new routes needed.
- Global delivery fee saved via existing `PATCH /api/store/[id]` — same as store delivery fee.

**DeliveryBlock is shared between STORE and FLEET initiative types.** The `AddDeliveryBlockModal`/`EditDeliveryBlockModal` logic that originally lived in `app/store/[id]/page.tsx` is replicated inside `app/fleet/[pageId]/page.tsx` (`AddBlockModal`/`EditBlockModal`). Do not extract them until there is a third consumer.

**Team tab (FLEET-TEAM-1)** — Fleet initiatives now show a "Team" tab in `InitiativeTabs.tsx`, identical mechanism to Store's Team tab (`<TeamTab pageId={pageId} canEdit={canEdit} />`, same `GET/PATCH /api/initiative/[pageId]/team*` routes). No change was needed in `TeamTab.tsx` or its API — both are keyed purely on `Page.id`/`Collaboration.initiativeId`, never on `pageType` or `Store`. The only gate was the hardcoded `tabs` array in `InitiativeTabs.tsx` excluding `"team"` for `pageType === "fleet"`; adding the tab entry was sufficient.

**"Fleet on Service" toggle (FLEET-ORDER-1)** — same mechanism as Store's "Taking orders": reuses `Store.acceptingOrders` + `PATCH /api/store/[id] { acceptingOrders }` unchanged, just relabeled and rendered in the Fleet tab of `InitiativeTabs.tsx` instead of the Store tab. The store-status fetch effect (`storeOpen`/`storeLocation`/`storeVpa`) now runs for `activeTab === "fleet"` as well as `"store"`.

**Booking flow (FLEET-ORDER-1)** — customers can now book a fleet service directly from `/fleet/[pageId]` instead of hitting a dead "Enquire →" mailto-style link:
- `POST /api/fleet/[pageId]/book` (new route) — `{ blockId, startLat, startLng, startLabel, dropLat, dropLng, dropLabel, weightKg? }`. Rejects with 422 if the fleet isn't "on service" (`acceptingOrders`) or deleted, 404 if the block isn't a public delivery block on that store. Computes price from the block's existing `pricingModel` (`fixed` / `per_km` / `per_kg_km`) using **real distance** between start and drop (`haversineKm`) — never a flat product price. Creates a normal `Order` row (status `"pending"`, same shape as a Store order) and notifies the owner (`order_confirmed`), so everything downstream (owner's orders page, partner/employee assignment, GPS tracking, customer tracking page, invoicing) is the existing Order/workflow machinery, unchanged.
- **No schema migration** — `Order.addressId` is a required FK, so a minimal `Address` row is synthesized from the drop point (`# ponytail: drop point uses a throwaway Address row instead of new Order columns — revisit with a real pickup/drop schema if fleet bookings need richer querying later`). The start point is recorded inside `Order.items` (already documented as a flexible JSON snapshot, not a strict schema).
- **Location picking UI** (`app/fleet/[pageId]/page.tsx` — `BookModal`/`LocationField`) reuses `geocodeSearch()` from `lib/geo/geocode.ts` (the same Photon text-search already used by the Errand request flow) — type a place, pick from up to 5 results. No map, per the standing no-map-by-default preference.
- Visitors see a "Fleet on Service" / "Not taking bookings right now" banner and each service's button reads "Book →" or greys out to "Closed" depending on `acceptingOrders` — mirrors the Store buyer-facing open/closed banner pattern (see `### Store Open/Closed Status`).

**Discovery entry point (FLEET-DISCOVER-1)** — `/app/saved` Browse → Stores now surfaces Fleet ventures (🚛 badge, "Book →" linking to `/fleet/[pageId]`) via `GET /api/store/all?includeFleet=1` — see `### Store Discovery` above. `/app/discover`'s map still has no fleet entry point.

**KNOWN GAP — fleet services are still invisible on the generic customer Store page (`/store/[id]`)**, see the dedicated footgun entry below. Do not assume `/store/[id]` and `/fleet/[pageId]` show the same thing for a fleet initiative — they currently don't. (`/app/saved`'s fleet cards already link to `/fleet/[pageId]` correctly; the residual risk is only a hand-built or shared `/store/{storeId}` URL.)

### Known Production Risks

- **Quote timeouts use in-process `setTimeout`** (`lib/workflow/triggerQuoteRequests.ts`) — does not survive server restarts. Replace with BullMQ before production.
- **Chat system messages stored as plaintext** — `ChatMessage` rows with `iv = "system"` contain the raw text in `ciphertext`. Chat renderers must check `iv === "system"` and skip ECDH decryption. See `### Chat System Messages` above.
- **`ALLOW_TEST_BYPASS=true` must never reach production** — only in `.env.local`. The bypass bypasses JWT auth entirely using a plain user ID header.
- **`WorkflowStepAssignee` and OSP new fields require `(prisma as any)`** — `WorkflowStepAssignee`, `OrderStepProgress.currentAssigneeId`, `cycleCount`, `lastFeeMultiplier` were added after the last successful `prisma generate`. Use `(prisma as any)` casts until generate runs. Run `npx prisma generate` after stopping the dev server.
- **`assignNextPartner` escalation after 3 cycles is silent to the partner** — only the store owner receives the `escalation` notification. The OSP is left as `"active"` with `requiresAttention = true`. Owner must manually reassign or the order stalls.
- **`createSubOrder` uses the first delivery block found for cost calculation** — if a partner has multiple delivery blocks (e.g., bike vs. van), the first one by `createdAt` is used and the partner may need to reassign. Wire block selection to `WorkflowStepAssignee` before production to let the workflow choose the correct block per step.
- **`/earn/deliveries` queries must use `DISTINCT ON (o.id)`** — the `LEFT JOIN "Address" pa ... AND pa."isDefault" = true` can fan-out a single order into multiple rows when more than one address row has `isDefault = true` for the store owner (TOCTOU race in the address POST/PATCH lets two rows both be default simultaneously). All four raw-SQL queries in `app/earn/deliveries/page.tsx` use `SELECT DISTINCT ON (o.id) ... ORDER BY o.id, o."createdAt" DESC` to collapse duplicates. **Root cause (lower-priority follow-up):** the non-atomic updateMany-then-write in the address routes can produce two isDefault rows; fix with a Postgres partial unique index `CREATE UNIQUE INDEX ... ON "Address"("userId") WHERE "isDefault" = true` (not native Prisma — needs raw SQL migration) or wrap both writes in a transaction.
- **Sub-order uniqueness enforced at DB level; `createSubOrder` handles P2002 gracefully** — `Order` has `@@unique([parentOrderId, userId, subOrderType])` (applied via `db push`, no migration file — same precedent as `deletedAt`). Postgres treats NULL as distinct so regular orders (parentOrderId = NULL) are unaffected. A concurrent double-confirm that races past the `findFirst` guard hits the unique index and throws P2002; the inner catch in `createSubOrder` detects `err?.code === "P2002"` and returns 0 (already created) instead of a 500.
- **`/api/user/me` returns `{ ok: true, user: { id, name, ... } }` — user data is nested under `user`, not at the top level. Always access `json.user.id`, not `json.id`.**

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

### Windows footguns

- **The repo must not live inside a OneDrive-synced folder.** OneDrive's on-demand sync intercepts file handles inside `.next/` and corrupts the build cache — the dev server fails with `EINVAL: invalid argument, readlink ... .next/server/app-build-manifest.json` (or similar `readlink`/`rename` errors on other `.next` files) once OneDrive starts syncing mid-build. **Fix**: stop the dev server, delete `.next`, and rebuild (`npm run dev` regenerates it). **Long-term fix**: move the repo out of OneDrive entirely (e.g. to `C:\dev\charaivati`) — OneDrive sync and Next.js's incremental build cache do not coexist reliably on Windows.

## UCTX-2: New-User Safety (Rate Limiting & Guest Hardening)

Implemented June 2026 to protect against guest-creation abuse, limit AI message spam, and provide safe guest-to-authenticated upgrade in `/listen`.

### Environment Variables
Set in `.env.local`:
```env
GUEST_DAILY_CAP=500              # Global daily cap on new guest accounts
LISTEN_MSG_LIMIT_5MIN=20         # Per-user /api/listen messages per 5 min
LISTEN_MSG_LIMIT_DAY=200         # Per-user /api/listen messages per day
CHAT_MSG_LIMIT_5MIN=20           # Per-user /api/chat messages per 5 min
CHAT_MSG_LIMIT_DAY=200           # Per-user /api/chat messages per day
```

### Guest-Creation Protection (`POST /api/user/guest`)

**Rate limiting doctrine (shared with other abuse-sensitive routes):**
- **Redis-based rate limit** (`checkRateLimit`) is permissive on Redis failure (returns `ok: true`) — always pair with a DB backstop
- Two-window rate limit per IP: 3 creations / 10 min, 20 / day; prevents request storms
- **DB backstop** (global): count guests created in last 24h; return 503 if >= `GUEST_DAILY_CAP`
- **Idempotency guard**: if the request has a valid session cookie, return the existing session instead of creating a duplicate

Key changes:
- Reads `x-forwarded-for` header (Vercel sets this; takes first hop for client IP)
- Blocks with 429 (rate limit) or 503 (daily cap)
- See `app/api/user/guest/route.ts`

### JWT Re-Issue on Guest-Upgrade (`POST /api/user/guest-upgrade`)

**Problem:** After guest-to-lite upgrade, the JWT still claimed `role: "guest"` until the next login.

**Fix:** After successfully updating the user to `status: "lite"`, the route now calls `createSessionToken` with the new role and re-sets the session cookie. This is critical for:
- ChatBot's "Secure Account" nudge to work (it calls `router.refresh()` and expects the new role)
- Client-side checks like `user.status === "guest"` to reflect the upgrade immediately
- Proposal system to work correctly (proposals check the current session role)

See `app/api/user/guest-upgrade/route.ts`.

### Message Rate Caps

Both `/api/chat` and `/api/listen` now enforce per-user message limits:
- **Short window** (5 min): stricter limit to catch spam/load attacks
- **Daily window** (24 h): softer limit for legitimate users
- **On limit**: return an in-character message (e.g., "Let's take a small pause") **not** a 429/error. This keeps the UX graceful.
- **Steer-only turns in `/api/listen`** are excluded from the count (only real message text increments the counter)

Changes:
- `app/api/chat/route.ts`: added `CHAT_MSG_LIMIT_5MIN`/`CHAT_MSG_LIMIT_DAY` env vars; rate-limit check after input guard
- `app/api/listen/route.ts`: added `LISTEN_MSG_LIMIT_5MIN`/`LISTEN_MSG_LIMIT_DAY` env vars; rate-limit check after input guard (message-only)

### Guest-to-Real Merge Handles ConsultSession

**Problem:** When a guest upgraded and merged into a real account, their Listener (Saathi) consultation history was silently lost.

**Fix:** `lib/mergeGuest.ts` now handles ConsultSession and ConsultMessage:
- Deletes any existing real user's ConsultSession first (safeguard; should be rare)
- Moves the guest's ConsultSession (and all messages via cascade) to the real user
- Uses `(db as any)` and `.catch(() => null)` to gracefully degrade if the model isn't in the stale client yet

See `lib/mergeGuest.ts` lines that handle ConsultSession.

### Cold-Start Explicit Mode

**Problem:** When a new user had no profile data, `buildUserContext` returned an empty line. The AI made assumptions about their personality, goals, and background based on nothing.

**Fix:** `lib/ai/userContext.ts` now detects cold-start (no drives, goals, initiatives, or companion data) and returns an explicit block:
```
You know nothing about this person yet.
Listen openly. Make no assumptions about their personality, goals, circumstances, or background.
Let them define themselves through the conversation.
Avoid suggesting changes to their profile or goals — ask first.
```

This is placed in the dynamic user-context block where all AI providers see it. Avoids early proposals and unsafe profiling.

### SecureChatCard Component

New component `components/listen/SecureChatCard.tsx` for guest-to-lite upgrade in `/listen`. Triggered after:
- (i) A goal proposal is accepted
- (ii) The session reaches 12+ messages without the card ever being shown
- Both checks gated on localStorage: `charaivati.dismissed_proposals` tracks dismissal (same pattern as proposals)

Card features:
- Username validation: 3–20 chars, alphanumeric + underscore
- Password validation: min 8 chars
- POST to `/api/user/guest-upgrade`
- Success state for 2s then dismisses
- Existing-user path: link to `/login?next=/listen`
- Graceful error handling with user-facing messages

### Verification Checklist

- [ ] Hammer `/api/user/guest` from curl: 4th request in 10 min → 429; valid-cookie request → no new row
- [ ] `/api/listen` message past rate cap → in-character pause message
- [ ] Guest-upgrade → decode new cookie, claims show `lite` role
- [ ] ChatBot nudge regression test (ensure it still works)
- [ ] `/listen`: accept goal proposal → SecureChatCard appears; dismiss → never reappears
- [ ] Guest-upgrade flow end-to-end (username/password validation, success state)
- [ ] Login with `?next=/listen` merge preserves ConsultSession
- [ ] Fresh guest first message: log shows cold-start block in prompt
