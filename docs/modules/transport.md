---
module: transport
type: api + component
source: app/api/transport/, components/transport/
depends_on: [database, auth]
used_by: [navigation-tabs]
stability: evolving
status: active
---

# Module: Transport

## Purpose
Real-time vehicle location tracking and display. Vehicles broadcast their GPS coordinates to the server; clients display all active vehicles on a Leaflet map. Supports buses, autos, taxis, metros, and other types.

## Responsibilities
- Accept and persist vehicle location broadcasts (lat, lng, accuracy)
- Serve current positions of all vehicles
- Render vehicles on a Leaflet map
- List vehicles in a sidebar

## Inputs & Outputs

| Direction | Value |
|---|---|
| In | Vehicle broadcast: busNumber, route, vehicleType, lat, lng, accuracy |
| Out | All current vehicle positions |
| Out | Rendered Leaflet map with vehicle markers |

## Dependencies
- **auth** — TODO: confirm whether broadcast endpoint requires authentication or is open
- **database** — `Vehicle` model
- **Leaflet** — map rendering library loaded client-side

## Reverse Dependencies (what breaks if this changes)
- `Vehicle` rows are updated (not appended) on each broadcast — each vehicle has one row. If the update key (presumably `busNumber` or similar) changes, stale rows accumulate indefinitely.
- The Leaflet map loads tile URLs from OpenStreetMap (`*.tile.openstreetmap.org`). This domain is in the CSP `img-src`. Removing it breaks the map entirely.

## Runtime Flow

### Broadcasting location
1. A vehicle operator (or automated client) POSTs to `POST /api/transport/broadcast`
2. Payload: `{ busNumber, route, vehicleType, lat, lng, accuracy }`
3. API upserts `Vehicle` row keyed by `busNumber` (TODO: confirm upsert key)
4. Sets `updatedAt` to current timestamp

### Displaying the map
1. Client fetches `GET /api/transport/vehicles`
2. API returns all `Vehicle` rows
3. `components/transport/TransportMap.tsx` renders a Leaflet map
4. Each vehicle is placed as a marker at its `lat`, `lng`
5. `components/transport/VehicleList.tsx` renders a sidebar list

### Broadcasting from component
1. `components/transport/broadcaster.tsx` runs in-browser
2. Reads device GPS via browser Geolocation API
3. POSTs coordinates to broadcast endpoint on an interval
4. TODO: Confirm broadcast interval and whether there is a heartbeat/stop mechanism

## Key API Routes

| Method | Route | Action |
|---|---|---|
| POST | /api/transport/broadcast | Upsert vehicle location |
| GET | /api/transport/vehicles | Fetch all current vehicle positions |

## Key Components

| Component | Role |
|---|---|
| `components/transport/TransportMap.tsx` | Leaflet map with vehicle markers |
| `components/transport/VehicleList.tsx` | Sidebar list of vehicles |
| `components/transport/broadcaster.tsx` | Browser GPS broadcaster |
| `components/transport/vehicles/broadcaster.tsx` | Vehicle-specific broadcast variant |

## Database Models Used
- `Vehicle` — busNumber, route, vehicleType (`Bus | Auto | Taxi | Metro | Other`), lat, lng, accuracy, updatedAt

## Risks & Fragile Areas
- `Vehicle` rows are never deleted. Vehicles that stop broadcasting remain in the table as stale positions. There is no TTL or staleness check. Clients display positions that may be hours or days old.
- Geolocation permission is restricted to `self` and `https://charaivati.com` in the `Permissions-Policy` header. If the broadcaster runs on a different origin or subdomain, the browser will deny GPS access.
- TODO: Confirm whether the broadcast endpoint is authenticated. An open broadcast endpoint allows anyone to spoof any vehicle's position.
- Two broadcaster components exist (`broadcaster.tsx` and `vehicles/broadcaster.tsx`). Their difference in responsibility is unclear. TODO: Confirm if one is deprecated.
- Leaflet requires `window` — it is a client-only library. If `TransportMap.tsx` is rendered server-side without a dynamic import guard, it will throw.

## Backlinks
- [[database.md]] — Vehicle model
- [[START_HERE.md]] — Leaflet listed in tech stack
- [[navigation-tabs.md]] — transport rendered within a layer tab
