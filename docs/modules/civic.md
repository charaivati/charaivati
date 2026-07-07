# Civic Layer (CIVIC-1) — Units, Issues, Local Board

The civic layer turns "demand locally, collaborate upward" into a mechanism:
residents of a geographic **Unit** raise **Issues** (demands), upvote them, and
the ranked board shows validated local demand. This is Prompt 1 of the CIVIC
series (data model + Local issue board). Later prompts add AI duplicate-merge
(2), completion verification + Done list polish (3), campaigns (4), Nation/Earth
rollups (5), representative cards + letter drafts (6).

## Doctrine (locked)

- **One user = one home location** (`User.homeUnitId`, ward/panchayat only),
  changeable at most once per `HOME_UNIT_CHANGE_DAYS` (90). This is the
  brigading protection — without it any viral issue gets flooded by outsiders
  and locals stop trusting the rankings. Do not loosen for convenience.
- **Residents only** may raise and upvote issues in a unit (`homeUnitId` must
  equal the issue's `unitId`). Reading a board is open to any signed-in user.
- **Issue lifecycle**: `proposed → active → complete | archived`.
  - `proposed → active` happens automatically when `supporterCount` reaches
    `ACTIVATION_THRESHOLD` (10) — validated demand, not noise. Removal of a
    support never demotes back to `proposed`.
  - `complete` requires `COMPLETION_CONFIRMATIONS` (3) supporter confirmations
    (flow lands in Prompt 3; the `IssueConfirmation` table already exists).
    One person marking complete is gameable.
  - Archived issues reject support toggles (409).
- **One `Issue` model with a `scope` field** (`ward | assembly | nation |
  earth`, derived from the unit type via `scopeForUnitType()`) — never build
  per-layer issue models.
- String enums (`Unit.type`, `Issue.status`, `Issue.scope`) are **validated in
  the API, not the DB** (Todo.freq/assumptionKey precedent). Vocabulary +
  thresholds live in `lib/civic/constants.ts` — import from there, never
  inline.

## Schema (migration `20260707000000_add_civic_units_issues`)

- `Unit` — `type` (`ward|panchayat|assembly|state|country`), `name`,
  self-relation `parentId` (ward → assembly → state → country). cuid PK, so
  seed rows use stable readable ids (`civic-ward-chandmari`).
- `Issue` — `unitId`, `authorId`, `title`, `body`, `scope`, `status`,
  `category` (null until the Prompt-5 AI classifier), denormalized
  `supporterCount`, `resolvedAt`. Indexed `[unitId, status]` and
  `[unitId, supporterCount]`.
- `IssueSupport` — one row per upvote, `@@unique([userId, issueId])`.
  `supporterCount` is kept in the same `$transaction` as row create/delete.
- `IssueConfirmation` — `photoUrl?`, `@@unique([userId, issueId])`. Table
  ships now; the confirm flow is Prompt 3.
- `User.homeUnitId` / `User.homeUnitChangedAt` — home membership + change lock.

If `migrate dev` hits P3006 (shadow-DB baseline), apply via
`npx prisma db execute --file prisma/migrations/20260707000000_add_civic_units_issues/migration.sql`
then `npx prisma migrate resolve --applied 20260707000000_add_civic_units_issues`
(same precedent as `20260621000000_add_store_category_tag`). Run a full
`npx prisma generate` (server stopped on Windows) afterward — the civic routes
use the **typed** client, not `(prisma as any)`.

## API (all auth-gated via `getServerUser`; middleware does NOT protect these)

| Method | Route | Notes |
|---|---|---|
| GET | `/api/civic/units` | Home-unit picker list (`?type=` optional; defaults ward+panchayat) with parent names |
| GET | `/api/civic/units/[unitId]` | Unit + parent chain + platform resident count + caller membership |
| GET | `/api/civic/issues?unitId=&tab=open\|done\|archived` | Ranked (`supporterCount` desc). `open` includes `proposed` AND `active` — proposed issues must be visible to gather their first supporters |
| POST | `/api/civic/issues` | `{ unitId, title, body }` — resident-only (403), `scanInput` BLOCK check, rate-limited 5/user/24h, author auto-supports (count starts 1) |
| POST | `/api/civic/issues/[issueId]/support` | Toggle; resident-only; threshold promotion in the same transaction |
| POST | `/api/civic/home-unit` | `{ unitId }` — ward/panchayat only; 90-day change lock (429 with days remaining) |

## UI

`app/local/[unitId]/page.tsx` — client component, mobile-first, light app-shell
palette. Header (breadcrumb, resident count, home badge / "This is my area"
CTA / go-to-your-area redirect), Active/Done/Archived tabs, raise-issue inline
form (residents only), issue cards with rank number, status chip, upvote
toggle, "N of ~M residents" line. Skeletons in-page (client component — no
`loading.tsx` needed per loading-states doctrine). Coexists with
`app/(locality)/local/select-country` — static segment wins.

## Seed

`node prisma/seed-civic.js` — idempotent; India → Assam → Guwahati East → 2
wards + 10 issues across the lifecycle states. Boards:
`/local/civic-ward-chandmari`, `/local/civic-ward-beltola`. Seeded
`supporterCount` values have **no** backing `IssueSupport` rows (display test
data only); real counts are transaction-kept by the API.

## Known gaps (deliberate, for later prompts)

- No duplicate detection on create (Prompt 2 — the single most important AI
  feature here).
- No mark-complete flow yet (Prompt 3) — `complete` rows only via seed today.
- No archive/stale automation; no geo-resolution of location → unit (manual
  picker is the fallback path and currently the only path).
- `GET /api/civic/units` has no pagination — fine at seed scale, revisit when
  real ward data lands.
