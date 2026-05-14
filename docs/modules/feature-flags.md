---
module: feature-flags
type: library + api
source: lib/featureFlags.ts, app/api/feature-flags/, app/api/admin/feature-toggle/, components/FeatureGate.tsx
depends_on: [database]
used_by: [any feature requiring a gate]
stability: stable
status: active (flags currently always return true)
---

# Module: Feature Flags

## Purpose
Provides a runtime toggle system to enable or disable features without a code deploy. Flag state is stored in the `FeatureFlag` DB table and can be changed via the admin API. Currently, the `lib/featureFlags.ts` implementation returns `true` for all flags — the system is structurally in place but not actively used for gating.

## Responsibilities
- Store and retrieve flag state from the DB
- Expose an API for reading flag state client-side
- Provide an admin API for toggling flags
- Provide a `FeatureGate` React component for conditional rendering

## Inputs & Outputs

| Direction | Value |
|---|---|
| In | Flag key (string identifier) |
| Out | Boolean: enabled or disabled |

## Dependencies
- **database** — `FeatureFlag` model (key, enabled, meta JSON)

## Reverse Dependencies (what breaks if this changes)
- If the current "always return true" behavior is reverted to real DB lookups, any feature wrapped in `FeatureGate` or a `isFeatureEnabled()` check will be gated by DB state. Features that have never had a `FeatureFlag` row created will default to disabled and disappear for users.
- `FeatureGate` component renders `null` for disabled features. If real gating is re-enabled, features wrapped in this component will silently disappear without a user-visible error.

## Runtime Flow

### Server-side flag check
1. Server code calls `isFeatureEnabled('flag-key')`
2. Currently always returns `true` — no DB lookup
3. TODO: When real gating is needed, this will query `FeatureFlag` by key

### Client-side flag check
1. Client fetches `GET /api/feature-flags`
2. API returns map of `{ [key]: boolean }`
3. Client uses result to conditionally render features

### Admin toggle
1. Admin POSTs to `POST /api/admin/feature-toggle` with `{ key, enabled }`
2. API upserts `FeatureFlag` row
3. Change takes effect on next flag evaluation (no cache invalidation)

## Key API Routes

| Method | Route | Action |
|---|---|---|
| GET | /api/feature-flags | List all flag states (public) |
| POST | /api/admin/feature-toggle | Toggle a flag (admin only) |

## Key Components / Functions

| Export | File | Role |
|---|---|---|
| `isFeatureEnabled()` | lib/featureFlags.ts | Check a flag server-side (currently always true) |
| `<FeatureGate>` | components/FeatureGate.tsx | Conditionally render children based on flag |

## Database Models Used
- `FeatureFlag` — key (unique), enabled (boolean), meta (JSON), createdAt, updatedAt

## Risks & Fragile Areas
- **Critical**: The current implementation always returns `true`. Any developer adding `isFeatureEnabled()` calls assumes real gating but gets none. This creates a false sense of feature control.
- When real gating is eventually activated, features without a corresponding `FeatureFlag` DB row will default to disabled. All existing guarded code paths must have rows pre-created or the default must be changed to `true`.
- No caching of flag state observed. Under real gating, every flagged request would hit the DB. A cache layer (Redis TTL) should be added before real gating is enabled.
- The admin toggle endpoint must be protected by an admin role check. TODO: Confirm that `POST /api/admin/feature-toggle` validates admin role.

## Backlinks
- [[START_HERE.md]] — feature flags noted as currently always-true
- [[database.md]] — FeatureFlag model
- [[redis-cache.md]] — caching layer needed if real gating is activated
