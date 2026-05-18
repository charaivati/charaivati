---
module: collaboration
type: api + component
source: app/api/collaboration/, components/earn/
depends_on: [database, auth, pages, store]
used_by: [earn/initiative]
stability: evolving
status: active
---

# Module: Collaboration (Partners)

## Purpose
Allows one `Page` to send a partnership request to another `Page` with a typed role. Both the requester and receiver are `Page` records — not User records. Users interact through whichever page(s) they own.

## Responsibilities
- Create, list, accept, reject, cancel, and delete Page-to-Page collaboration records
- Resolve Store IDs and slugs to their linked Page IDs transparently on the POST path
- Surface active partners and incoming requests in the Initiative Hub Partners tab
- Provide store name search autocomplete for the invite form

## Database Model

```prisma
model Collaboration {
  id          String   @id @default(cuid())
  requesterId String                         // Page.id of the sending page
  receiverId  String                         // Page.id of the receiving page
  role        String                         // "delivery_partner" | "supplier" | "employee" | "marketing" | "other"
  status      String   @default("pending")   // "pending" | "accepted" | "rejected" | "cancelled"
  message     String?
  metadata    Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  requester Page @relation("CollabRequester", fields: [requesterId], references: [id], onDelete: Cascade)
  receiver  Page @relation("CollabReceiver",  fields: [receiverId],  references: [id], onDelete: Cascade)

  @@unique([requesterId, receiverId, role])
  @@index([requesterId])
  @@index([receiverId])
  @@index([status])
}
```

`Page` gains two back-relations:
```prisma
collaborationsOut Collaboration[] @relation("CollabRequester")
collaborationsIn  Collaboration[] @relation("CollabReceiver")
```

## API Routes

| Method | Route | Who can call |
|---|---|---|
| POST | /api/collaboration | Session user who owns the requester page |
| GET | /api/collaboration?pageId=&direction=in\|out&status= | Session user who owns pageId |
| PATCH | /api/collaboration/[id] | Receiver's owner (accept/reject) or requester's owner (cancel) |
| DELETE | /api/collaboration/[id] | Session user who owns either page |
| GET | /api/store/search?q= | Any authenticated user — name autocomplete |

### POST body
```json
{ "requesterId": "page-cuid", "receiverId": "page-cuid-or-store-id-or-slug", "role": "supplier", "message": "optional" }
```
`receiverId` resolution order:
1. Direct Page ID match
2. Store ID match → uses `Store.pageId`
3. Store slug match → uses `Store.pageId`
4. Returns 404 if none found or store has `pageId: null`

### GET params
- `pageId` — required; must be owned by session user
- `direction` — `in` (receiverId=pageId) or `out` (requesterId=pageId); default `out`
- `status` — `pending | accepted | rejected | cancelled | all`; default `all`

### PATCH body
```json
{ "status": "accepted" }   // receiver's owner
{ "status": "rejected" }   // receiver's owner
{ "status": "cancelled" }  // requester's owner
```

### PATCH response — critical
The update response **must** include `requester` and `receiver` page fields:
```typescript
prisma.collaboration.update({
  where: { id },
  data: { status },
  include: {
    requester: { select: { id, title, pageType, avatarUrl } },
    receiver:  { select: { id, title, pageType, avatarUrl } },
  },
})
```
Without this include, `updated.requester` is `undefined` and the frontend crashes reading `.title`.

## UI Components

### `components/earn/InitiativeTabs.tsx`
Client component shell. Manages `activeTab: "overview" | "store" | "partners"`. Receives:
- `pageId` — the initiative page being managed
- `pageType` — for tab content logic
- `storeName`, `storeSlug`, `storeId` — for the Store tab
- `ownerPages` — all pages owned by the current user; passed to PartnersTab

### `components/earn/PartnersTab.tsx`
Client component rendered inside the Partners tab. On mount fires three parallel fetches:
1. `GET …&direction=in&status=accepted`
2. `GET …&direction=out&status=accepted`
3. `GET …&direction=in&status=pending`

Merges and deduplicates accepted results. Sections:
- **Active Partners** — emoji by role, partner page title, role badge, pageType badge, Revoke (DELETE)
- **Incoming Requests** — shown only when non-empty; requester title + role + optional quoted message; Accept / Reject (PATCH)
- **Invite a Partner** — "Sending as" dropdown (only when user owns >1 page), debounced store name search, role selector, optional message, Send (POST)

Role emoji map: `delivery_partner→🛵 supplier→📦 employee→👤 marketing→📣 other→🤝`

### Store search autocomplete
- Input debounced 300ms → `GET /api/store/search?q=`
- Dropdown shows `[Store Name] · [slug or id-prefix]`
- Selecting a result locks the field with ✓ and shows the resolved Store ID below
- `handleInvite` uses `selectedStore.id` if a store was selected; falls back to raw text for manual ID entry

## Inputs & Outputs

| Direction | Value |
|---|---|
| In | Session cookie (server component + API) |
| In | `requesterId`, `receiverId`, `role`, optional `message` |
| In | Store name query string (autocomplete) |
| Out | `Collaboration` record with `requester` and `receiver` page data |
| Out | `{ id, name, slug, pageId }[]` (store search) |

## Dependencies
- **auth** — all endpoints require a valid session
- **pages** — both sides of a Collaboration must have a `Page` record
- **store** — receiver resolution falls back to `Store.pageId`; store search queries `Store.name`

## Reverse Dependencies
- `app/earn/initiative/[pageId]/page.tsx` — fetches `collaborationsIn`/`collaborationsOut` on the Page; crashes at runtime if `Collaboration` table does not exist (migration not yet applied)
- `PartnersTab.tsx` — reads `.requester.title` / `.receiver.title` from every Collaboration record; any API response omitting these relations causes a runtime crash

## Risks & Fragile Areas
- **Migration dependency** — `Collaboration` table was created by running the SQL directly in Supabase (not via `prisma migrate dev`, which requires a shadow database connection). If the dev environment is rebuilt from scratch, the migration must be re-applied manually.
- **`pageId: null` stores cannot be partnered** — stores not created through the `openStore()` flow may have `pageId: null`. The POST handler returns 404 for these. No workaround without linking the store to a Page first.
- **One collaboration per requester↔receiver↔role triple** — attempting to send a duplicate returns 409. Users must revoke or cancel the existing record before creating a new one for the same role.
- **No pagination** — all active partners and pending requests are fetched in full. Under high collaboration volume this will slow down the Partners tab.

## Backlinks
- [[pages.md]] — `Page` as both sides of a Collaboration
- [[store.md]] — Store ID/slug resolution on POST; store search API
- [[auth.md]] — session required for all operations
- [[START_HERE.md]] — Initiative Hub and Collaboration flows
