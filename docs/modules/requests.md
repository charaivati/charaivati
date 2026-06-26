# Request Broadcast Engine (REQBCAST-1c)

The inDrive/noticeboard primitive. A user posts a service request; nearby providers
who offer that category get a notification card, respond (optionally with a quoted
price), and the requester accepts ONE — then both settle DIRECTLY via the accepted
provider's UPI VPA. Two kinds: `kind='service'` (1c) and `kind='errand'` (1e — see
§ Errand mode).

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

**FLEET-STATE-1b — live presence override (ADDITIVE).** Both this query and the
incoming feed now `LEFT JOIN "ProviderPresence"` and resolve the matched position as
`COALESCE(presence.lat/lng, Store.lat/lng)`. The join is gated to a **fresh available**
presence (`mode='available' AND seenAt > NOW() - INTERVAL '5 minutes' AND lat/lng NOT NULL`),
so a provider with no presence row — or a stale one — falls through to their store
coords exactly as before. Presence is **never required**. See *Fleet provider presence* below.

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

## Errand mode (REQBCAST-1e — `kind='errand'`)

Pick-and-drop of **GOODS/TASKS ONLY** (courier/runner errands: pick up X from A,
drop at B). **NO passengers, no ride-share, no carpool** — carpool/ride-share is
deliberately NOT built pending legal review (Assam transport stance + insurance
liability). Any field or copy implying carrying people is out of scope.

Errand reuses the **entire** broadcast → respond → accept → VPA-handoff flow
unchanged. It differs from service in exactly three things: a pickup location, a
drop location, and a suggested price.

### Doctrine additions
- **Suggested price is a DISPLAY HINT only** — never enforced, never collected,
  never a floor/ceiling. The platform does not set price. A provider's response MAY
  quote a different price (pre-accept negotiation, QUOTE-BLOCK-1 intact).
- **Eligibility anchors on the PICKUP point**, not the requester's home — the runner
  must reach the pickup first.

### Schema
The dormant errand fields (`pickupLat/Lng`, `dropLat/Lng`, `suggestedPrice`) were
activated. Two new columns — `pickupLabel`, `dropLabel` (`String?`) — added via
raw-SQL `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` on the dev DB only (no migration
file, 1b/1c precedent). Labels are short readable strings (`"{name} — {city}"`),
`scanInput`'d, shown to providers so they see the rough pickup/drop area.

### Suggested-price helper — `lib/requests/suggestErrandPriceHint.ts`
`suggestErrandPriceHint(pLat, pLng, dLat, dLng)` → `Math.round(30 + 12 × km)` where
`km` is the pickup→drop Haversine distance. Flat placeholder constants — there is no
Store errand rate card to read (errands are requester-posted, no store at create).
Pure (imports only `haversineKm`), so the client post-form imports the SAME helper
for a live preview; the server recomputes and stores its own value at create time.
Named `*Hint` so no reader mistakes it for an authoritative fare. See TECH_DEBT §20(f).

### Eligibility
`findEligibleProviders` gained an optional `serviceTypes: string[] = ['service']`.
Service requests pass the default (`['service']`, unchanged). Errands pass
`['service','delivery']` so courier/delivery stores (a `StoreBlock
serviceType='delivery'`) qualify as runners. The broadcast's `addressLat/Lng` is set
to the pickup coords at create, so both `findEligibleProviders` and the incoming
reverse-eligibility query (which measure from `addressLat/Lng`) anchor on pickup with
no query rewrite. The incoming feed matches per-kind: a delivery-only store sees
errands but NOT service requests (verified).

### Routes & UI
`respond`/`accept` are 100% kind-agnostic — no change. `POST /api/requests` branches
on `kind`: errand requires `pickupLat/Lng` + `dropLat/Lng` (+ optional labels),
computes `suggestedPrice`, fans out with the broadened `serviceTypes`, and sends a
"New errand nearby" notification. Both GET routes return `kind`, `pickupLabel`,
`dropLabel`, `suggestedPrice`. UI: a Service ↔ Errand `FilterPill` toggle on the post
form; errand mode swaps the single location select for pickup + drop saved-address
selects (NO map) and shows the suggested-price hint live with "only a suggestion"
copy. Mine/Incoming cards render `📦 pickup → drop` + suggested price via the shared
`ErrandLine`. 8 new `ui-requests` slugs (see CLAUDE.md) seeded across all enabled
languages.

## One-off (temporary) pickup/drop locations (REQBCAST-1g)
A requester can be anywhere in the city, so errand pickup/drop are no longer limited
to saved addresses. **No schema change** — a temporary location is just coords + a
label that fill the existing `pickupLat/Lng/pickupLabel` (and drop) fields for that
one broadcast.

- **`LocSelect`** (inline in `app/app/requests/page.tsx`) renders the saved-address
  dropdown plus a `"Use a different location…"` option (`TEMP = "__temp__"` sentinel).
  Choosing it reveals `TempSearch`/`TempPicker` — a free-text address search via
  `geocodeSearch(query, bias?)` in `lib/geo/geocode.ts`. **(MAP-SEARCH-1b, 2026-06)
  switched this from a single-result Nominatim call to a 300ms-debounced Photon
  (`photon.komoot.io`) typeahead** returning up to 5 `{ lat, lng, label }` candidates
  as the user types, biased to the currently-resolved point when known. `photon.komoot.io`
  is in CSP `connect-src` alongside the still-present `nominatim.openstreetmap.org`
  entries (Nominatim remains in use for pincode lookup and `reverseGeocode` below).
- **Address-search, not pin-drop** — chosen over a map picker because of the standing
  no-map-in-modal preference; the typeahead gives coords + label without a map.
- **`resolveLoc(id, temp)`** unifies both sources: `id === TEMP` → the in-memory temp
  object; otherwise the saved `Address` (label `"{name} — {city}"`). `post()`, the live
  `errandHint`, and `canSubmit` all read the resolved `pickupLoc`/`dropLoc`, never the
  address id — so the **suggested price recomputes from the chosen coords**, saved or
  temporary.
- **Coords-not-saved doctrine** — a temporary location is NEVER written to the address
  book. The client never POSTs to `/api/store/address` for it. The optional
  **"save this address" checkbox was deliberately skipped**: `POST /api/store/address`
  mandates `name/phone/line1/city/state/pincode`, none of which a geocode search
  produces, so saving would require the full `AddressForm`.
- **Gate relaxed for errands only** — the errand form always shows pickup/drop
  `LocSelect`s (temp covers the zero-saved-address case); the `hasUsableAddr` gate still
  applies to service requests.
- **Server unchanged & proven** — the POST route reads `pickupLat/Lng/pickupLabel`
  from any source; `scripts/test-reqbcast.ts` already posts errands with arbitrary
  (non-address) coords+labels and verifies storage, pickup-anchored eligibility, and
  suggested price.
- **i18n** — 4 new `ui-requests` slugs (`requests-loc-different`,
  `requests-loc-search-placeholder`, `requests-loc-search`, `requests-loc-search-none`)
  seeded by `prisma/seed-requests-ui.js` across all 16 languages (English fallback).

## On-demand map picker for pickup/drop (REQBCAST-1g2)
Text geocoding is too brittle for imprecise queries, so the temp-location flow gained
an **on-demand** draggable map pin plus live-GPS pickup. **No schema change** — still
just coords + label. The map stays collapsed until tapped — a **deliberate exception**
to the no-map-in-modal preference, made because exact point-setting has no text-only
equivalent.

- **`TempSearch` → `TempPicker`** (inline in `app/app/requests/page.tsx`) — three paths,
  all resolving to the same `{ lat, lng, label }`:
  1. **Search** — existing `geocodeSearch()` (1g).
  2. **"Use my current location"** (pickup only, `allowGps` prop) — one-shot live GPS via
     `useGeolocation().startWatch`, stopped after the **first** fix (a `gotFix` ref guards
     a double-fire), then reverse-geocoded to a label. A single fix, **not** continuous
     tracking — distinct concern from FLEET-STATE-1b presence; do not conflate.
  3. **"Set on map"** — inline `components/shared/MapPicker.tsx` (Leaflet drag-pin, reused
     as-is via `dynamic(..., { ssr:false })`), centred on the current point → saved-address
     `defaultCenter` → Bangalore fallback. On **drag-end** the coords are reverse-geocoded
     (`reverseGeocode()` in `lib/geo/geocode.ts`, Nominatim `/reverse`, falls back to
     formatted coords) and the label updates live. Opening the map **seeds** the temp from
     the centre so "Use this location" works without a drag; Confirm just collapses it.
- **No-match fallback** — the "No match found" message offers "Set it on the map instead",
  which opens the picker. The map is the safety net when text search returns nothing.
- **Drop is search-first** (saved + search + map; GPS not emphasised). Suggested price and
  pickup-anchored eligibility recompute from the **final** resolved coords (GPS / search /
  pin-drag), same as 1g. Server unchanged; `scripts/test-reqbcast.ts` 25/25 already posts
  errands with arbitrary (pin-style) coords+labels.
- **i18n** — 7 new `ui-requests` slugs (`requests-loc-current`, `requests-loc-map`,
  `requests-loc-map-hint`, `requests-loc-map-confirm`, `requests-loc-map-fallback`,
  `requests-loc-reverse`, `requests-loc-locating`) seeded across all 16 languages
  (English fallback).

## The VPA handoff

`resolveHandoff(providerId, providerStoreId)` (`lib/requests/common.ts`) →
`{ providerName, providerPhone, vpa }`. VPA comes from `getPayToVpa({ storeId })`
(store handle first, falls back to the owner's `Profile.upiVpa`). DISPLAY/HANDOFF
ONLY — nothing here moves or verifies money. Rendered by `PayToVpa` on `/app/requests`.

## UI — two surfaces split by role (REQBCAST-1f)

The requester and provider sides now live on **different surfaces**:

- **Requester — `app/app/requests/page.tsx` ("My requests" only)**: post form
  (single-select category via `FilterPill`, Service ↔ Errand toggle, title,
  description, radius, origin from a saved Address) + list of own broadcasts with
  responses, per-response Accept, Cancel, and the `PayToVpa` handoff once accepted.
  The Mine/Incoming sub-tab toggle was removed — this component is requester-only.
- **Provider — `components/requests/IncomingRequests.tsx`**, mounted in the
  **Orders → Requests tab** (`app/app/orders/page.tsx`). Self-fetching
  (`GET /api/requests/incoming`); renders eligible broadcasts with distance badge +
  inline respond (optional quoted price + message). It sits as a **separate section
  above** the existing workflow Quote-request list (the two are different systems —
  noticeboard broadcasts vs. `OrderStepProgress` quotes — and are kept visually
  distinct, not merged). **Single source of truth** — the one place the Incoming
  feed is defined; the Orders tab imports it.

Entry points:
- **Requester**: the **`/app/saved` Browse toggle Services tab**
  (Stores · Products · Services) renders `RequestsPage` verbatim — products, stores,
  and services are the three peer "what do you need" modes. `/app/requests` is **kept
  as a standalone deep-link route** rendering the same (requester-only) component.
- **Provider**: **Orders → Requests** (`/app/orders?tab=requests`). All provider
  notification deep-links (`request_broadcast_created`, `request_accepted`,
  `request_rejected`) point here. The requester notification
  (`request_response_submitted`) still points to `/app/requests?tab=mine`.

**Standalone-route reconciliation**: `/app/requests` is requester-only now. A stale
`/app/requests?tab=incoming` deep-link (from notifications sent before 1f) is
redirected client-side to `/app/orders?tab=requests` in `RequestsPage`'s mount
effect — old links never dead-end. The earlier "Need a service? Post a request" CTA
on `/app/discover` was already removed in 1d.

i18n: 32 slugs (category `ui-requests`) seeded by `prisma/seed-requests-ui.js` across
all enabled languages, plus `app-search-services-tab` (category `ui-prodsearch`,
seeded by `prisma/seed-prodsearch-ui.js`) for the Services tab label.

## Fleet provider presence (FLEET-STATE-1b — P1)

Live foreground location so a request matches a fleet/runner where they ARE, not
where their store sits. **P1 = presence + live-matching + an Available toggle.** Mode
state machine (P2) and auto-pooling (P3) are NOT built. **Doctrine (locked):
foreground-only, adaptive cadence, distance-gated, match-on-recent.**

- **Model `ProviderPresence`** (migration `20260625000000_add_provider_presence`, raw-SQL
  P3006 path — dev DB only, mirrored into `schema.prisma`): `{ id, userId @unique → User
  cascade, lat Float?, lng Float?, seenAt DateTime?, mode @default("offline") }`, indexed on
  `(lat,lng)` and `seenAt`. **mode (P1): `"offline" | "available"`** (`"on_job"`/`"near_complete"`
  reserved for P2). Read/written via raw SQL (not in the stale typed client).
- **Eligibility resolution order**: bounding-box → Haversine refine → service-block filter,
  all run on the **effective** coords `COALESCE(fresh-presence, store)`. Additive — see the
  Eligibility section above. The canary is `scripts/test-reqbcast.ts` (25/25) — existing
  static providers must stay matched after any eligibility edit.
- **Freshness = 5 min, judged at READ time** in the eligibility SQL join, not by a
  scheduler. A stale row (>5 min) is offline-for-matching even if `mode='available'` —
  covers an app killed without a clean toggle-off.
- **`POST /api/presence { lat, lng, mode }`** — auth'd upsert on `userId`, stamps
  `seenAt=NOW()`. `available` requires lat/lng (400 otherwise); `offline` clears position.
  No GET — eligibility reads the row directly.
- **Adaptive cadence + distance gate are client-side** (`components/requests/AvailableToggle.tsx`,
  over `hooks/useGeolocation.ts`): runs only while available AND foregrounded (pauses on
  `visibilitychange` hidden), POSTs at most ~every 10s, **skips < ~250m** moves
  (`haversineKm`); toggle-OFF/unmount → stopWatch + `POST mode=offline`. No background
  location, no foreground service.
- **Surface**: Orders → Requests tab, above `IncomingRequests` (the provider's nearby-work
  feed — natural home for "Receive work"). Live pulse + last-updated time when ON.

## Verification

`scripts/test-reqbcast.ts` — drives the REAL HTTP endpoints with REAL minted
sessions (mints cookies via `createSessionToken`). 25/25 checks (16 service + 9
errand): post + radius-scoped fan-out (near notified, far not), incoming visibility
(near sees, far doesn't), respond + double-response 409, requester sees responses,
accept → VPA+phone handoff + sibling auto-reject + broadcast=accepted, re-accept 409,
lazy expiry; errand — delivery-only store excluded from SERVICE but notified for
ERRAND, pickup-anchored fan-out (eligibleCount=2), labels + suggested-price stored,
runner quotes a different price → accept → runner VPA handoff. Self-cleaning fixtures.
Run (dev server up): `npx ts-node --project tsconfig.scripts.json scripts/test-reqbcast.ts`

`scripts/test-presence.ts` — FLEET-STATE-1b P1: 8/8 checks against the real
`/api/presence` + `findEligibleProviders`. Proves a provider whose store is parked
~70km away matches near a request ONLY via a live presence; stale (>5min) and offline
presence both drop them back to store-fallback (no match). Both scripts accept
`TEST_BASE` to point at a non-:3000 dev server.

## Tech debt — see `TECH_DEBT.md` §20 (requests) and §22 (presence)
(a) no spatial index (bounding-box is the v1 mitigation); (b) lazy-on-read expiry;
(c) store-declared eligibility only (no user-level service offering); (d) ~~errand
fields dormant~~ — activated in 1e; (e) `acceptedResponseId` is a plain column, no
FK; (f) errand suggested-price uses flat placeholder constants (no Store rate card).
**§22 (presence):** P2 mode machine + P3 auto-pool upcoming; geofence-for-near-complete
deferred; foreground-only (no background location) by design; distance gate is
client-side only; no spatial index on `ProviderPresence`.

---

<!-- Moved from CLAUDE.md (2026-06-26) -->
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

