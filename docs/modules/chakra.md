# Chakra Landing (CHAKRA-1)

A chakra-themed dashboard of the Self layer: seven chakras ascending a spine,
each lit 0–100 by an "openness" score blended from existing platform signals and
a user 1–7 self-report. A unified Todo channel tags every todo by chakra. Almost
no net-new domain logic — it rides existing backends and the `app/chakra/`
visual prototype.

## Data model

Migration `20260701000000_add_todo_chakra_profile_selfreport` (applied via the
P3006-safe path — `prisma db execute --file …` + `prisma migrate resolve
--applied`, NOT `migrate dev`):

| Column | Type | Notes |
|---|---|---|
| `Todo.chakra` | `String?` | `root\|sacral\|solar\|heart\|throat\|third_eye\|crown` — validated in API |
| `Todo.source` | `String?` | `manual\|validation\|execution_plan\|initiative` — validated in API |
| `Profile.chakraSelfReport` | `Json?` | `{ root: 1..7, sacral: 1..7, … }` |

**Validated in the API, not the DB** — matches the `freq`/`assumptionKey`
string-discriminator precedent. All three columns are read/written via **raw
SQL** (`$queryRaw`/`$executeRaw`) until a full `prisma generate` runs with the
dev server stopped — same stale-client pattern as `Store.slug`/`upiVpa`. Do not
add them to a typed Prisma `where`/`select`/`create`.

## Canonical keys — `lib/chakra/keys.ts`

- `CHAKRA_KEYS` — snake_case, ordered root→crown. **Index-aligned** with
  `app/chakra/chakras.ts` (whose display array uses camelCase `thirdEye`), so
  `scores[CHAKRA_KEYS[i]]` zips to `CHAKRAS[i]` for colors/petals/bija.
- `TODO_SOURCES`, `isChakraKey()`, `isTodoSource()`.
- `DRIVE_CHAKRA` (building/doing→solar, learning→throat, helping→heart) and
  `ARCHETYPE_CHAKRA` (BUILD/EXECUTE→solar, LEARN→throat, CONNECT→heart) — coarse
  on purpose, refine later.

## Scoring — `lib/chakra/score.ts`

`computeChakraScores(userId)` → `Record<ChakraKey, { score, platform, self,
platformOnly, signals }>`. Pure read, no stored state. Blend: `0.6*platform +
0.4*selfReport`; when a chakra has no self-report, `score = platform` and
`platformOnly = true` (UI shows the gap as insight, never deficiency).

**Signals (CHAKRA-UI-2)** — `signals: { key, value }[]` are the named
sub-signals whose average IS the platform score; the UI renders them as
breakdown bars, translating labels via `chakra-signal-<key>` slugs. Two signal
additions over CHAKRA-1:

- **root `action`** — "is the user acting on survival": earning initiatives
  owned (store/service/fleet pages, full=2) + `AiGoal` rows (full=3), averaged.
- **`todos` (any chakra)** — a chakra with ≥1 tagged todo gains a signal equal
  to the completion % of its tagged todos, so the unified Todo channel directly
  moves the light it is tagged to. Grouped via raw SQL (`Todo.chakra` is a
  stale-client column).

Platform signals (each normalized 0–100, floored at `DORMANT = 8` so empty never
reads as 0/"broken"):

| Chakra | Platform signal | Normalization |
|---|---|---|
| root | `computeEnergy` physical + funds | avg(1–10) ×10 |
| sacral | friends + posts + chat | cap 10 / 20 / 50, averaged |
| solar | todo completion rate + course mastery avg | %, averaged |
| heart | helping/community_group pages owned | 0→dormant, else 60+15·count |
| throat | public posts + publicly-shared initiatives | cap 15 / 5, averaged |
| third_eye | ConsultMessage count (/listen usage) | cap 30 |
| crown | **PARKED** | fixed `DORMANT` placeholder, no computation |

Self-report `1..7` → `(v/7)*100` (lowest felt value ≈14, never 0). Served by
`GET /api/chakra`.

## Todo channel writers

| Writer | source | chakra |
|---|---|---|
| `POST /api/self/todos` | validated body, default `manual` | validated body or null |
| `app/api/business/idea/interview` validation tasks | `validation` | null |
| `app/api/goal-ai/execution-plan` (`step:"tasks"`) | `execution_plan` | `ARCHETYPE_CHAKRA[goal.archetype]` |

The execution-plan hook is an **ADD-ONLY** create loop placed after the existing
`aiGoal.update` in the `step:"tasks"` path — it never alters the `executionPlan`
JSON write and never touches the `step:"skeleton"` path.

**Not connected (parked — TECH_DEBT §27):** initiative actions (seam:
`createSubOrder.ts`) and weekSchedule day-tasks (seam: `weekSchedule` branch of
`PATCH /api/user/profile`).

## Self-report — `PATCH /api/user/profile`

One 1–7 slider per chakra; the whole `chakraSelfReport` object is sent and
persisted via raw `UPDATE … SET "chakraSelfReport" = …::jsonb` (mirrors the
`upiVpa` write). `GET /api/user/profile` returns it via the same raw SELECT that
already augments `upiVpa`. No new route.

## UI — `app/chakra/landing/page.tsx` (CHAKRA-UI-2 scroll journey)

Client component. Seven full-viewport stages ascend root → crown over a pinned
scene (starfield + water reflection + seated silhouette). An
IntersectionObserver flips a discrete `stage` index when a section passes 55%
visibility; **every visual change downstream is a CSS transition/keyframe — no
per-frame scroll JS**. This supersedes CHAKRA-1's "fully static" rule while
honouring its low-end-Android intent (MK approved the relaxation, 2026-07-02).

- **Camera** — the pinned figure gets a `translateY(…) scale(…)` transform
  recomputed only on stage change/resize; the 0.9s transform transition IS the
  pan. The active chakra lands above the card (mobile, 33vh) or beside it
  (desktop, 46vh). The water line is derived from the same math (root glyph's
  screen y) — no DOM measurement, and it transitions `top` with the pan.
- **Awakening** — chakras at/below the active stage are "awakened" (glow +
  yantra opacity ramp by score); the active one gets a breathing halo ring and
  a slow yantra spin; spine segments light to the frontier and an energy pulse
  rises root→active (CSS keyframes driven by a `--rise` var).
  `prefers-reduced-motion` disables all ambient loops.
- **Stage cards render inline** (the tap-popup was removed): score ring,
  platform-vs-felt line, per-signal breakdown bars (`ChakraDetail.signals`),
  calm remark, 1–7 self-report slider, tagged todos with a done count, and the
  deep-link button. The crown stage doubles as the journey summary (overall
  openness average + 7 mini bars).
- **Navigation** — fixed right-edge progress rail (root at bottom, mirroring
  the body), tap a dot or a glyph on the figure to scroll to that stage.
- **Card CTA → middle layer (CHAKRA-UI-3)** — every stage card's button goes to
  `/chakra/[key]` (including crown — its detail page has content even though
  its action surface is parked). The card never links to an action surface
  directly anymore.
- **Dormant copy is "ready to awaken"** — hard requirement, never
  "blocked"/"broken". `/chakra/three` (Three.js) stays optional, never required.

## Middle layer — `app/chakra/[key]/page.tsx` (CHAKRA-UI-3)

Per-chakra detail page between the journey card and the action surface:
journey card → `/chakra/[key]` → action page. Client component; the route
param is validated with `isChakraKey()` (snake_case keys, e.g.
`/chakra/third_eye`) and anything else `notFound()`s. Same theme as the
journey (black, deterministic twinkling stars, the chakra's colour and a
slow-spinning yantra header).

Content, top to bottom: score ring + platform-vs-felt line + calm remark;
**factor cards** — one per `ChakraDetail.signal` with value bar, a one-line
description (`chakra-signal-desc-<key>` slugs), and a **"Work on this →"
link into the existing module that moves it** (`SIGNAL_LINKS` in
`app/chakra/meta.ts`: health/funds/completion→`/self` personal tab,
friends/posts/chat→`/self?tab=social`, mastery→`/self?tab=learn`,
action→`/earn`, initiatives/shared→`/app/initiatives`, voice→`/society`,
reflection→`/listen`, todos→null — listed on the page itself); the 1–7
self-report slider (same `PATCH /api/user/profile` write); this chakra's
tagged todos; and the primary **"Go to {surface} →"** CTA using
`DEEP_LINKS` (crown renders "Coming soon"). Skeleton pulse cards while
`/api/chakra` loads.

**Shared config** — `app/chakra/meta.ts` owns `DEEP_LINKS`, `REMARK_EN`,
`SURFACE_EN`, `SIGNAL_EN`, `SIGNAL_DESC_EN`, `SIGNAL_LINKS`; both the landing
journey and the detail pages import from it. Do not redefine these per-page.

## Survival planning — `app/chakra/root/survival/page.tsx` (SURVIVAL-1)

The root chakra's action surface for survival. Reached from `/chakra/root`'s
**health** and **funds** factor "Work on this →" links (`SIGNAL_LINKS` in
`app/chakra/meta.ts` — both are root-only signal keys; `action` still goes to
`/earn`, and `DEEP_LINKS.root` is unchanged). Client page, root-chakra themed,
auth-protected via the existing `/chakra` middleware prefix. Three blocks, all
riding EXISTING backends — no new write paths:

1. **Food requirement (individual)** — deterministic math-in-code (no AI call):
   daily kcal from `health.healthPlan.health_targets.daily_calories_kcal` when
   the AI health plan exists, else Mifflin-St Jeor (gender-neutral midpoint
   constant −78, activity 1.3 + 0.05×sessions/week, cap 1.55), else 2000.
   Quantity split: 55% kcal cereals / 15% pulses (3.45 kcal/g) / 20% oils
   (9 kcal/g) + fixed 400 g/day veg & fruit, per-day and per-month. "Edit
   details" opens the **existing `EditHealthModal`** and saves via the same
   `PATCH /api/user/profile { health }` that `blocks/HealthBlock.tsx` uses — so
   the `/self` dashboard reflects the same data with zero extra wiring.
2. **Survival funds** — ONLY the `Housing` / `Living` / `Health` expense groups
   of `Profile.fundsProfile` (`SURVIVAL_GROUP_NAMES` in the page). Everything
   else (Transport, Lifestyle, Education, Financial…) deliberately stays on
   other chakras' surfaces. Reuses `GroupColumn` + `buildInitialExpenseGroups`
   + `sumGroups` + `formatINR`, now **exported** from `blocks/FundsBlock.tsx`.
   Saves the WHOLE `fundsProfile` back (`PATCH /api/user/profile
   { fundsProfile }`, debounced 800 ms) with `monthlyBurn` recomputed over all
   expense groups — same contract as `FundsSection.saveAll`, so EnergyBlock and
   the `/self` Funds panel stay consistent. When no expense groups are saved
   yet the page bootstraps the full default structure (goals/skills from the
   profile) so the `/self` panel later sees the familiar groups.
3. **Community** — "food alone doesn't keep you standing": debounced search of
   `GET /api/community-group?q=` (which now returns `myStatus` per group for
   the authed viewer — additive), join via the existing
   `POST /api/community-group/[groupId]/membership/request`, view link to
   `/community/[slug|pageId]`, and **create a family group** using the exact
   `/app/initiatives` backend pair (`POST /api/user/pages` with
   `pageType: "community_group"` + `POST /api/community-group { pageId }`) —
   then `router.replace` **straight to `/earn/initiative/[pageId]`** (the
   community initiative page), deliberately NOT via `/app/home` or the
   initiatives list.

i18n: 36 `survival-*` slugs (category `ui-chakra`) seeded by
`prisma/seed-survival-ui.js`, English fallback like the rest.

### Community food plan (`CommunityGroup.foodPlan`)

The community-initiative side of survival: the owner/board plans food for the
WHOLE group in the Initiative Hub's Group tab
(`components/earn/CommunityGroupStudio.tsx` § "Food & Survival Plan"), and
members see it read-only on `/community/[id]`.

- **Column**: `CommunityGroup.foodPlan JSONB` — migration
  `20260705000000_add_community_food_plan` (apply via the P3006-safe path:
  `prisma db execute --file …` + `migrate resolve --applied`). Read/written via
  **raw SQL** like `emergencyContacts`/`bannerUrl` on the same table; the
  by-page GET wraps the read in try/catch → `foodPlan: null` so nothing 500s
  before the migration runs.
- **Shape**: `{ extraHeads, perPersonKcal, bufferDays, budgetPerHead, notes?,
  updatedAt? }`. Head count = unique board members + approved individual
  members (computed live) + `extraHeads` (dependents not on the platform).
- **Math** is the same deterministic split as the individual page — per-day and
  N-day-buffer stock in kg, plus `heads × budgetPerHead` monthly budget.
- **Write path**: `PATCH /api/community-group/[groupId] { foodPlan }`
  (admin-gated like every other field there). Member privacy: the plan never
  reads members' personal health profiles — it's a per-head planning figure.

## Simple variant — `app/chakra/landing/simple/page.tsx` (CHAKRA-UI-4b)

`/chakra/landing/simple` is the **quiet, minimal-colour** twin of the landing
that KEEPS the silhouette SVG and the scroll journey (same seven full-viewport
stages, pinned figure, camera pan, IntersectionObserver stage flips, progress
rail, inline cards, glyph taps) but drops every ambient/decorative animation:
no starfield, no shooting stars, no water reflection, no breathing halo, no
yantra spin, no rising energy pulse. Scroll-responsive transitions (camera
pan, glyph/spine lighting, bar/ring fills) stay — **nothing moves while the
page is at rest**.

**Minimal colour** — the silhouette, spine, and awakened-but-inactive glyphs
stay quiet white line-art; the chakra's `c.color` appears only as restrained
accents: the ACTIVE glyph (fill + a static ring + yantra stroke), the score
ring, signal bars, bija circle, active card border, active rail dot, slider,
overall-summary bars, "Saved ✓", and the CTA border. So the page reads as
mostly monochrome with just the current chakra's colour picked out.

The desktop card sits right-of-centre (`lg:pr-[20vw]`) rather than hard against
the right edge. Same data endpoints and the same "View details →" flow into
`/chakra/[key]`; header links back to `/self` and across to the full journey
(`chakra-journey` slug). No new i18n slugs — it reuses the existing
`ui-chakra` set. The full journey page is unchanged. (History: the first
CHAKRA-UI-4 cut was a flat static list → MK asked for the figure + scrolling
back → then for minimal colour + the card pulled toward centre, 2026-07-02.)

- **Deep-links (action surfaces, used by the detail page CTA)**: root→`/earn`,
  sacral→`/self?tab=social`, solar→`/self?tab=learn`, heart→`/app/initiatives`,
  throat→`/society`, third_eye→`/listen`, crown→disabled ("coming soon").

## i18n

43 slugs (category `ui-chakra`) seeded by `prisma/seed-chakra-ui.js` (the
original 10 + `chakra-goto`/`chakra-scroll`/`chakra-overall`/`chakra-signals` +
13 `chakra-signal-<key>` labels + CHAKRA-UI-3's
`chakra-details`/`chakra-improve`/`chakra-journey` + 13
`chakra-signal-desc-<key>` factor descriptions), English fallback when
LibreTranslate is unreachable (TECH_DEBT §21). Client reads via
`useTranslations()`.

## Verification

`computeChakraScores` and the migration are type-clean. **Real-device tap-test on
physical Android is required before this is considered done**: scroll behavior,
slider save (`PATCH /api/user/profile`), chakra→surface deep-links, and the
per-chakra todo filter. Do not claim completion from a static read.
