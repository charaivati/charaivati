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
- **UI** — `components/payments/VpaSettingCard.tsx` (owner setter, PATCHes `{ upiVpa }` to a given `endpoint`) is mounted in the Initiative Hub **Store tab** (`InitiativeTabs.tsx`) and the user **Earning** section (`app/(User)/user/edit/page.tsx`). `components/payments/PayToVpa.tsx` is the display/handoff atom — when `amount` is passed it renders a `upi://pay` intent button + a `components/payments/UpiQr.tsx` QR code + copy row; otherwise copy-only. **QR and button share one `buildUpiIntent()` call** — single source of truth (UPI-QR-1). Both checkout modals (`QuickOrderModal` step 3 and `CheckoutModal` step 3 in the section page) pass `amount`/`payeeName`/`note` when a VPA is set. **UPI-direct doctrine (UPI-INTENT-1b)**: the `upi://pay` link goes customer's app → seller VPA directly; the platform never touches funds, validates, or escrows. Intent URL built by `lib/upiIntent.ts` `buildUpiIntent({ vpa, payeeName, amount, note })`. No mobile-detection: the button is a plain `<a>` with no `target`, the QR is always visible — harmless on mobile, useful on desktop. The broadcast engine (REQBCAST-1c) is the intended non-checkout consumer.
- **`components/payments/UpiQr.tsx`** — presentational QR canvas. Props: `{ value: string, size?: number }`. Uses the `qrcode` npm package to render a canvas QR in a `useEffect`; renders nothing when `value` is empty. **`qrcode` is a deliberate local dependency** — the UPI intent string contains the payee VPA and amount and must NOT transit any third-party QR-image API.
- **`lib/upiIntent.ts`** — `buildUpiIntent({ vpa, payeeName, amount, note })`: returns `upi://pay?pa=…&pn=…&am=…&cu=INR&tn=…`; returns `""` when `vpa` is falsy; omits `am` when amount is 0/null. `URLSearchParams` encodes `pn`/`tn`. Also exports `parseUpiIntent(url)` (UPI-QRUPLOAD-1b) — parses a `upi://pay` URL back to `{ vpa, payeeName, amount, note }` or `null`; used by the QR-upload decode path in `VpaSettingCard`.
- **`lib/payments/decodeQrImage.ts`** (UPI-QRUPLOAD-1b) — `decodeQrFromFile(file: File): Promise<string | null>`. Client-side QR decode from a `File`. Primary: browser-native `BarcodeDetector` (Chrome 83+, Edge, Android WebView). Fallback: `jsQR` (dynamically imported, covers Safari/Firefox). **The image never leaves the browser** — no upload, no network call for the image. `jsqr` is a deliberate dep (~10KB, client-only, lazy-imported) for the Safari/Firefox fallback. See TECH_DEBT §26 for BarcodeDetector availability note.
- **QR upload → VPA pre-fill doctrine (UPI-QRUPLOAD-1b)** — convergence only: the decoded VPA flows into the same `VpaSettingCard` text input and the same `PATCH /api/store/[id]` save path that manual typing uses. No second write path. Pre-fill, not auto-save — owner reviews and taps the existing save button. Image discarded after decode.
- **Handoff getter** — `lib/payments/getVpa.ts` `getPayToVpa({ storeId?, userId? })` (store handle first, falls back to owner's `Profile.upiVpa`). **No live consumer yet** — built and left ready for REQBCAST-1c.
- **i18n** — 8 slugs seeded by `prisma/seed-vpa-ui.js` (category `ui-vpa`): `pay-vpa-label`, `pay-vpa-placeholder`, `pay-vpa-help`, `pay-vpa-invalid`, `pay-vpa-save`, `pay-vpa-saved`, `pay-to-vpa-label`, `pay-vpa-copy`. 8 slugs seeded by `prisma/seed-upi-pay-ui.js` (category `ui-upi-pay`): `pay-via-upi-btn`, `pay-qr-scan`, `pay-qr-upload-btn`, `pay-qr-prefill-hint`, `pay-qr-err-read`, `pay-qr-err-not-upi`, `pay-qr-err-no-vpa`, `pay-qr-err-invalid`.

### Request Broadcast Engine — service/errand noticeboard (REQBCAST)
inDrive-style broadcast → respond → accept → direct UPI handoff; errand pick/drop; fleet provider presence for live matching. Noticeboard, never dispatcher; platform never sets price or escrows. **Full design: `docs/modules/requests.md`.**
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

### Listener ("Saathi") — /api/listen
Parallel guided-conversation system (Rogerian/MI/SFBT) sharing four seams with the chat stack; crisis protocol, slow personality layer, admin bridge, action layer (friend/reminder/unfriend/block), login/logout/clear-chat, site awareness. Never writes UserCompanionProfile. **Full design: `docs/listen.md`.**
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

## Business Document & Evaluation System (BIZDOC)
Per-idea typed `BusinessDocument` (SWOT/BMC/Financials), PDF + public share tokens, adaptive AI interview engine, TAM/SAM/SOM market sizing (math-in-code), validation Todos, business↔goal linking. Guest ownership via `biz-guest` cookie, claimed on login. **Full design: `docs/modules/business.md` + `docs/BUSINESS_ANALYSIS_FLOW.md`.**
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
WorkflowStep + OrderStepProgress + Quote + WorkflowStepAssignee + delivery dispatch + fleet + notifications — the order-fulfillment engine. Normal vs delivery `activityType` branching; sequential partner cycling; sub-orders. **Full design: `docs/modules/store-initiative-system.md`.**
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

## UCTX-2: New-User Safety
Guest-creation rate limiting (per-IP + global DB cap), per-user message caps on /api/chat and /api/listen, JWT re-issue on guest-upgrade, ConsultSession merge, cold-start explicit mode, SecureChatCard. **Full detail: `docs/modules/new-user-safety.md`.**

## CHAKRA-1 / CHAKRA-UI-2: Chakra Landing (Self-layer dashboard)
Seven chakras lit 0–100 by an "openness" score (0.6 platform signal + 0.4 user 1–7 self-report), presented as a **root→crown scroll journey** (CHAKRA-UI-2): seven full-viewport stages with inline cards over a pinned score-lit silhouette that "camera-pans" up the body. Unified Todo channel: every todo carries `chakra` + `source`. **Full design: `docs/modules/chakra.md`.** Key facts:
- **Schema (migration `20260701000000_add_todo_chakra_profile_selfreport`)**: `Todo.chakra String?` + `Todo.source String?`; `Profile.chakraSelfReport Json?`. Applied via the P3006-safe path (`prisma db execute` + `migrate resolve --applied`). **Values validated in the API, not the DB** (freq/assumptionKey precedent). Allowed `chakra`: `root|sacral|solar|heart|throat|third_eye|crown`; allowed `source`: `manual|validation|execution_plan|initiative`. All three columns read/written via **raw SQL** until a full `prisma generate` runs (stale-client pattern — same as `upiVpa`). Do not put them in typed `where`/`select`/`create`.
- **Canonical keys**: `lib/chakra/keys.ts` — `CHAKRA_KEYS` (snake_case, root→crown, index-aligned with `app/chakra/chakras.ts` which uses camelCase `thirdEye` for display), `TODO_SOURCES`, `isChakraKey`/`isTodoSource`, `DRIVE_CHAKRA`, `ARCHETYPE_CHAKRA`.
- **Scoring**: `lib/chakra/score.ts` `computeChakraScores(userId)` → `Record<ChakraKey, { score, platform, self, platformOnly, signals }>`. Pure read, no stored state. Platform signals: root=energy physical+funds+**action** (earning store/service/fleet pages full=2 + AiGoal count full=3 — CHAKRA-UI-2); sacral=friends+posts+chat; solar=todo completion+course mastery; heart=existence of helping/community_group pages; throat=public posts+publicly-shared initiatives; third_eye=ConsultMessage count; **crown=PARKED dormant placeholder**. `signals: {key,value}[]` exposes the named sub-signals (platform score = their average; UI translates labels via `chakra-signal-<key>` slugs), and **any chakra with tagged todos gains a `todos` signal** = completion % of its tagged todos (grouped via raw SQL — `Todo.chakra` is stale-client). Every signal floored at `DORMANT=8` — empty never reads as 0/"broken". Served by `GET /api/chakra`.
- **Todo writers now tagged**: `/api/self/todos` POST (validates chakra/source, default `source="manual"`); business validation tasks (`source="validation"`); execution-plan tasks (`source="execution_plan"`, chakra from `ARCHETYPE_CHAKRA[goal.archetype]`) — added as an ADD-ONLY create loop after the `step:"tasks"` `aiGoal.update` in `app/api/goal-ai/execution-plan/route.ts`, never altering the executionPlan JSON write. **Initiative actions and weekSchedule day-tasks do NOT write Todo rows (PARKED — TECH_DEBT §27).**
- **Self-report**: one 1–7 slider per chakra, stored in `Profile.chakraSelfReport` JSON, saved via the existing `PATCH /api/user/profile` (no new route). Gap between platform and felt score is shown as insight, never deficiency.
- **UI (CHAKRA-UI-2 scroll journey)**: `app/chakra/landing/page.tsx` (client). Seven `min-h-screen` stages root→crown over a pinned scene; an IntersectionObserver flips a discrete `stage` index and **CSS transitions/keyframes do all motion — no per-frame scroll JS** (supersedes CHAKRA-1's "fully static" rule while keeping its low-end-Android intent). Camera = `translateY/scale` transform on the pinned figure recomputed only on stage change/resize; water line derives from the same math (no DOM measurement). Awakened chakras glow by score; the active one gets a breathing halo + slow yantra spin; an energy pulse rises root→active along the spine; `prefers-reduced-motion` disables ambient loops. Stage cards are inline (tap-popup removed): score ring, platform-vs-felt, per-signal bars, slider, tagged todos; crown stage doubles as the overall-openness summary. Fixed right progress rail (root at bottom) + glyph taps jump stages. Dormant copy is "ready to awaken" (hard requirement). 43 i18n slugs (category `ui-chakra`) seeded by `prisma/seed-chakra-ui.js` (English fallback).
- **Middle layer (CHAKRA-UI-3)**: journey card → `/chakra/[key]` detail page → action surface. Every stage card's CTA goes to `app/chakra/[key]/page.tsx` (param validated with `isChakraKey`, else 404; crown included — its page renders, only its action CTA is "Coming soon"). The detail page renders factor cards (one per `ChakraDetail.signal`: value bar + `chakra-signal-desc-<key>` line + "Work on this →" link into the existing module via `SIGNAL_LINKS`), the self-report slider, tagged todos, and the primary "Go to {surface} →" CTA from `DEEP_LINKS`. **Shared config lives in `app/chakra/meta.ts`** (`DEEP_LINKS`/`REMARK_EN`/`SURFACE_EN`/`SIGNAL_EN`/`SIGNAL_DESC_EN`/`SIGNAL_LINKS`) — imported by both the landing journey and the detail pages; do not redefine per-page.
- **Simple variant (CHAKRA-UI-4)**: `/chakra/landing/simple` — monochrome, zero-animation twin of the landing (black & white static card list, white yantras, no transitions/keyframes/camera/stars). Same data + same "View details →" flow into `/chakra/[key]`; reuses the existing `ui-chakra` slugs; the full journey page is untouched.
