# Store Soft-Delete (Whole-Venture Delete)

Owners can close a store/venture from `/store/account`. This is a **soft delete**
— the row never disappears from the database. Order history, invoices, and
collaboration records all survive intact; the venture simply stops being
discoverable, orderable, and editable, and can be restored later.

This mirrors the existing `User` soft-delete precedent (`status` +
`deletionScheduledAt`), simplified to a single `deletedAt DateTime?` marker since
there is no grace-period requirement for stores.

## Schema

Two fields, both `DateTime? @default(null)`, added via `db push` (no migration
file — same precedent as `Order.deliveryStatus`/`assignedToId`/etc.):

| Model | Field | Meaning |
|---|---|---|
| `Store` | `deletedAt` | null = active; timestamp = closed |
| `Page` | `deletedAt` | null = active; timestamp = closed (the linked initiative/page closes with its store) |

A store and its linked `Page` are deleted/restored **together** — "whole-venture
delete." If the DB is ever reset from migrations, re-add these two columns with
`db push` (there is no SQL migration file for them, exactly like the delivery
fields documented under "Known Footguns" in `CLAUDE.md`).

## Core logic — `lib/store/softDeleteStore.ts`

`softDeleteStore(storeId, ownerId)` is the single entry point both delete
handlers call. It:

1. Verifies the caller owns the store (`forbidden` / `not_found` otherwise).
2. **Blocks on open orders** — defined as any `Order` row for this store
   (including sub-orders, detected via `parentOrderId`) where `status` or
   `deliveryStatus` is **not** in `["delivered", "cancelled"]`. Returns
   `{ ok: false, reason: "open_orders", blockingOrders: [{ id, reason }] }`.
   Nothing is written when blocked.
3. On success, in a single `prisma.$transaction`:
   - Sets `Store.deletedAt = now`
   - Sets the linked `Page.deletedAt = now`
   - **Ends every `accepted` collaboration** touching that page (either side)
     by setting `Collaboration.status = "cancelled"` — **the existing terminal
     state**, reused rather than inventing a new field (see "Collaboration
     ended-state" below).
4. After the transaction commits, fires a `collaboration_ended` notification
   (fire-and-forget, try/catch per row — one failure never rolls back the
   delete) to the other side of each ended collaboration:
   > "Store \"{name}\" has closed; your role there has ended."

**Zero destructive deletes.** No `Order`, `Quote`, `OrderStepProgress`, or
`Collaboration` row is ever removed by this flow — only flags flip. This was a
hard requirement of the design (order history must survive a venture closing)
and is enforced by the verification script (see below).

## Collaboration "ended" state — not a gap

`Collaboration.status` already supports a terminal `"cancelled"` value used
elsewhere in the codebase as the ended/inactive marker. STOREDEL-BACKEND-1
**reuses it** rather than adding a new `"ended"` status or a boolean flag — this
keeps every other query that already filters on `status: "accepted"` correctly
excluding closed-venture collaborations with no further changes needed.

## Two delete entry points, one shared core

| Route | Context |
|---|---|
| `DELETE /api/store/my-stores` | body `{ id: storeId }` — used by `/store/account` |
| `DELETE /api/user/pages` | resolves the page's linked store first, then calls the same `softDeleteStore` |

Both return the same shapes:

```jsonc
// success
{ "ok": true }

// blocked on open orders — 409
{
  "error": "open_orders",
  "message": "This store has open orders — settle or cancel them before deleting.",
  "blockingOrders": [
    { "id": "...", "reason": "order still open (status: confirmed, delivery: processing)" },
    { "id": "...", "reason": "sub-order still open (status: confirmed, delivery: processing)" }
  ]
}

// not the owner — 403 { "error": "unauthorized" }
// doesn't exist     — 404 { "error": "store_not_found" }
```

## Action guards (the "teeth")

A flag alone does nothing if zombie writes can still land on a closed venture.
Two guard categories were added — both read `Store.deletedAt` and reject with a
**409** before any mutation:

### 1. Order-placement guards
`POST /api/store/orders` (cart) and `POST /api/store/orders/quick` (express) —
the existing raw-SQL store-status query (which already fetched
`acceptingOrders`/`deliveryFee`) now also selects `deletedAt`; if set, the route
returns the same `422` shape the closed-store check already used:
```json
{ "error": "This store is no longer accepting orders." }
```
(Reuses the existing `acceptingOrders` 422 contract — a deleted store is just a
permanently-closed store from the buyer's perspective. No new error shape for
buyers to handle.)

### 2. Collaborator-action guards (zombie-action rejection)
Five routes where a partner/assignee/owner could otherwise keep mutating order
state on a venture that has legally ceased to exist. Each fetches
`order.store.deletedAt` alongside its existing auth lookup and returns:

```json
{ "error": "This store has been deleted — no further actions are possible." }
```
Status **409**.

| Route | Guard location |
|---|---|
| `PATCH /api/order/[id]/delivery` | `app/api/order/[id]/delivery/route.ts:72-74` |
| `PATCH /api/order/[id]/step/[stepId]/confirm` | `app/api/order/[id]/step/[stepId]/confirm/route.ts:26-28` |
| `PATCH /api/order/[id]/step/[stepId]/fail` | `app/api/order/[id]/step/[stepId]/fail/route.ts:24-26` |
| `POST /api/order/[id]/quote/[quoteId]/respond` | `app/api/order/[id]/quote/[quoteId]/respond/route.ts:49-51` |
| `POST /api/order/[id]/quote/[quoteId]/accept` | `app/api/order/[id]/quote/[quoteId]/accept/route.ts:26-28` |

Pattern used in all five (mirror this for any future collaborator-action route):
```ts
const order = await prisma.order.findUnique({
  where: { id: orderId },
  select: { /* existing fields */, store: { select: { /* existing */, deletedAt: true } } },
});
if (order.store.deletedAt) {
  return NextResponse.json(
    { error: "This store has been deleted — no further actions are possible." },
    { status: 409 }
  );
}
```

## Listing queries — `deletedAt: null` filter applied

Public/discovery-facing queries now exclude soft-deleted stores:

- `app/api/fleet/[pageId]/route.ts` — `if (page.deletedAt && !isOwner) return 404`
- `app/api/store/wishlist/route.ts` — `where: { userId, store: { deletedAt: null } }`
- `app/api/store/pinned/route.ts` — `where: { userId, store: { deletedAt: null } }`
- `app/api/collaboration/route.ts` — `deletedAt: null` added to the `store.findFirst` OR-clause that resolves `receiverId`
- `app/api/course/[pageId]/route.ts` — `store.findFirst({ where: { pageId, deletedAt: null } })`
- `app/api/course/progress/route.ts` — same
- `app/api/health/my-experts/route.ts` — `deletedAt: null` added to `store.findMany` where
- `app/api/health-business/suggestions/route.ts` — same
- `app/earn/initiative/[pageId]/page.tsx` — owner is redirected to `/store/account` if `page.deletedAt` is set (the hub has nothing to manage for a closed venture)
- `app/api/store/[id]/route.ts` GET — a deleted store is invisible (`404`) to everyone except its owner; the owner sees a read-only/greyed view that can only be acted on via Restore
- `app/api/store/[id]/route.ts` PATCH — rejects edits to a deleted store with `409 { error: "This store has been deleted. Restore it before making changes." }` — owner must restore first

### Deliberate exceptions — do NOT add `deletedAt: null` here

- **`/api/store/my-stores`** (owner dashboard) — intentionally shows deleted
  stores too, greyed out with a "Deleted" pill and a **Restore** button instead
  of the normal action set. This is the owner's management surface for closed
  ventures.
- **`/api/store/orders?all=true`** — historic orders from now-closed stores
  remain visible (read-only cross-store monitor); each order's `store` object
  now carries `deleted: boolean`, and `/store/orders/all` renders a grey
  "Store closed" badge pill next to the store name. Filtering these out would
  make a buyer's own purchase history disappear.
- **Owner CRUD routes** (`PATCH /api/store/[id]`, etc.) — reject edits with 409
  rather than silently filtering, so the owner gets an actionable message
  ("restore it first") instead of a confusing no-op.
- **Collaborator dashboards** (`/earn/deliveries`, Partners tab, etc.) — need
  no explicit filter; they already query through `Collaboration.status =
  "accepted"`, and closed-venture collaborations are flipped to `"cancelled"`
  by the delete itself, so they drop out naturally.

## Restore — `PATCH /api/store/[id]/restore`

Owner-gated. Reverses the flags:

```ts
// app/api/store/[id]/restore/route.ts
```

1. 401 if not logged in, 404 if the store doesn't exist, 403 if not the owner,
   `400 { error: "not_deleted", message: "This store is already active." }` if
   it isn't currently deleted.
2. **Slug re-check** — another store may have claimed this store's old slug
   while it was deleted. If a live conflict is found
   (`slug = X AND id != this AND deletedAt IS NULL`), a fresh unique slug is
   minted via `generateSlug(name) + randomSuffix()` and written with
   `$executeRaw` (raw SQL — `slug` is a stale-client field per the existing
   footgun note). Response carries `{ slug, slugChanged: true }` so the UI can
   tell the owner "it now lives at a new address."
3. Clears `Store.deletedAt` and the linked `Page.deletedAt` in one
   `prisma.$transaction`.

Response: `{ ok: true, slug: string | null, slugChanged: boolean }`.

### Known follow-up — Collaboration re-activation is OUT OF SCOPE

Restore deliberately does **not** revive collaborations that were ended
(flipped to `"cancelled"`) at delete time — re-establishing a partnership is a
two-sided decision that shouldn't be silently forced back on the other party.
**The owner must manually re-invite partners/team members after restoring.**
This is a documented, intentional gap — not an oversight. If automatic
re-activation is ever wanted, it would need the other party's consent (e.g. a
re-invite-and-accept flow), not a blind status flip.

## UI — `/store/account`

Each store card now branches on `deletedAt`:

- **Active**: normal "Visit store" / "Manage orders" / **Delete** actions.
- **Deleted**: greyed (`opacity: 0.6`, lighter background `#F8FAFC`), red
  "Deleted" pill, single **Restore** action. Inline message area surfaces
  errors (`open_orders` blocking list, restore failures) and the
  slug-changed notice.

`handleDeleteStore` shows a `window.confirm` warning before calling
`DELETE /api/store/my-stores`:
> "Delete \"{name}\"? This closes the venture for everyone — partners are
> notified and the store disappears from listings. You can restore it later if
> it has no open orders blocking you."

## Verification

`scripts/test-store-softdelete.ts` — run with:
```bash
ALLOW_TEST_BYPASS=true npx ts-node --project tsconfig.scripts.json scripts/test-store-softdelete.ts
```
21/21 checks across all 7 scenarios (open-order block incl. sub-orders,
successful delete + collaboration-ended + notification, forbidden/not-found,
order-placement guard, all five zombie-action guards returning 409, listing
filters, store/[id] visibility, restore + slug recheck + Collaboration-gap
confirmation). The script cleans up its own test users/stores/orders on
completion (children-before-parents FK order: `Quote` → `OrderStepProgress` →
`Order`).
