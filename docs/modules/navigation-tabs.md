---
module: navigation-tabs
type: api + component + database pattern
source: app/api/tabs/, app/api/tab-translations/, components/LayerTabs.tsx, components/HeaderTabs.tsx, components/tabToComponentMap.tsx, components/defaultLayers.ts, components/useUserLayers.ts
depends_on: [database, auth]
used_by: [all layer pages (self, society, nation, earth, universe)]
stability: evolving
status: active
---

# Module: Navigation Tabs

## Purpose
Drives all page navigation within each layer. Rather than hardcoded routes, every tab visible to a user is resolved from the database (`Tab` table), with per-user overrides stored in `UserTab`. This makes navigation fully data-driven and supports multi-language, per-user customization, and admin-controlled tab rollouts.

## Responsibilities
- Serve canonical tab definitions per `Level`
- Apply per-user overrides (visibility, position, custom title) from `UserTab`
- Render tabs as a header bar in each layer page
- Map tab slugs to React components via `tabToComponentMap.tsx`
- Handle tab usage analytics
- Manage community tab proposals (create, vote, review)
- Provide tab translation management (admin)

## Inputs & Outputs

| Direction | Value |
|---|---|
| In | Authenticated user session (for user-specific tab state) |
| In | `levelId` — which layer's tabs to fetch |
| Out | Ordered list of visible tabs for the user in a given layer |
| Out | Resolved React component for the active tab slug |
| Out | Tab translation strings per locale |

## Dependencies
- **auth** — `UserTab` overrides are per-user; tab usage tracking requires a session
- **database** — Tab, Level, UserTab, TabTranslation, Proposal, Vote models

## Reverse Dependencies (what breaks if this changes)
- `Tab.slug` is the key used in `tabToComponentMap.tsx` to resolve a React component. If a slug changes in the DB without updating the component map, the tab renders nothing.
- `Level.key` (e.g. `self`, `society`, `nation`) is used throughout the codebase to identify which layer is active. Changing a key breaks routing, component resolution, and URL construction.
- `UserTab` stores position and visibility as sparse overrides. If the canonical `Tab` row is deleted, the `UserTab` row becomes orphaned. TODO: Confirm cascade behavior.
- `Tab.is_default` controls which tabs appear for new users without any `UserTab` rows. Changing this retroactively changes what new users see.

## Runtime Flow

### Rendering tabs for a layer
1. Layer page mounts (e.g. `/self`)
2. `useUserLayers` hook fetches user's tab config from `GET /api/tabs?levelId=...`
3. API merges canonical `Tab` rows with `UserTab` overrides for the current user
4. Returns ordered, filtered list of visible tabs
5. `LayerTabs.tsx` renders the tab bar
6. Active tab slug is resolved through `tabToComponentMap.tsx` to get the React component
7. Component is rendered as the tab body

### User customizing tabs
1. User opens `SelectTabsModal.tsx`
2. Fetches available tabs for the level
3. User toggles visibility or reorders
4. Client PATCHes `UserTab` rows (or creates them if first override)

### Admin managing canonical tabs
1. Admin accesses `/admin/translations` or `/admin/page-of-content`
2. API endpoints `GET/POST /api/admin/tabs` manage canonical `Tab` rows
3. Tab translations managed via `GET/POST /api/tab-translations`

### Community tab proposals
1. User submits a proposal (new tab idea) via `Proposal` create endpoint
2. Other users vote via `POST /api/proposals/[id]/vote` (TODO: confirm route)
3. Admin reviews and approves/rejects via `Review` create
4. Approved proposals can be promoted to canonical `Tab` rows

## Key API Routes

| Method | Route | Action |
|---|---|---|
| GET | /api/tabs | List tabs for a level (with user overrides) |
| POST | /api/tabs | Create canonical tab (admin) |
| GET | /api/tab-translations | List translations |
| POST | /api/tab-translations | Create translation |
| GET | /api/admin/tabs | Admin tab management |
| POST | /api/admin/tabs | Admin create/update tab |
| GET | /api/tags | Popular tag slugs (related) |

## Key Components

| Component | Role |
|---|---|
| `components/LayerTabs.tsx` | Renders tab bar for a given layer; manages active tab state |
| `components/HeaderTabs.tsx` | Header-level tab rendering variant |
| `components/tabToComponentMap.tsx` | Maps tab slugs → React component |
| `components/defaultLayers.ts` | Fallback layer config if DB tabs are unavailable |
| `components/useUserLayers.ts` | Hook: fetches and caches user's tab state |
| `components/SelectTabsModal.tsx` | Modal for user tab customization |

## Database Models Used
- `Level` — one per layer: key, name, order (6 records: self, society, state, nation, earth, universe)
- `Tab` — canonical tab: slug (unique), title, description, levelId, is_default, category, tags, gridCol, gridRow, position
- `UserTab` — sparse override: userId, tabId, levelId, position, visible, customTitle
- `TabTranslation` — multilingual content per tab: tabId, locale, title, description, slug, status
- `Proposal` — community tab suggestion
- `Vote` — user vote on a proposal
- `Review` — admin review of a proposal

## Risks & Fragile Areas
- `tabToComponentMap.tsx` is a static TypeScript map. New tabs added to the DB without a corresponding component entry render as blank. This is a silent failure.
- Merging canonical `Tab` and `UserTab` in the API must handle ordering correctly. If sorting logic is wrong, user-customized tab order is silently ignored.
- `Level` has exactly 6 rows. The platform assumes this. Adding a 7th level requires UI, routing, and middleware changes beyond just a DB row.
- `Tab.slug` uniqueness is enforced at the DB level, but community proposals use the same slug namespace. A proposal promoted to a canonical tab could collide with an existing slug.
- `TabTranslation.status` (`needs_review | approved`) implies a review workflow, but the approval gating in the API is unclear. TODO: Confirm whether unapproved translations are served to users.
- `defaultLayers.ts` is a hardcoded fallback. If it diverges from the DB state, users without a session see stale tab names.

## Backlinks
- [[START_HERE.md]] — tab system overview
- [[database.md]] — Tab, Level, UserTab, Proposal model definitions
- [[auth.md]] — session required for UserTab overrides
- [[goals-ai.md]] — goals rendered within Self layer tabs
- [[timeline.md]] — timelines rendered within Self layer tabs
