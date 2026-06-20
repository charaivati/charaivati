---
module: store
type: api + component
source: app/api/store/, components/store/, app/(app)/stores/, app/store/
depends_on: [database, auth, media, pages]
used_by: [mobile-shell, pages]
stability: evolving
status: active
---

# Module: Store

## Status (as of May 2026)
**V1 complete.** Guest checkout works — no login required to place an order. Workflow auto-assignment fires on order confirm. Delivery logistics are handled by the workflow system (via `WorkflowStepAssignee` partners or self-delivery); the Store type itself is products-only. Fleet is the separate initiative type for delivery businesses.

## Purpose
Full e-commerce system allowing users to create storefronts, organize products into sections, manage filters and banners, accept orders, and handle wishlists and pinned stores. Also powers the course content structure (same block/section models).

## Responsibilities
- CRUD for Store, Section, Subsection, Block (product/lesson)
- Filter and banner management per store
- Deduplicated image library for store media (two-layer: DB hash + Cloudinary public_id)
- Cart management (per-user, per-store)
- Order creation, status tracking, and snapshot storage — two paths: cart-based (`POST /api/store/orders`) and express Buy Now (`POST /api/store/orders/quick`)
- Wishlist and pinned stores (user favorites); wishlist items on the Saved page have a direct "Buy Now" button
- Delivery address management
- Billing profile management (multiple per user, optionally linked to a store for GST)
- Section tile management for visual layouts
- Store slug management — generation, resolution, canonical redirects
- Product ratings (1–5 stars, per-user per-block, batch-aggregated)

## Inputs & Outputs

| Direction | Value |
|---|---|
| In | Authenticated user session |
| In | Store/section/block metadata (title, price, media, type) |
| In | Cart actions (add, update quantity, remove) |
| In | Cart checkout payload (address ID — items fetched from cart) |
| In | Quick-order payload (address ID + explicit items array — bypasses cart) |
| In | Billing profile CRUD (legalName, gstNumber, optional linkedStoreId) |
| In | Image file + storeId → `uploadStoreImage()` pipeline (hash check → Cloudinary → DB upsert) |
| In | Rating (1–5) per user per product → upsert `ProductRating` |
| Out | Store page data with sections and blocks; `slug` always included |
| Out | Cart state per user per store |
| Out | Order record with JSON snapshot of items at purchase time |
| Out | Wishlist and pinned store lists; each includes `slug` via `getStoreSlugs()` |
| Out | Billing profile list for invoice selection at checkout |
| Out | Deduplicated `StoreImage` record with `url`, `fileHash`, `cloudinaryId` |
| Out | Batch rating aggregates `{ average, count, userRating }` per product |

## Dependencies
- **auth** — all write operations require a valid session
- **database** — all store models live in Prisma schema
- **media** — all store image uploads go through `lib/store/uploadImage.ts` → Cloudinary (`dyphnp3oc`, preset `posts_unsigned`); direct Cloudinary calls must not remain in store components
- **pages** — a Store is always linked 1:1 to a `Page` record (`pageType: 'store'`)

## Reverse Dependencies (what breaks if this changes)
- `StoreBlock` is also the lesson unit in courses. Changes to block fields or access logic affect both stores and the learning module.
- `Order` stores a JSON snapshot of items at checkout time. Changes to the item shape require versioned migration logic.
- `StoreSection` prereq linking (`prereqIds`) powers locked/unlocked course progression. Breaking this silently disables course gating.
- Deleting a `StoreFilter` does not automatically unlink it from sections — orphaned `StoreSectionFilter` rows may remain.

## Runtime Flow

### Browsing a store
1. Client fetches `GET /api/store/[id]`
2. API returns store with nested sections, blocks, filters, and banners
3. Active filter selection on client narrows visible sections via `StoreSectionFilter` join
4. Locked blocks (`blockStatus: locked`) are rendered but not accessible without prerequisite completion

### Adding to cart
1. Client POSTs to `POST /api/store/cart/[storeId]` with `blockId`
2. API verifies block exists in store and user is authenticated
3. Creates `CartItem` (one per user per block — upsert on quantity)

### Guest checkout
Guest users (`User.status = "guest"`) can place orders via either checkout path without registering. The order is created under the guest `User.id`. On login or email verification, `mergeGuestToReal` transfers all guest orders to the real account atomically.

### Checkout (cart-based)
1. Client POSTs to `POST /api/store/orders` with `storeId`, `addressId`
2. API fetches all cart items for user + store
3. Snapshots item titles, prices, and quantities into `Order.items` JSON
4. Creates `Order` with status `pending`
5. Clears cart items for that store
6. TODO: No payment gateway integration found — assumed cash-on-delivery or manual fulfillment

### Buy Now / Quick Order (express, cart-bypassing)
1. User clicks "Buy Now" on a product card in a section page
2. `QuickOrderModal` opens with that item pre-loaded (ephemeral React state only — cart table is never touched)
3. User adjusts quantity, removes if needed, then proceeds through: Delivery address → Invoice profile (optional) → Place order
4. Client POSTs to `POST /api/store/orders/quick` with `{ storeId, addressId, items[], billingProfileId? }`
5. API creates `Order` directly from the supplied items (no cart lookup, no cart clearing)
6. Sends email notification to store owner

### "Add to Cart" UX feedback
- When "Add to Cart" is clicked successfully, the button flashes green ("✓ Added") for 2 seconds then reverts. No extra API call.

### Inline Quantity Stepper (`QtyStepperInline`)
- Rendered in the product title row on section pages (right side, compact)
- `−` button, editable number display (click → `<input>`, blur/Enter commits, clamps 1–99), `+` button
- Selected qty is forwarded to both `handleAddToCart(block, qty)` and `handleBuyNow(block, qty)`
- `handleAddToCart` passes `{ quantity: qty }` to the cart POST (increments by `qty`)
- `handleBuyNow` sets `quickOrderItem.quantity = qty` so the modal opens with the right amount

### Product Ratings
1. Section page loads → batch `GET /api/store/products/ratings?ids=...` (one request for all blocks)
2. API uses `productRating.groupBy({ by: ['productId'], _avg: { rating: true }, _count: { rating: true } })` — one query
3. Also fetches the current user's own rating in a parallel `findMany`
4. Returns `Record<productId, { average, count, userRating }>` for all blocks at once
5. `StarRating` component per card: amber `★`/`☆` characters, hover to preview, click to submit via `POST /api/store/products/[productId]/rate`
6. Owner receives a 403; logged-out users see display-only stars

### Store Slug Flows
#### Creation
1. `POST /api/store` creates the store row (no slug yet)
2. Generates `candidate = generateSlug(name)` from `lib/store/generateSlug.ts`
3. Checks conflict via `SELECT id FROM "Store" WHERE slug = $1` (raw SQL)
4. If conflicting, retries with `${candidate}-${randomSuffix()}` up to 5 times
5. Updates the row with the winning slug via `UPDATE "Store" SET slug = $1 WHERE id = $2`

#### Resolution in GET /api/store/[id]
- If `id` matches `/^c[a-z0-9]{24}$/i` (cuid): `findUnique({ where: { id } })`
- Otherwise: `SELECT id FROM "Store" WHERE slug = $1 LIMIT 1`, then `findUnique({ where: { id: resolvedId } })`
- Always appends `SELECT slug FROM "Store" WHERE id = $1` result to the JSON response

#### Canonical redirect
- Both `app/store/[id]/page.tsx` and `app/store/[id]/section/[sectionId]/page.tsx` check on data load: if `data.slug && id !== data.slug` → `router.replace(slug URL)` and abort state updates
- Browser URL bar always ends up showing the slug version after first load

### Store Image Upload (dedup pipeline)
All store image uploads use `uploadStoreImage(file, storeId)` from `lib/store/uploadImage.ts`:
1. SHA-256 hash of file bytes client-side (`crypto.subtle.digest`)
2. `POST /api/store/images/check` with `{ storeId, fileHash }` — if exists, return record immediately (`alreadyExisted: true`); no upload
3. Upload to Cloudinary: cloud `dyphnp3oc`, preset `posts_unsigned`, folder `posts/`, `public_id = fileHash` — Cloudinary itself also deduplicates by `public_id`
4. `POST /api/store/images/save` with `{ storeId, url, cloudinaryId, fileHash, fileName }` — upserts on `[storeId, fileHash]`; safe against race conditions

When `alreadyExisted: true`, UI shows "Already in library — reused" feedback.

Entry points that use this pipeline:
- `BulkImageUploadModal` (`app/store/[id]/page.tsx`) — bulk library upload
- `StoreImagePickerModal` (`components/store/StoreImagePickerModal.tsx`) — "Upload new" inside picker
- `AddBlockModal` (`app/store/[id]/section/[sectionId]/page.tsx`) — "Choose from library" opens picker
- `BannerEditForm` (`components/store/BannerEditForm.tsx`) — banner image upload
- `AddTileModal` (`app/store/[id]/page.tsx`) — tile image upload

### Product Search (PRODSEARCH-1b)

Full-text product search across all stores, returning item-level results with distance sorting.

**Migration** (`20260622000000_add_block_storeid_search`):
- `Block.storeId TEXT` — denormalized FK to `Store` for query shortcut (source of truth for hierarchy is still `section → store`). Backfill via `UPDATE "Block" b SET "storeId" = s."storeId" FROM "Section" s WHERE b."sectionId" = s."id"`. Index: `Block_storeId_idx`.
- `Block.search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))) STORED` — auto-maintained, indexed via `Block_search_vector_idx` (GIN). Query via `search_vector @@ websearch_to_tsquery('english', q)`.

**`GET /api/store/product-search`**
| Param | Type | Notes |
|---|---|---|
| `q` | string | Full-text query via `websearch_to_tsquery` |
| `addressLat`, `addressLng` | float | When present, compute and sort by haversine distance |
| `categoryIds` | comma-separated | Category proxy — filters stores matching any of these `StoreCategoryLink` rows; products in those stores are included |
| `limit`, `offset` | int | Max 100, default 30 |

Response: `{ products: [{ blockId, title, description, price, mediaUrl, storeId, storeName, storeSlug, distanceKm }] }`

Filters applied: `serviceType='product'`, `visibility='public'`, `price IS NOT NULL`, `storeId IS NOT NULL`, store not deleted, store not owned by caller. Uses `DISTINCT ON (b.id)` to prevent any future join fan-out.

**Category proxy doctrine (coarse by design)**: there is no `BlockCategoryLink` table — categories live on stores, not blocks. Filtering by category narrows to stores that carry the category, then shows all matching products within those stores. A product that happens to live in a store with an unrelated category may appear; products in a perfectly relevant store that hasn't set categories won't appear. This is a deliberate trade-off — adding `BlockCategoryLink` would require per-product tag management. See TECH_DEBT.md § Product Search for the known gap.

**Block creators that write `storeId`**:
- `POST /api/block` — resolves `storeId` from the section's store before the create
- `POST /api/store/ai-setup/apply` — passes outer `storeId` into each `tx.storeBlock.create`
- `POST /api/store/parse-menu/apply` — same pattern

Blocks created via the subsection path (only used by the learning module) have `storeId = null` and are intentionally excluded from product search.

**UI (`/app/saved` → Products tab)**: tab toggle "Stores" / "Products" on the Browse section. Products tab has a search bar + category filter button. Results render as 2-column cards (image, title, price, store name link, distance badge). Tapping the store name navigates to `/store/{storeSlug|storeId}` — **never** a Page ID.

### Store Location (GEO-STORE-1)
`Store` is the canonical source of a store's physical location: `line1`, `city`, `state`, `pincode` (all `String?`) and `lat`, `lng` (`Float?`), added via migration `20260610000000_add_store_location`. These fields fully replace the previous owner-default-`Address` proxy.

- **Editor**: Initiative Hub → Store tab → "Store Location" card (`components/earn/StoreLocationForm.tsx`, reuses the `AddressForm` pattern — pincode geocode + drag-pin map). Saved via `PATCH /api/store/[id]` with a `location` object.
- **Read**: `GET /api/store/[id]` always returns `location: { line1, city, state, pincode, lat, lng }` (all `null` if unset). `GET /api/store/my-stores` includes the same `location` object per store via a batch raw-SQL lookup.
- **Nag banner**: an amber banner ("Add your store location — needed for delivery pricing and rider navigation.") renders in the Initiative Hub Store tab whenever `lat`/`lng` are null. Disappears once a location is saved.
- **Fallback chain (readers)**: canonical `Store.lat/lng` → owner's/partner's `isDefault` `Address.lat/lng` (legacy) → `null`. Applied in:
  - `lib/workflow/assignNextPartner.ts` (store side, for delivery cost distance)
  - `lib/workflow/createSubOrder.ts` (partner side, for delivery cost distance)
  - `app/earn/deliveries/page.tsx` — all 4 raw SQL pickup queries use `COALESCE(s."<field>", pa."<field>")`
- **₹0-fee fix**: previously, missing coordinates on either side silently produced `distanceKm = 0` (free per-km delivery). Now, if both the canonical Store location and the legacy Address fallback are missing AND a per-km pricing field is configured for the assignee, a `console.warn` is logged instead of silently proceeding — the cost is still 0, but the gap is now visible in server logs.
- **BillingProfile autofill (not a hard sync)**: when an owner links a `BillingProfile` to a store (`linkedStoreId`) in `/store/account?tab=invoice`, and the store has a saved location, the billing address fields are pre-filled from `Store.line1/city/state/pincode` once. The owner can still edit these fields independently afterward — there is no ongoing sync between `Store` location and `BillingProfile`.
- **Fields added after the last successful `prisma generate`**: as of GEO-STORE-1, the binary-engine Prisma client at `node_modules/.prisma/client` already includes `Store.line1/city/state/pincode/lat/lng` in its types — but existing call sites (`app/api/store/[id]/route.ts`, `app/api/store/my-stores/route.ts`, `assignNextPartner.ts`, `createSubOrder.ts`, `app/earn/deliveries/page.tsx`) still read/write these fields via raw SQL, matching the established pattern for recently-added fields elsewhere in this codebase. This is intentional — not a bug.

### Store creation — manual
1. User creates a `Page` with `pageType: 'store'`
2. API creates linked `Store` record
3. User adds sections, blocks, filters, and banners via separate API calls
4. Each section can have a `type` (grid, etc.) and `columns`/`rows` layout metadata

### Store creation — AI Setup Wizard
1. Owner navigates to the Initiative Hub (`/earn/initiative/[pageId]`) via `/app/initiatives` (mobile) or the desktop EarningTab summary list, then clicks **"Set up store"** in the Store tab
2. `InitiativeTabs.handleOpenStore()` → `GET /api/store/for-page/[pageId]` finds/creates the `Store` and returns `isNew: true` when `storeSection.count === 0`
3. `handleOpenStore()` uses `window.location.href` (not `router.push`) to navigate to `/store/[id]/setup` — hard nav required because `router.push` silently drops navigations across different Next.js layout roots
3. **Fallback redirect**: `app/store/[id]/page.tsx` `fetchStore` also redirects to `/setup` if `isOwner && sections.length === 0` and `sessionStorage.setup_skipped_[id]` is not set
4. Owner types a plain-English business description → `POST /api/store/ai-setup` calls `chatComplete` once, strips markdown, parses JSON, batch-fetches images via `lib/imageSearch.ts` `fetchImages()` (rotates Unsplash/Pexels/Pixabay, Picsum fallback); returns `{ filters, sections[] }` with `imageUrl` on each section
5. Owner edits inline (section titles, product titles, prices) and removes unwanted sections
6. Owner clicks "Create my store →" → `POST /api/store/ai-setup/apply` runs a single Prisma transaction (`timeout: 30000 ms`): filters → sections → tiles → per-filter banners (`isGlobal: false`) → product blocks → one global banner (`isGlobal: true`, first section image, heading = store name)
7. On success: wizard navigates to `/store/[id]`; `fetchStore` sees `sections.length > 0` so the setup redirect never re-fires
8. Skip buttons call `skipToStore()` which sets `sessionStorage.setup_skipped_[id]` before navigating to prevent the `fetchStore` redirect from looping

**Image env vars** (all optional): `UNSPLASH_ACCESS_KEY`, `PEXELS_KEY`, `PIXABAY_KEY`. `lib/imageSearch.ts` skips any provider whose key is absent and falls back through the chain. Picsum is the no-key guaranteed fallback — images are never `null`.

## Key API Routes

| Method | Route | Action |
|---|---|---|
| POST | /api/store/ai-setup | AI wizard: generate store structure from description; fetches images via `lib/imageSearch.ts` (multi-provider) |
| POST | /api/store/ai-setup/apply | AI wizard: apply confirmed structure — creates filters, sections, tiles, banners, blocks in one transaction |
| GET | /api/store/for-page/[pageId] | Find/create store for a Page; returns `{ storeId, storeSlug, isNew }` |
| POST | /api/store | Create store |
| GET | /api/store/[id] | Get store with sections/blocks |
| PATCH | /api/store/[id] | Update store metadata |
| GET | /api/store/my-stores | Current user's stores |
| POST | /api/store/[id]/sections | Add section |
| POST | /api/store/[id]/filters | Add filter |
| POST | /api/store/[id]/banners | Add banner |
| GET/POST | /api/store/[id]/images | List / upsert images in store library (legacy path — same DB, new field names) |
| DELETE/PATCH | /api/store/[id]/images/[imageId] | Delete or rename a library image |
| POST | /api/store/images/check | Dedup check: `{ storeId, fileHash }` → returns existing record or `{ exists: false }` |
| POST | /api/store/images/save | Save image after upload: upsert on `[storeId, fileHash]` |
| GET | /api/store/images/list | `?storeId=` — list images for a store; owner-only |
| GET/POST | /api/store/cart/[storeId] | Cart read/write |
| POST | /api/store/orders | Cart-based checkout — fetches cart, creates Order, clears cart |
| POST | /api/store/orders/quick | Express checkout — accepts `{ storeId, addressId, items[], billingProfileId? }`; never touches cart |
| GET | /api/store/orders | Buyer: own purchases (no params); Owner: `?storeId=X` for one store, `?storeId=X&status=Y` to filter by status, `?all=true` for all owned stores |
| PATCH | /api/store/orders/[orderId] | Update order status (owner only) |
| POST | /api/store/wishlist | Toggle wishlist item — requires `blockId` + `storeId`; returns `{ wishlisted: bool }` |
| GET | /api/store/wishlist | List wishlisted items; each item includes `store { id, slug, name }` and `block { id, title, price, mediaUrl }` |
| POST | /api/store/products/[productId]/rate | Upsert rating 1–5; rejects owner self-rating (403); returns `{ average, count }` |
| GET | /api/store/products/[productId]/rating | Single product rating with `userRating` for current user |
| GET | /api/store/products/ratings | `?ids=id1,id2,...` — batch ratings via `groupBy`; returns `Record<id, { average, count, userRating }>` |
| GET/POST | /api/store/pinned | Pinned stores |
| GET/POST | /api/store/address | Delivery addresses |
| GET/POST | /api/store/billing-profiles | List / create billing profiles |
| PATCH/DELETE | /api/store/billing-profiles/[profileId] | Update / delete a billing profile |
| GET | /api/store/taxonomy | `?locale=xx` — public, no auth; returns `{ categories: [{id, slug, title, description}], tags: [{id, slug, title}] }` with locale→en→slug fallback per string |
| POST | /api/block | Create block |
| POST | /api/section | Create section |

## Key Pages

| Page | Purpose |
|---|---|
| `app/store/[id]/setup/page.tsx` | AI setup wizard — 3-step onboarding (describe → preview/edit → apply); shown automatically on first visit when 0 sections |
| `app/store/[id]/page.tsx` | Main store page — browsing, cart, checkout, image library; redirects cuid URLs → slug URL; redirects owner to `/setup` when 0 sections |
| `app/store/[id]/section/[sectionId]/page.tsx` | Section product grid; inline qty stepper; star ratings (batch-fetched); "Buy Now" opens QuickOrderModal; redirects cuid URLs → slug URL |
| `app/store/account/page.tsx` | Buyer: addresses, purchases, billing profiles. Owner: per-store and "All Orders" aggregate order view |
| `app/store/[id]/orders/page.tsx` | Per-store active order list with status-update controls; "Delivered Orders →" link in header |
| `app/store/[id]/orders/delivered/page.tsx` | Read-only delivered order archive for one store; no status-update buttons; "← Active Orders" back link |
| `app/store/orders/all/page.tsx` | Aggregated order list across all owned stores; store name shown as chip; full status-update controls |

## Key Components

| Component | Role |
|---|---|
| `components/store/FilterBar.tsx` | Renders filter chips, manages active filter state |
| `components/store/ManageFiltersPanel.tsx` | Admin panel for creating/reordering filters |
| `components/store/BannerZone.tsx` | Renders promotional banners for a store |
| `components/store/BannerEditForm.tsx` | Form for creating/editing a banner |
| `components/store/ImageLibraryPicker.tsx` | Compact inline library picker (used in BannerEditForm); fetches from `/api/store/images/list` |
| `components/store/StoreImagePickerModal.tsx` | Full-screen library picker with search, grid, "Upload new" (calls `uploadStoreImage`); opened from AddBlockModal |
| `components/store/QuickOrderModal.tsx` | 4-step express checkout modal (Items → Address → Invoice → Confirm); ephemeral React state only, never writes to cart; also used from the Saved page wishlist items |
| `components/earn/StoreTaxonomyPicker.tsx` | Owner category/tag picker (TAG-STORE-1c-fix) — controlled, `PillButton` toggles; categories soft-capped at 3, tags uncapped; rendered in `InitiativeTabs` Store tab |

## Database Models Used
- `Store` — top-level store record; canonical location fields `line1/city/state/pincode/lat/lng` (GEO-STORE-1) — see § Store Location above
- `StoreSection` — product grouping with layout
- `StoreSubsection` — sub-grouping within a section
- `StoreBlock` — individual product or lesson (dual-purpose)
- `SectionTile` — visual tile within a section
- `StoreFilter` — filterable category
- `StoreSectionFilter` — M2M: filter ↔ section
- `StoreBanner` — promotional banner
- `StoreImage` — media library entry; fields: `id`, `storeId`, `url`, `cloudinaryId`, `fileHash` (required), `fileName`, `uploadedAt`; `@@unique([storeId, fileHash])` enforces dedup at DB level
- `CartItem` — per-user per-block cart entry
- `Order` — purchase order with item JSON snapshot; created by both cart checkout and quick order
- `WishlistItem` — saved product
- `Address` — delivery address
- `PinnedStore` — user-saved store
- `BillingProfile` — per-user GST/invoice profile; optional `linkedStoreId` FK to Store; selected at checkout for invoice generation
- `ProductRating` — one rating per user per `StoreBlock`; `@@unique([productId, userId])`; `productId` references `StoreBlock.id` (mapped to the `Block` table)
- `StoreCategory` / `StoreTag` — store discovery taxonomy (see § Store Taxonomy below)

## Store Taxonomy (Categories & Tags) — TAG-STORE-1b

A **separate axis from `Page.pageType`**. `Page.pageType` (`store`/`service`/`fleet`/`learning`/...) is the *initiative type* — what kind of venture this is. `StoreCategory`/`StoreTag` are *discovery metadata* — what a store sells/how it operates, used for browsing and filtering. A single `store`-type Page can be tagged "Food & Restaurant" + "home-delivery" + "veg-only".

**Models** (migration `20260621000000_add_store_category_tag`):
- `StoreCategory` (`id`, `slug` unique, `order`) — flat list, **no `parentId` hierarchy**
- `StoreCategoryTranslation` (`categoryId`, `locale`, `title`, `description?`) — `@@unique([categoryId, locale])`, mirrors `TabTranslation`
- `StoreCategoryLink` (`storeId`, `categoryId`) — composite PK M2M, cascade-delete both sides
- `StoreTag` (`id`, `slug` unique, `order`) — flat list
- `StoreTagTranslation` (`tagId`, `locale`, `title`) — `@@unique([tagId, locale])`, title-only (no description)
- `StoreTagLink` (`storeId`, `tagId`) — composite PK M2M, cascade-delete both sides

**Controlled vocabulary** (15 categories, 15 tags — see `prisma/seed-store-taxonomy.js` for the full lists and English copy):
- Categories: `grocery`, `food`, `vegetables`, `dairy`, `meat`, `pharmacy`, `clothing`, `tailor`, `electronics`, `hardware`, `stationery`, `salon`, `home_services`, `handmade`, `services`
- Tags: `home-delivery`, `pickup-available`, `upi-accepted`, `cash-only`, `open-late`, `open-24x7`, `veg-only`, `non-veg`, `women-led`, `made-to-order`, `wholesale`, `organic`, `second-hand`, `repair-service`, `bulk-discount`

**Seeding**: `node prisma/seed-store-taxonomy.js` (standalone, not chained into `seed.js`) — upserts the vocab, then upserts translations for every enabled `Language` row (16 languages × 15 categories + 16 × 15 tags = 480 translation rows). Falls back to copying the English `title`/`description` when `LIBRE_TRANSLATE_URL` is unset or unreachable. Also links the sample store "Breakfast by Arun" (if it exists) to `food` + `home-delivery`/`upi-accepted`/`veg-only`/`made-to-order` for testing.

### Owner category/tag picker (TAG-STORE-1c-fix)

**Status: owner-side wired up.** `GET /api/store/all` and customer-facing discovery/filtering UI are still NOT wired to these tables — that remains deferred (TAG-STORE-2+, Phase 3).

- **`GET /api/store/taxonomy?locale=xx`** — public, no auth. Returns `{ categories: [{id, slug, title, description}], tags: [{id, slug, title}] }`. Each string falls back `locale → "en" → slug` if a translation row is missing.
- **`GET /api/store/[id]`** additionally returns `categoryIds: string[]` and `tagIds: string[]` (derived from `StoreCategoryLink`/`StoreTagLink` rows via a `select` on the existing query).
- **`PATCH /api/store/[id]` — `categoryIds`/`tagIds` write contract**:
  - Both fields are **optional and independent**. Omitting a key leaves that axis untouched.
  - Passing an array (including `[]`) **replaces** the full set for that axis: each is a `$transaction([deleteMany, createMany({ skipDuplicates: true })])` against `StoreCategoryLink`/`StoreTagLink`. An empty array clears all links for that axis.
  - `categoryIds.length > 3` → `400 { error: "Pick up to 3 categories" }`. `tagIds` is uncapped.
- **`components/earn/StoreTaxonomyPicker.tsx`** — controlled component, two `flex flex-wrap gap-2` rows of `PillButton` toggles (categories soft-capped at 3 with a hint when at cap; tags uncapped). Wired into `components/earn/InitiativeTabs.tsx` Store tab, between the "Taking orders" toggle and the location nag. Seeds initial selection from `categoryIds`/`tagIds` on the existing store fetch, fetches `/api/store/taxonomy?locale=` separately, and Saves both arrays via the PATCH contract above (always sends both keys).
- **UI strings**: 8 new `Tab`/`TabTranslation` rows (`store-categories-label`, `store-categories-prompt`, `store-tags-label`, `store-tags-prompt`, `store-taxonomy-save`, `store-taxonomy-saving`, `store-taxonomy-saved`, `store-categories-cap`), seeded by `prisma/seed-store-taxonomy-ui.js` across all 16 enabled languages (128 rows), consumed via `useTranslations()`.

## Store Discovery — map + list, filters, gate (DISCOVER-1b)

Customer-facing discovery at `/app/discover`. This is the first consumer of the Store Taxonomy tables for filtering, and the first feature that requires an address before showing any content.

### `GET /api/store/all` — extended (additive)

New optional query params, all additive — existing callers (e.g. `/app/saved`, which calls with no params) get the same fields plus new ones, unchanged behavior when params are absent:

- `categoryIds` — comma-separated `StoreCategory.id` list
- `tagIds` — comma-separated `StoreTag.id` list
- `addressLat` / `addressLng` — floats; when both present, response is sorted by distance

**Filter semantics — OR within an axis, AND across axes (locked)**: each axis (`categoryIds`, `tagIds`) is only added to the `where.AND` array when it has selections. Within an axis, matching is `some: { id: { in: [...] } }` (OR). Across axes, the conditions are combined with `AND`:
```ts
where: {
  deletedAt: null,
  AND: [
    { categories: { some: { categoryId: { in: categoryIds } } } }, // only if categoryIds.length
    { tags: { some: { tagId: { in: tagIds } } } },                   // only if tagIds.length
  ],
}
```
A store matching ANY selected category AND ANY selected tag is returned. No filters selected → behaves exactly as before (all stores, `deletedAt: null`, `take: 50`).

**Response per store** (extended):
```ts
{ id, name, slug, description, previewImage, lat, lng, acceptingOrders, categoryIds, tagIds, distanceKm }
```
- `lat`/`lng`/`acceptingOrders` come from `lib/store/getStoreGeo.ts` — a raw-SQL batch helper mirroring `getStoreSlugs.ts` (`SELECT id, lat, lng, "acceptingOrders" FROM "Store" WHERE id IN (...)`), per the stale-Prisma-client doctrine — lat/lng are never put in a typed `select`.
- `categoryIds`/`tagIds` come from batched `prisma.storeCategoryLink.findMany`/`storeTagLink.findMany` (typed — these models are current), grouped client-side into `{ [storeId]: id[] }` maps.
- `distanceKm` — `haversineKm(addressLat, addressLng, store.lat, store.lng)` when both the address and the store have coordinates, else `null`. A store with no coordinates is **never excluded** — it just sorts last and shows "Distance unknown".
- When `addressLat`/`addressLng` are present, results are sorted ascending by `distanceKm` with `null` treated as `Infinity` (NULLS LAST). Without an address, order is unchanged (`createdAt desc`).

### `lib/store/getStoreGeo.ts`
`getStoreGeo(ids: string[]) → Record<id, { lat: number|null, lng: number|null, acceptingOrders: boolean }>`. Same shape/pattern as `getStoreSlugs.ts`.

### `/app/discover` — thin wrapper + gate (DOC-7, locked)
`app/app/discover/page.tsx` owns only: fetching `GET /api/store/address` (credentials: include — bare array response, same as `/app/saved`), and a three-way render:
- `addresses === null` (loading) → `<DiscoverSkeleton/>`
- `addresses.length === 0` → `<NoAddressGate onAdded={...}/>` — centered prompt + button opens `AddressForm` in a panel; on save (`POST /api/store/address`), `onAdded(newAddr)` flips local state so `DiscoveryView` mounts immediately with that address — **no navigation, no re-fetch**.
- `addresses.length > 0` → `<DiscoveryView addresses={addresses} initialAddressId={addresses[0].id}/>` (the GET already orders `isDefault desc, createdAt asc`, so `addresses[0]` is the default-first address).

**There is deliberately no "unsorted list, no address" fallback** — both map and list are gated behind having at least one address. Do not build a third path.

### `components/store/DiscoveryView.tsx` — reusable, prop-driven
Takes `{ addresses, initialAddressId }` and owns all interaction state: selected address (dropdown, last option "Add new address" → inline `AddressForm`, same save flow as the gate), category/tag filter pills (read-only toggles fetching `GET /api/store/taxonomy?locale=`, reusing the existing `store-categories-label`/`store-tags-label` strings from TAG-STORE-1c rather than duplicating them), and a map/list view toggle.

**One shared fetch** to `GET /api/store/all?categoryIds=&tagIds=&addressLat=&addressLng=` runs on any change to selected address or filters; the map/list toggle is presentation-only and never triggers a refetch.

This component is intentionally **route-agnostic** — it is built for reuse by a future store-owner-facing surface with different inputs (e.g. a different default address or filter set). Do not weld discovery logic into `/app/discover/page.tsx`.

### `components/store/DiscoveryMap.tsx` — multi-marker map
`dynamic(() => import(...), { ssr: false })`. Leaflet boot/icon-fix/hot-reload-guard/cleanup boilerplate is copied verbatim from `components/transport/TransportMap.tsx`. Maintains one `L.layerGroup` of store markers, diffed against the `stores` prop (add/move/remove — never tears down and rebuilds the whole map), plus one additional marker for the selected address styled like `TransportMap`'s blue self-position dot (`setView` to it on change). Stores with `lat`/`lng` null are excluded from markers; a small note below the map reports how many stores aren't shown.

### New UI strings (`prisma/seed-discover-ui.js`)
11 new strings (`app-discover-*`) seeded as `Tab`/`TabTranslation` rows across all 16 enabled languages (176 rows): `app-discover-map-view`, `app-discover-list-view`, `app-discover-near-heading`, `app-discover-select-address`, `app-discover-add-address`, `app-discover-distance-km`, `app-discover-distance-unknown`, `app-discover-no-stores-found`, `app-discover-map-missing-count`, `app-discover-gate-title`, `app-discover-gate-button`. `store-categories-label`/`store-tags-label` (TAG-STORE-1c) are reused, not re-seeded.

### `/app/saved` Browse tab — inline filter modal (DISCOVER-INLINE-1b)

The saved/wishlist page (`app/app/saved/page.tsx`) has two tabs: **Saved** (wishlist items) and **Browse** (store discovery). The Browse tab reuses `GET /api/store/all` with the same `categoryIds`/`tagIds`/`addressLat`/`addressLng` filter semantics as `/app/discover`.

**`components/store/DiscoveryFilterModal.tsx`** — a standalone bottom-sheet modal (mobile-first, `z-[150]` to sit above the bottom nav at z-100; `pb-16 sm:pb-0` to push panel content above the nav on mobile). Accepts `{ open, onClose, onApply }`. Lazy-fetches taxonomy and addresses on first open; resets filter selection (not the address) on close without Apply. Wraps `AddressForm` inline for adding a new address mid-filter.

**`components/store/FilterPill.tsx`** — shared atom. Renders a single toggleable pill (`active ? indigo filled : grey outline`). Used in: (1) the DiscoveryFilterModal body (category and tag rows); (2) the Browse tab header to show selected filter chips. No other dependencies — stateless, presentational.

**`activeFilters: DiscoveryFilters`** in `app/app/saved/page.tsx` drives the Browse fetch:
```ts
type DiscoveryFilters = {
  categoryIds: string[];
  tagIds: string[];
  addressLat: number | null;
  addressLng: number | null;
};
```
When filters are empty, `GET /api/store/all` is called with no filter params (returns all stores). When filters are set, the same OR-within/AND-across taxonomy semantics apply. Filter button label: "Filter stores" (0 active) / "{n} filters active" (n > 0).

**UI strings** — 5 new `Tab`/`TabTranslation` keys seeded by `prisma/seed-saved-filters-ui.js` (standalone — `node prisma/seed-saved-filters-ui.js`) across all 16 enabled languages (80 rows): `app-saved-filter-button`, `app-saved-filter-active`, `app-saved-apply-filters`, `app-saved-clear-filters`, `app-saved-filter-modal-title`. English-copy fallback when `LIBRE_TRANSLATE_URL` is unset.

**`/api/store/all` serves two surfaces** — both `/app/discover` and `/app/saved`'s Browse tab call this endpoint. The endpoint is fully filter-param-driven with no caller awareness. The gate (address required) is enforced by the page, not the API.

### Out of scope
Distance-based pricing is **not** built here — `distanceKm` is sort/display only. Any future delivery-cost-by-distance feature for discovery is a separate schema change.

## UPI VPA Payment Handle (REQBCAST-1b)

A provider's UPI VPA (`name@bank`) so a paying party can pay them **directly**. **DISPLAY/HANDOFF ONLY** — the platform never validates, collects, or escrows. Shape-validated (`name@bank`) at input, **never** resolution-checked against any bank/PSP. This is the prerequisite handoff primitive for the coming broadcast engine (REQBCAST-1c).

**Field homes** (both nullable `String`, added in migration `20260623000000_add_upi_vpa`):
- `Store.upiVpa` — a store's pay-to handle (most providers sell via a store).
- `Profile.upiVpa` — a user's personal pay-to handle, for service providers with no store. Supersedes the unwired `Profile.preferredPayment` (kept, not removed — see TECH_DEBT).

Both read/written via **raw SQL** (`$queryRaw`/`$executeRaw`) — same stale-client pattern as `Store.line1`/`lat`. Do not put `upiVpa` in a typed Prisma `where`/`select` until a full `prisma generate` runs.

**Validation** — `lib/payments/vpa.ts`: `isValidVpa(v)` (regex `^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$`) + `normalizeVpa(v)` (trim → string|null; empty clears). Shape only. Used by both the client setter and both API routes.

**API**:
- `GET /api/store/[id]` returns `upiVpa`; `PATCH /api/store/[id]` accepts `upiVpa` (omit = skip, `""`/null = clear, invalid shape → `400 { error: "Enter a valid UPI ID like name@bank." }`).
- `GET /api/user/profile` returns `profile.upiVpa`; `PATCH /api/user/profile` accepts `upiVpa` (same omit/clear/400 semantics).

**Components** (`components/payments/`):
- `VpaSettingCard` — owner setter; PATCHes `{ upiVpa }` to a given `endpoint`. Mounted in the Initiative Hub **Store tab** (`InitiativeTabs.tsx`, `endpoint=/api/store/[id]`, `tone="dark"`) and the user **Earning** section (`app/(User)/user/edit/page.tsx`, `endpoint=/api/user/profile`).
- `PayToVpa` — display/handoff atom: "Pay directly to {name}: `vpa` [Copy]". Renders the saved handle in `VpaSettingCard`; **the broadcast engine (REQBCAST-1c) is the intended paying-party consumer.**

**Handoff getter** — `lib/payments/getVpa.ts` `getPayToVpa({ storeId?, userId? })`: store handle first, falls back to the store owner's `Profile.upiVpa`. **No live consumer yet** — built and left ready for REQBCAST-1c (there is no checkout/direct-pay path in the app today).

**i18n** — 8 slugs seeded by `prisma/seed-vpa-ui.js` (category `ui-vpa`, all enabled languages): `pay-vpa-label`, `pay-vpa-placeholder`, `pay-vpa-help`, `pay-vpa-invalid`, `pay-vpa-save`, `pay-vpa-saved`, `pay-to-vpa-label`, `pay-vpa-copy`.

## Risks & Fragile Areas
- `Order.items` is a JSON snapshot — no referential integrity after checkout. Price changes after purchase do not affect existing orders, which is correct, but querying historical pricing requires parsing JSON.
- Cart is per-user per-store, not per-session. Guest users cannot have carts.
- **Two order creation paths exist**: `POST /api/store/orders` (cart-based) and `POST /api/store/orders/quick` (express). The cart-based path clears the cart after creating the order; the quick path never touches the cart. Do not conflate them.
- `QuickOrderModal` state is ephemeral (React only). If the user closes the modal mid-flow, the in-progress order data is lost. This is intentional — nothing is persisted until "Place Order" is clicked.
- `StoreBlock` serves double duty as product and lesson. The `actionType` field disambiguates, but the naming is confusing. Any schema change to block must be verified against course behavior.
- `prereqIds` on `StoreSection` is a JSON array of section IDs. There is no DB-level constraint — stale IDs are not detected.
- `BillingProfile.linkedStoreId` is optional and not validated at the DB level. A profile can technically be linked to a store the user no longer owns if ownership changes after profile creation.
- TODO: No payment integration found. Unclear whether orders are fulfilled manually or via a yet-to-be-integrated gateway.
- TODO: Confirm whether `StoreFilter.bannerId` links to a `StoreBanner` or is a different concept.
- **`StoreHero` `bannerUrl`/`avatarUrl` are dead fields** — the `Store` DB model has neither column. The frontend `Store` type declares them optional, so they silently render nothing. The live banner is `StoreBanner` (`isGlobal: true`) → `globalBanner` in the API response → rendered by `BannerZone`. `avatarUrl` exists only on `User` and `Page`.
- **AI setup transaction timeout** — `prisma.$transaction` default is 5 s; apply route sets `{ timeout: 30000 }`. Any new transaction with many sequential `await` calls must set an explicit timeout or it will expire mid-way (Prisma P2028).
- **`for-page` now returns `isNew`** — consumers of `GET /api/store/for-page/[pageId]` must handle the new `isNew: boolean` field. Existing callers that only destructure `storeId` and `storeSlug` are unaffected.
- **`StoreImage` field rename footgun**: old fields `name`, `imageUrl`, `imageKey`, `createdAt` no longer exist in the DB. Any code still referencing them will read `undefined` silently. Current fields: `url`, `fileHash`, `cloudinaryId`, `fileName`, `uploadedAt`.
- **Dedup only within a store**: `@@unique([storeId, fileHash])` is per-store, not global. The same file uploaded to two different stores creates two `StoreImage` rows and two Cloudinary assets (same `public_id` per store, Cloudinary deduplicates across uploads with the same `public_id`).
- **Image upload pipeline dependency**: if Cloudinary is unavailable, `uploadStoreImage` throws after the hash check step. The DB record is never created. The UI shows an alert. There is no retry queue.
- **Race condition window**: between steps 2 (hash check) and 4 (DB upsert) in `uploadStoreImage`, a duplicate upload can proceed to Cloudinary. The upsert in step 4 handles the DB side; Cloudinary deduplication via `public_id` handles the asset side. No orphaned assets are created.
- **Store slug + stale Prisma client**: `Store.slug` is in the DB but the Prisma typed client may not know about it if `prisma generate` failed with EPERM (dev server holds the DLL). All slug operations use `$queryRaw`/`$executeRaw` or `getStoreSlugs()` — never put `slug` in a typed Prisma `where`/`select` block until the client is regenerated by restarting the dev server.
- **`ProductRating.productId` is a `StoreBlock.id`** — the model name `StoreBlock` is mapped to the `Block` table. Do not confuse with a separate `Product` model (there is none).
- **Rating batch endpoint is not authenticated for reads** — `GET /api/store/products/ratings` returns public aggregate data with no auth check; `userRating` is `null` when not logged in.
- **Wishlist toggle footgun:** `POST /api/store/wishlist` is a toggle, not a create-only. Calling it when the item already exists *deletes* it. Always inspect `{ wishlisted }` in the response to know the resulting state. The endpoint requires both `blockId` **and** `storeId` — omitting `storeId` returns 400. There is no DELETE endpoint for wishlist items.
- **Order status filter is permissive:** `?status=` on the orders GET is not validated against an allowed list — any string value is passed directly to Prisma. An invalid status returns an empty array rather than an error.

## Backlinks
- [[START_HERE.md]] — store purchase flow
- [[database.md]] — model definitions
- [[pages.md]] — Page ↔ Store 1:1 relationship
- [[media.md]] — image upload for blocks and banners
- [[mobile-shell.md]] — store browsing in mobile app
