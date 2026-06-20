# Request Broadcast Engine (REQBCAST-1c)

The inDrive/noticeboard primitive. A user posts a service request; nearby providers
who offer that category get a notification card, respond (optionally with a quoted
price), and the requester accepts ONE — then both settle DIRECTLY via the accepted
provider's UPI VPA. v1 ships `kind='service'` only.

## Doctrine (non-negotiable)

- **Noticeboard, NOT dispatcher.** The platform broadcasts and hands off contact +
  VPA. It NEVER assigns, NEVER sets the price, NEVER collects/escrows. The requester
  pays the accepted provider's VPA directly (reuses REQBCAST-1b `getPayToVpa` /
  `PayToVpa`).
- **Negotiation is pre-acceptance only.** A response MAY carry a quoted price;
  acceptance closes it. There is no post-accept bargaining flow.
- **Separate status fields.** `RequestBroadcast.status` (the broadcast's own
  lifecycle) and `RequestResponse.status` (per-response) are DISTINCT fields, judged
  at write-time. This deliberately avoids the `OrderStepProgress` footgun where one
  status literal (`"confirmed"`) means different things to different readers. The
  engine does **not** reuse OSP.

## Models (`prisma/schema.prisma`, migration `20260624000000_add_request_broadcast`)

### RequestBroadcast
`id, requesterId (FK User), kind ("service"|"errand"), categoryId (FK StoreCategory),
title, description, status ("open"|"accepted"|"cancelled"|"expired"), addressLat,
addressLng, radiusKm, acceptedResponseId (plain String? — no Prisma relation, avoids
FK cycle), createdAt, expiresAt.`
Errand-only **dormant** fields: `pickupLat, pickupLng, dropLat, dropLng,
suggestedPrice`. Indexes: `status`, `categoryId`, `createdAt`, `(addressLat,
addressLng)`.

### RequestResponse
`id, broadcastId (FK cascade), providerId (FK User), providerStoreId (FK Store?,
SetNull), quotedPrice, message, status ("pending"|"accepted"|"rejected"), createdAt.`
`@@unique([broadcastId, providerId])` — one response per provider per broadcast.

> Both tables applied via `prisma db execute` + `migrate resolve --applied` (P3006
> workaround precedent, same as TAG-STORE-1b). **Routes use raw SQL** (`$queryRaw` /
> `$executeRaw`) so the live dev server's Prisma engine client is never disturbed —
> same stale-client pattern as REQBCAST-1b's `upiVpa`.

## Eligibility query — `lib/requests/eligibility.ts`

`findEligibleProviders({ categoryId, lat, lng, radiusKm, excludeUserId? })`:
1. **Bounding-box pre-filter in SQL FIRST** (`lat BETWEEN .. AND ..`,
   `lng BETWEEN .. AND ..` from origin + radius — 1° lat ≈ 111.32 km, lng scaled by
   `cos(lat)`).
2. **Haversine refine in JS** (`lib/geo/haversine.ts`) to `distanceKm <= radiusKm`.
3. **Provider eligibility filter** (v1, store-declared): a `Store` with a
   `StoreCategoryLink` to `categoryId`, `deletedAt IS NULL`, lat/lng present, and an
   `EXISTS` check for a `StoreBlock` with `serviceType='service'`.

Returns `{ userId, storeId, distanceKm }[]` sorted by distance. The reverse query
(provider's incoming feed) lives inline in `GET /api/requests/incoming`.

## Routes (all under `app/api/requests/`, auth via session cookie)

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/requests` | Create a broadcast + fan out one Notification per eligible provider (`request_broadcast_created`), deduped by user, chunked `Promise.allSettled` (cap 10). `scanInput` BLOCK rejects title/description. Returns `{ ok, id, notified, eligibleCount }`. |
| GET | `/api/requests?locale=` | Requester's own broadcasts + their responses (+ `handoff` when accepted). Runs `expireStale()` first. |
| GET | `/api/requests/incoming?locale=` | Open broadcasts the caller is an eligible provider for (reverse eligibility); each carries the nearest matching `storeId`, `distanceKm`, and the caller's existing `myResponseStatus`. |
| POST | `/api/requests/[id]/respond` | Provider responds (optional `quotedPrice`, `message`, `providerStoreId`). Unique constraint → 409 on double-response. Notifies requester (`request_response_submitted`). |
| POST | `/api/requests/[id]/accept` | `{ responseId }`. Requester-only. Transaction: accept this response, auto-reject siblings, set broadcast `accepted` + `acceptedResponseId`. Notifies accepted (`request_accepted`) + rejected (`request_rejected`). Returns `{ handoff }`. |
| PATCH | `/api/requests/[id]` | `{ status: "cancelled" }` — requester cancels an open broadcast. |

## Lifecycle

```
requester POST /api/requests
  → findEligibleProviders → Notification per provider (request_broadcast_created)
provider GET /api/requests/incoming → sees card
provider POST /api/requests/[id]/respond { quotedPrice?, message? }
  → Notification to requester (request_response_submitted)
requester GET /api/requests → sees responses
requester POST /api/requests/[id]/accept { responseId }
  → accepted response wins, siblings rejected, broadcast=accepted
  → Notifications: request_accepted (winner) + request_rejected (others)
  → HANDOFF revealed: accepted provider name + phone + UPI VPA (getPayToVpa)
  → noticeboard ends here — no payment, no tracking
```

Expiry: a broadcast past `expiresAt` with no acceptance is flipped to `expired`
**lazily on read** (`expireStale()` global UPDATE at the top of the two GET routes) —
deliberately not an in-process `setTimeout` (doesn't survive restarts). See
`TECH_DEBT.md` §20(b).

## The VPA handoff

`resolveHandoff(providerId, providerStoreId)` (`lib/requests/common.ts`) →
`{ providerName, providerPhone, vpa }`. VPA comes from `getPayToVpa({ storeId })`
(store handle first, falls back to the owner's `Profile.upiVpa`). DISPLAY/HANDOFF
ONLY — nothing here moves or verifies money. Rendered by `PayToVpa` on `/app/requests`.

## UI — `app/app/requests/page.tsx`

Two tabs (`?tab=mine|incoming`):
- **My requests** — post form (single-select category via `FilterPill`, title,
  description, radius, origin from a saved Address), list of own broadcasts with
  responses, per-response Accept, Cancel, and the `PayToVpa` handoff once accepted.
- **Incoming** — eligible broadcasts with distance badge + inline respond
  (optional quoted price + message).

Entry point: a "Need a service? Post a request" CTA on `/app/discover` (where the
user already has location context). Provider notifications deep-link to
`/app/requests?tab=incoming`.

i18n: 32 slugs (category `ui-requests`) seeded by `prisma/seed-requests-ui.js` across
all enabled languages.

## Verification

`scripts/test-reqbcast.ts` — drives the REAL HTTP endpoints with REAL minted
sessions (mints cookies via `createSessionToken`). 16/16 checks: post + radius-scoped
fan-out (near notified, far not), incoming visibility (near sees, far doesn't),
respond + double-response 409, requester sees responses, accept → VPA+phone handoff +
sibling auto-reject + broadcast=accepted, re-accept 409, lazy expiry. Self-cleaning
fixtures.
Run (dev server up): `npx ts-node --project tsconfig.scripts.json scripts/test-reqbcast.ts`

## Tech debt — see `TECH_DEBT.md` §20
(a) no spatial index (bounding-box is the v1 mitigation); (b) lazy-on-read expiry;
(c) store-declared eligibility only (no user-level service offering); (d) errand
fields dormant; (e) `acceptedResponseId` is a plain column, no FK.
