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
| GET | `/api/civic/units` | Home-unit picker list (`?type=`, `?parentId=` optional; defaults ward+panchayat) with parent names, `status`, and resident counts for pending units |
| POST | `/api/civic/units` | Propose a missing ward/panchayat (public-driven coverage): `{ name, type, parentId }`, parent must be assembly/parliamentary/state, dup-name 409 under same parent, `scanInput` check, `UNIT_PROPOSALS_PER_DAY` rate limit. Creates status `pending`; verifies automatically at `UNIT_VERIFY_RESIDENTS` residents (checked on home-unit set) |
| GET | `/api/civic/ratings?unitId=X` | Area quality: fixed `AREA_PARAMETERS` (water, electricity, …), per-parameter `{avg, count}` + caller's own scores + `canRate` (resident) |
| POST | `/api/civic/ratings` | `{ unitId, parameter, score 1–5 }` — resident-only upsert (one row per user × unit × parameter, updatable); returns the fresh average |
| GET | `/api/civic/units/[unitId]` | Unit + parent chain + platform resident count + caller membership |
| GET | `/api/civic/issues?unitId=&tab=open\|done\|archived` | Ranked (`supporterCount` desc). `open` includes `proposed` AND `active` — proposed issues must be visible to gather their first supporters |
| POST | `/api/civic/issues` | `{ unitId, title, body }` — resident-only (403), `scanInput` BLOCK check, rate-limited 5/user/24h, author auto-supports (count starts 1) |
| POST | `/api/civic/issues/[issueId]/support` | Toggle; resident-only; threshold promotion in the same transaction |
| POST | `/api/civic/home-unit` | `{ unitId, auto? }` — ward/panchayat only; 90-day change lock (429 with days remaining). `auto: true` is address auto-placement: only when no home unit is set, leaves `homeUnitChangedAt` null so the lock does NOT start from a machine guess; the first manual pick/confirm starts it. GET returns `autoPlaced` (placed but never confirmed) |
| GET | `/api/civic/suggest-unit` | Ranks ward/panchayat units against the caller's saved `Address` rows (name match on unit + ancestor chain vs city/state/line1, best-effort pincode→district/block/office enrichment via api.postalpincode.in). Returns `suggestions` + `autoPlaceScore` (`AUTO_PLACE_SCORE` in constants) |

## UI — three surfaces, one board component

**`components/civic/IssueBoard.tsx` is the one board implementation**
(prop-driven, DiscoveryView precedent: `unitId`, `standalone?`, `theme:
"light" | "dark"`). Header (breadcrumb, resident count, home badge / "This is
my area" CTA / go-to-your-area redirect), Active/Done/Archived tabs,
raise-issue inline form (residents only), issue cards with rank number, status
chip, upvote toggle, "N of ~M residents" line. Do not fork a second board.
`components/civic/UnitPicker.tsx` is the home-unit picker: address-based
suggestion dropdown (pre-selected best match from `/api/civic/suggest-unit`)
above the manual search list. With `autoApply` (Society LocalTab only) a
unique match scoring ≥ `AUTO_PLACE_SCORE` places the user with zero clicks.
`components/civic/HomeUnitSelect.tsx` is the correction path above the board:
current area + change dropdown; shows a confirm/change hint while `autoPlaced`
is true (auto-guesses never start the 90-day lock — confirm/manual change does).

1. **`/society` "Panchayat/Ward" tab** (`app/(with-nav)/society/tabs/LocalTab.tsx`)
   — the desktop home. Bootstraps via `GET /api/civic/home-unit`: home unit set
   → `<IssueBoard theme="dark" />` for it; none → `<UnitPicker theme="dark" />`.
   This REPLACED the old `GovernanceTabTemplate` topic-grid stub whose
   "observations" only went to `console.log` (never persisted). The template
   itself still serves the Legislative/Parliamentary/State tabs — only LocalTab
   moved off it. `LayerContext.tsx` already maps `/local/*` → `layer-society-home`.
2. **`/local/[unitId]`** — standalone/mobile deep-link wrapper (light,
   full-page). Skeletons in-page (client component — no `loading.tsx` needed
   per loading-states doctrine). Coexists with
   `app/(locality)/local/select-country` — static segment wins.
3. **`/local` index** — the stable "my local board" link target: redirects to
   the caller's home board, shows the picker when unset, bounces
   unauthenticated visitors to `/login?redirect=/local`.

Registry: `society.local_admin` in `lib/site/capabilityRegistry.ts` is
`scaffolded` with route `/society` — execution plans and both chatbots can now
route users to the board (was `planned`/no route).

## Public-driven units + area quality (CIVIC-3)

- **Users create the unit dropdown, not seed data.** `UnitPicker`'s "Can't
  find your area? Add it" posts to `/api/civic/units`; the proposer becomes
  the first resident. Proposed units are `status: "pending"` ("unverified ·
  N of 3" badge) and flip to `verified` automatically once
  `UNIT_VERIFY_RESIDENTS` users have them as home — same validated-demand
  logic as issue activation, and the 90-day home lock makes farming this
  expensive. Address auto-placement never targets a pending unit.
- **Area quality ratings**: `UnitRating` — every resident scores the fixed
  `AREA_PARAMETERS` (water, electricity, roads, cleanliness, safety,
  healthcare, education, internet) 1–5 for their home unit; scores are
  updatable, resident-only (brigading protection as issues), and everyone in
  the area sees the average. `components/civic/AreaRatings.tsx` renders the
  card above the board (LocalTab dark, `/local/[unitId]` light).
  Rollups (`/api/civic/rollup` → `ratings`) average rater-weighted across all
  descendant wards, so assembly/state/nation/earth views show area quality via
  `RollupBoard`'s AREA QUALITY grid with zero extra wiring.

## Seed

`node prisma/seed-states.js` — idempotent scaffold for proposals: India + 28
states + 8 UTs (stable ids `civic-state-<slug>`; matches seed-civic's Assam
id). Wards/panchayats are deliberately NOT seeded — the public proposes them.

`node prisma/seed-civic.js` — idempotent; India → Assam → Guwahati East → 2
wards + 10 issues across the lifecycle states. Boards:
`/local/civic-ward-chandmari`, `/local/civic-ward-beltola`. Seeded
`supporterCount` values have **no** backing `IssueSupport` rows (display test
data only); real counts are transaction-kept by the API.

## Chain-derived layers + rollups (CIVIC-2)

**One panchayat/ward selection fills every higher layer.** `GET
/api/civic/home-unit` returns the home unit's full ancestor `chain` (ward →
assembly → parliamentary → state → country; `parliamentary` was added to
`UNIT_TYPES` — string column, no migration needed). `hooks/useCivicChain.ts`
(`find(type)`) is the client accessor — never ask the user to pick their
assembly/state/country separately.

**Rollups are the ONLY civic surface above ward level** (locked doctrine:
Nation/Earth are aggregation — national issue lists become opinion shouting).
`GET /api/civic/rollup?unitId=X` aggregates every descendant ward/panchayat
(iterative parentId BFS — revisit as recursive CTE at scale);
`?scope=earth` aggregates all wards planet-wide plus `countryCount`. Returns
ward/resident counts, per-status issue counts, top-10 open demands, 5 recent
completions. `components/civic/RollupBoard.tsx` renders it (stats row, TOP
DEMANDS with links into `/local/[unitId]`, RECENTLY COMPLETED); it is
read-only by construction — no raise/upvote controls above ward level.

**Where each layer gets its content:**
- Society Legislative/Parliamentary/State tabs → `components/civic/
  ChainRollupTab.tsx` (unitType prop): chain unit found → rollup; no home
  area → "set your home area first" pointer to the Panchayat/Ward tab; chain
  missing that tier → honest "not mapped yet" card. These tabs REPLACED the
  remaining GovernanceTabTemplate topic-grid stubs; StateTab keeps its
  ManifestoSection ("Promises vs Reality") below the rollup.
  `GovernanceTabTemplate`/`TopicGrid`/`GovernanceModal` now have no live
  consumer except the orphaned `PanchayatTab.tsx` (dead code, untouched).
- `/nation` → country rollup card above the institutional tabs; the header's
  country name prefers the chain country over the localStorage guess.
- `/earth` → "Local Action Worldwide" section (scope=earth) at the top of the
  Collaborate/Act Now tab.

## Known gaps (deliberate, for later prompts)

- No duplicate detection on create (Prompt 2 — the single most important AI
  feature here).
- No mark-complete flow yet (Prompt 3) — `complete` rows only via seed today.
- No archive/stale automation. Geo-resolution v1 is address-NAME matching
  (`/api/civic/suggest-unit`) — no lat/lng→boundary resolution yet even though
  `Address.lat/lng` exist; unit coverage is still seed-scale, so most users
  will see no suggestion until real ward/panchayat data lands.
- `GET /api/civic/units` has no pagination — fine at seed scale, revisit when
  real ward data lands.
