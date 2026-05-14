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
- Image library for store media
- Cart management (per-user, per-store)
- Order creation, status tracking, and snapshot storage
- Wishlist and pinned stores (user favorites)
- Delivery address management
- Section tile management for visual layouts

## Inputs & Outputs

| Direction | Value |
|---|---|
| In | Authenticated user session |
| In | Store/section/block metadata (title, price, media, type) |
| In | Cart actions (add, update quantity, remove) |
| In | Checkout payload (address, cart snapshot) |
| Out | Store page data with sections and blocks |
| Out | Cart state per user per store |
| Out | Order record with JSON snapshot of items at purchase time |
| Out | Wishlist and pinned store lists |

## Dependencies
- **auth** — all write operations require a valid session
- **database** — all store models live in Prisma schema
- **media** — image uploads for blocks, banners, store images via Cloudinary
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

### Checkout
1. Client POSTs to `POST /api/store/orders` with `storeId`, `addressId`
2. API fetches all cart items for user + store
3. Snapshots item titles, prices, and quantities into `Order.items` JSON
4. Creates `Order` with status `pending`
5. Clears cart items for that store
6. TODO: No payment gateway integration found — assumed cash-on-delivery or manual fulfillment

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
| POST | /api/store/[id]/images | Upload image |
| GET/POST | /api/store/cart/[storeId] | Cart read/write |
| POST | /api/store/orders | Checkout |
| GET | /api/store/orders/[id] | Order detail |
| GET/POST | /api/store/wishlist | Wishlist |
| GET/POST | /api/store/pinned | Pinned stores |
| GET/POST | /api/store/address | Delivery addresses |
| POST | /api/block | Create block |
| POST | /api/section | Create section |

## Key Components

| Component | Role |
|---|---|
| `components/store/FilterBar.tsx` | Renders filter chips, manages active filter state |
| `components/store/ManageFiltersPanel.tsx` | Admin panel for creating/reordering filters |
| `components/store/BannerZone.tsx` | Renders promotional banners for a store |
| `components/store/BannerEditForm.tsx` | Form for creating/editing a banner |
| `components/store/ImageLibraryPicker.tsx` | Upload and select images from store library |

## Database Models Used
- `Store` — top-level store record
- `StoreSection` — product grouping with layout
- `StoreSubsection` — sub-grouping within a section
- `StoreBlock` — individual product or lesson (dual-purpose)
- `SectionTile` — visual tile within a section
- `StoreFilter` — filterable category
- `StoreSectionFilter` — M2M: filter ↔ section
- `StoreBanner` — promotional banner
- `StoreImage` — media library entry
- `CartItem` — per-user per-block cart entry
- `Order` — purchase order with item snapshot
- `WishlistItem` — saved product
- `Address` — delivery address
- `PinnedStore` — user-saved store

## Risks & Fragile Areas
- `Order.items` is a JSON snapshot — no referential integrity after checkout. Price changes after purchase do not affect existing orders, which is correct, but querying historical pricing requires parsing JSON.
- Cart is per-user per-store, not per-session. Guest users cannot have carts.
- `StoreBlock` serves double duty as product and lesson. The `actionType` field disambiguates, but the naming is confusing. Any schema change to block must be verified against course behavior.
- `prereqIds` on `StoreSection` is a JSON array of section IDs. There is no DB-level constraint — stale IDs are not detected.
- TODO: No payment integration found. Unclear whether orders are fulfilled manually or via a yet-to-be-integrated gateway.
- TODO: Confirm whether `StoreFilter.bannerId` links to a `StoreBanner` or is a different concept.
- Image upload to store library goes through Cloudinary. If the Cloudinary integration fails, image management is completely blocked.

## Backlinks
- [[START_HERE.md]] — store purchase flow
- [[database.md]] — model definitions
- [[pages.md]] — Page ↔ Store 1:1 relationship
- [[media.md]] — image upload for blocks and banners
- [[mobile-shell.md]] — store browsing in mobile app
