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
platformOnly }>`. Pure read, no stored state. Blend: `0.6*platform +
0.4*selfReport`; when a chakra has no self-report, `score = platform` and
`platformOnly = true` (UI shows the gap as insight, never deficiency).

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

## UI — `app/chakra/landing/page.tsx`

Client component. A static, score-lit seated silhouette (visual inspiration only
— no chakra names/labels/poster text) over a scrollable list of 7 cards. Each
card: an openness bar + bija glyph (glow keyed to score), and on tap a detail
panel with the 1–7 self-report slider (showing platform-vs-felt gap), the
chakra's tagged todos, and a deep-link.

- **Deep-links**: root→`/earn`, sacral→`/society`, solar→`/self`,
  heart→`/app/initiatives`, throat→`/society`, third_eye→`/listen`,
  crown→disabled ("coming soon").
- **2D SVG is primary and static** (no per-scroll framer transforms) for low-end
  Android; `/chakra/three` (Three.js) stays optional, never required.
- **Dormant copy is "ready to awaken"** — hard requirement, never
  "blocked"/"broken".

## i18n

10 slugs (category `ui-chakra`) seeded by `prisma/seed-chakra-ui.js` — 160 rows
(10 × 16 locales), English fallback when LibreTranslate is unreachable
(TECH_DEBT §21). Client reads via `useTranslations()`.

## Verification

`computeChakraScores` and the migration are type-clean. **Real-device tap-test on
physical Android is required before this is considered done**: scroll behavior,
slider save (`PATCH /api/user/profile`), chakra→surface deep-links, and the
per-chakra todo filter. Do not claim completion from a static read.
