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
- **Next.js 15** App Router, **React 19**, TypeScript
- **PostgreSQL** via **Prisma 6** ORM (`lib/db.ts` exports `db`, `lib/prisma.ts` exports `prisma` — both are the same singleton)
- **Tailwind CSS v4**, `lucide-react`, `sonner` (toasts), `framer-motion`
- **Redis** via `@upstash/redis` and `ioredis` for caching (`lib/redis.ts`, `lib/cache-utils.ts`)
- **Cloudinary** for images/video, **AWS S3** for file storage, **Google Drive** integration
- **SendGrid** (email), **Twilio** (SMS via `lib/sendSms.ts`)
- **Leaflet** for maps, **Three.js** / `@react-three/fiber` for 3D, **D3** for geo/charts
- **Capacitor 8** for iOS/Android native shell — the app points to `https://charaivati.com/app/home`

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
| `app/` | **Mobile shell** — Capacitor-wrapped layout with sticky header + bottom nav |

The platform uses a 6-layer conceptual model: **Self → Society → State → Nation → Earth → Universe**, each with tabs for different analyses.

### Authentication
- Sessions use JWT via `jose`, stored in `charaivati.session` (dev) / `__Host-session` (prod) cookies — see `lib/session.ts`
- `middleware.ts` protects `/self`, `/nation`, `/earth`, `/society` — unauthenticated requests redirect to `/login`
- `getCurrentUser(req)` in `lib/session.ts` decodes the session cookie and fetches the user from the database
- API routes read the session cookie via `getTokenFromRequest(req)` from `lib/session.ts`
- Auth flows also support OTP (`/api/auth/otp/`), magic links (`/api/auth/send-magic-link`), and CSRF tokens (`/api/auth/csrf`)

### Database
- Schema lives in `prisma/schema.prisma` — 100+ models covering users, businesses, e-commerce (stores, carts, orders), social (friends, chat, posts), learning (courses, timelines), health, and geo data
- After editing `schema.prisma`, always run `npx prisma generate` and create a migration
- Chat messages use ECDH P-256 end-to-end encryption (`lib/chat-crypto.ts`)

### API Routes
All API routes live under `app/api/`. Key areas:
- `app/api/auth/` — login, logout, OTP, magic link, CSRF
- `app/api/user/` — profile, avatar, verification, deletion
- `app/api/social/` — posts, limits, proxy
- `app/api/business/` — idea scoring, plan generation/analysis
- `app/api/store/` — store management, blocks, sections, cart, orders
- `app/api/friends/` — friend requests, accept/decline/remove

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
- Each profile: `legalName` (required), `companyName`, `gstNumber`, billing address fields, optional `linkedStoreId`
- Users select a billing profile during checkout for GST invoice purposes

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

### Buy Now / Quick Order UX
- "Buy Now" button on product cards opens `QuickOrderModal` (ephemeral React state — never touches cart)
- "Add to Cart" button flashes green "✓ Added" for 2 seconds on successful add
- `QuickOrderModal` steps: Items review (with inline qty stepper) → Delivery address → Invoice profile (optional, from billing profiles) → Confirmation
- Managed in `components/store/QuickOrderModal.tsx`
- Also available on the **Saved Products** page (`/app/saved`) — wishlist items have a "Buy Now" button that opens `QuickOrderModal` directly

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
- `components/transport/` — live vehicle tracking map

### Key Libraries
- `lib/featureFlags.ts` — feature flag system (check before adding major features)
- `lib/rateLimit.ts` — rate limiting for API routes
- `lib/csrf.ts` — CSRF protection
- `lib/writeQueue.ts` — queued write operations
- `lib/timeline-templates.ts` — predefined timeline templates
- `lib/sectionTagMappings.ts` — maps store section types to tags
- `lib/store/uploadImage.ts` — `uploadStoreImage(file, storeId)`: dedup-aware upload utility; single source of truth for all store image uploads
- `lib/store/generateSlug.ts` — `generateSlug(name)` + `randomSuffix()`: slug generation for stores
- `lib/store/getStoreSlugs.ts` — `getStoreSlugs(ids[])`: batch raw-SQL slug lookup; used by all store-listing APIs to add slug to responses without depending on the Prisma typed client

### Security Notes
- CSP headers are configured in `next.config.mjs` — update them when adding new external scripts, styles, or media sources
- `X-Frame-Options: DENY` is set globally; do not add iframe embeds without updating the CSP `frame-src`
- `geolocation` permission is restricted to `self` and `https://charaivati.com`

### Environment Variables
Required: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `SENDGRID_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, Upstash Redis credentials.

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
