---
module: transport
type: api + component
source: app/api/transport/, components/transport/, hooks/useGeolocation.ts
depends_on: [database, auth, collaboration]
used_by: [earn/deliveries, order/track]
stability: evolving
status: active
---

# Module: Transport

## Purpose
Real-time vehicle GPS broadcast and display. Originally a public transit tracker; now also powers the **delivery partner live-location** feature — delivery partners broadcast their coordinates via the same API, and buyers watch on the order tracking page.

## Responsibilities
- Accept and upsert vehicle location broadcasts (lat, lng, accuracy)
- Serve current positions — all vehicles or a single vehicle by ID
- Render vehicles on a Leaflet map (`TransportMap`)
- Provide a Capacitor-aware GPS abstraction (`useGeolocation` hook)

## The `useGeolocation` Hook (canonical GPS entry point)

`hooks/useGeolocation.ts` exports `useGeolocation()` → `{ startWatch, stopWatch }`.

- **Tries `@capacitor/geolocation` first** — requests permission, then `watchPosition`. Works in the Android/iOS native shell.
- **Falls back to `navigator.geolocation.watchPosition`** in browser.
- **Never call `navigator.geolocation` directly** in new code — it silently fails inside the Capacitor shell where the plugin is expected.
- The only permitted direct `navigator.geolocation` call is the one-shot centering in `TransportMap.tsx` (pre-existing, not delivery-critical).

## Inputs & Outputs

| Direction | Value |
|---|---|
| In | Vehicle broadcast: `id`, `busNumber`, route, vehicleType, lat, lng, accuracy |
| Out | Current position(s) of all or one vehicle |
| Out | Rendered Leaflet map with vehicle marker(s) |

## Dependencies
- **auth** — broadcast endpoint is authenticated (delivery partner must be logged in)
- **database** — `Vehicle` model
- **collaboration** — `Order.vehicleId` stores the `Vehicle.id` of the broadcasting delivery partner
- **Leaflet** — client-only map library; always use dynamic import guard

## Delivery Partner Flow

1. Partner opens `/earn/deliveries` → sees assigned out-for-delivery orders
2. Partner clicks "Start GPS" in `DeliveriesClient.tsx`
3. `useGeolocation()` → `startWatch()` → repeated calls to `POST /api/transport/broadcast`
4. Server upserts `Vehicle` row (keyed by `id` — a client-generated or Collaboration-derived ID); saves `Order.vehicleId`
5. Buyer at `/order/[id]/track` polls `GET /api/transport/vehicles?id={vehicleId}` every 5 s
6. Partner clicks "Stop" or "Mark Delivered" → `stopWatch()` → `Vehicle` row is deleted
7. `Order.vehicleId` is **not** cleared on stop. Tracking page detects the stale state because the vehicles API returns empty when `updatedAt < 2 min ago`.

## Runtime Flow

### Broadcasting location
1. `DeliveriesClient.tsx` calls `useGeolocation().startWatch(callback)`
2. Callback POSTs to `POST /api/transport/broadcast`: `{ id, busNumber, vehicleType, lat, lng, accuracy }`
3. API upserts `Vehicle` row by `id`; sets `updatedAt`
4. `PATCH /api/order/[id]/delivery { vehicleId }` stores the vehicle reference on the Order

### Displaying the map (delivery tracking page)
1. `app/order/[id]/track` polls `GET /api/transport/vehicles?id={vehicleId}` every 5 s
2. API filters: only returns the row if `updatedAt >= now - 2 min` (staleness guard)
3. `TransportMap.tsx` renders a single vehicle marker

### Displaying all vehicles (public transit view)
1. Client fetches `GET /api/transport/vehicles` (no id param)
2. Returns all `Vehicle` rows (no staleness filter on this path)
3. `TransportMap.tsx` and `VehicleList.tsx` render all markers

## Key API Routes

| Method | Route | Action |
|---|---|---|
| POST | /api/transport/broadcast | Upsert vehicle location (authenticated) |
| GET | /api/transport/vehicles | All current vehicle positions |
| GET | /api/transport/vehicles?id= | Single vehicle by ID (staleness-filtered) |

## Key Components

| Component | Role |
|---|---|
| `components/transport/TransportMap.tsx` | Leaflet map — renders vehicle marker(s) |
| `components/transport/VehicleList.tsx` | Sidebar list of all vehicles |
| `components/earn/DeliveriesClient.tsx` | Delivery partner UI — includes Start GPS modal with Broadcaster |
| `hooks/useGeolocation.ts` | Capacitor-aware GPS watch abstraction |

## Database Models Used
- `Vehicle` — `id`, `busNumber` (mapped `bus_number`), `route`, `vehicleType` (mapped `vehicle_type`), `lat`, `lng`, `accuracy`, `updatedAt` (mapped `updated_at`). Table mapped to `vehicles`.
- `Order.vehicleId` — plain `String?` field (not a Prisma relation) storing the `Vehicle.id` of the active broadcast

## Risks & Fragile Areas
- **`Order.vehicleId` is never cleared automatically** — stop/delete of the `Vehicle` row does not touch the Order. The tracking page must defensively handle a non-null `vehicleId` that returns no vehicle from the API (correct behavior — shows "GPS not available" instead of map).
- **`Vehicle` rows accumulate for public transit** — the all-vehicles endpoint has no staleness filter. Stale positions from hours ago appear for public transit. The delivery tracking endpoint (with `?id=`) does filter by 2 min.
- **Two old broadcaster components** (`broadcaster.tsx` and `vehicles/broadcaster.tsx`) predate `useGeolocation`. Their status is unclear — delivery features now use `DeliveriesClient.tsx` + `useGeolocation`. Do not add new GPS features using the old components.
- **Leaflet is client-only** — always wrap `TransportMap` with `dynamic(() => import(...), { ssr: false })`. Server-side rendering will throw.
- **Geolocation permission policy** — `geolocation` is restricted to `self` and `https://charaivati.com` in `Permissions-Policy`. The broadcaster will be denied on any other origin.

## Backlinks
- [[database.md]] — Vehicle model
- [[collaboration.md]] — delivery partner assignment via Collaboration
- [[START_HERE.md]] — Delivery Tracking flow
