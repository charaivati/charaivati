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

## Purpose
Full e-commerce system allowing users to create storefronts, organize products into sections, manage filters and banners, accept orders, and handle wishlists and pinned stores. Also powers the course content structure (same block/section models).

## Responsibilities
- CRUD for Store, Section, Subsection, Block (product/lesson)
- Filter and banner management per store
- Deduplicated image library for store media (two-layer: DB hash + Cloudinary public_id)
- Cart management (per-user, per-store)
- Order creation, status tracking, and snapshot storage — two paths: cart-based (`POST /api/store/orders`) and express Buy Now (`POST /api/store/orders/quick`)
- Wishlist and pinned stores (user favorites)
- Delivery address management
- Billing profile management (multiple per user, optionally linked to a store for GST)
- Section tile management for visual layouts

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
| Out | Store page data with sections and blocks |
| Out | Cart state per user per store |
| Out | Order record with JSON snapshot of items at purchase time |
| Out | Wishlist and pinned store lists |
| Out | Billing profile list for invoice selection at checkout |
| Out | Deduplicated `StoreImage` record with `url`, `fileHash`, `cloudinaryId` |

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

### Store creation
1. User creates a `Page` with `pageType: 'store'`
2. API creates linked `Store` record
3. User adds sections, blocks, filters, and banners via separate API calls
4. Each section can have a `type` (grid, etc.) and `columns`/`rows` layout metadata

## Key API Routes

| Method | Route | Action |
|---|---|---|
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
| GET | /api/store/wishlist | List wishlisted items for current user |
| GET/POST | /api/store/pinned | Pinned stores |
| GET/POST | /api/store/address | Delivery addresses |
| GET/POST | /api/store/billing-profiles | List / create billing profiles |
| PATCH/DELETE | /api/store/billing-profiles/[profileId] | Update / delete a billing profile |
| POST | /api/block | Create block |
| POST | /api/section | Create section |

## Key Pages

| Page | Purpose |
|---|---|
| `app/store/[id]/page.tsx` | Main store page — browsing, cart, checkout, image library |
| `app/store/[id]/section/[sectionId]/page.tsx` | Section product grid with cart + wishlist; "Add to Cart" flashes "✓ Added"; "Buy Now" opens QuickOrderModal |
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
| `components/store/QuickOrderModal.tsx` | 4-step express checkout modal (Items → Address → Invoice → Confirm); ephemeral React state only, never writes to cart |

## Database Models Used
- `Store` — top-level store record
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
- **`StoreImage` field rename footgun**: old fields `name`, `imageUrl`, `imageKey`, `createdAt` no longer exist in the DB. Any code still referencing them will read `undefined` silently. Current fields: `url`, `fileHash`, `cloudinaryId`, `fileName`, `uploadedAt`.
- **Dedup only within a store**: `@@unique([storeId, fileHash])` is per-store, not global. The same file uploaded to two different stores creates two `StoreImage` rows and two Cloudinary assets (same `public_id` per store, Cloudinary deduplicates across uploads with the same `public_id`).
- **Image upload pipeline dependency**: if Cloudinary is unavailable, `uploadStoreImage` throws after the hash check step. The DB record is never created. The UI shows an alert. There is no retry queue.
- **Race condition window**: between steps 2 (hash check) and 4 (DB upsert) in `uploadStoreImage`, a duplicate upload can proceed to Cloudinary. The upsert in step 4 handles the DB side; Cloudinary deduplication via `public_id` handles the asset side. No orphaned assets are created.
- **Wishlist toggle footgun:** `POST /api/store/wishlist` is a toggle, not a create-only. Calling it when the item already exists *deletes* it. Always inspect `{ wishlisted }` in the response to know the resulting state. The endpoint requires both `blockId` **and** `storeId` — omitting `storeId` returns 400. There is no DELETE endpoint for wishlist items.
- **Order status filter is permissive:** `?status=` on the orders GET is not validated against an allowed list — any string value is passed directly to Prisma. An invalid status returns an empty array rather than an error.

## Backlinks
- [[START_HERE.md]] — store purchase flow
- [[database.md]] — model definitions
- [[pages.md]] — Page ↔ Store 1:1 relationship
- [[media.md]] — image upload for blocks and banners
- [[mobile-shell.md]] — store browsing in mobile app
