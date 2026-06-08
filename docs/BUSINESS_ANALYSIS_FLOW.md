# BUSINESS_ANALYSIS_FLOW.md
# Design spec for BIZDOC-4: Market-sizing deepening + AI reaction + validation tasks

## §1 Overview

The business idea evaluation is a guided strategic-analysis flow, not just a scoring quiz. Three additions extend the BIZDOC-3 adaptive interview engine:

1. **AI reaction per answer** — one honest sentence reacting to the user's answer, shown before the next question
2. **Market-sizing deepening (TAM/SAM/SOM)** — fires on the first `marketNeed` answer
3. **Assumptions → validation tasks → Todo** — named tasks written to the Todo system

## §2 AI Reaction Per Answer

After each user answer the Interviewer returns a `reaction: string | null` field — one short, honest sentence. It appears as small italic text between the user bubble and the next question bubble.

**Rules:**
- The reaction is informative, not judgmental. It acknowledges what was said, highlights a gap or a strength, or names an assumption.
- Examples: "That's a clear problem — but the size of that market isn't obvious yet." / "A tight geographic focus is smart at this stage."
- If the model returns no reaction (or the field is missing), nothing renders. Graceful degradation is required.

## §3 Market-Sizing Deepening (TAM/SAM/SOM)

### Trigger
Fires exactly once per interview — on the first `marketNeed` dimension answer. Controlled by `interviewState.marketSizingDone` (boolean, false by default).

### MATH IN CODE, JUDGMENT IN MODEL
This is a hard constraint. The AI supplies:
- `populationBasis` — raw integer (number of potential customers)
- `samPct` — float 0–1 (fraction of TAM that is reachable)
- `somPct` — float 0–1 (fraction of SAM capturable in year 1)
- `samRationale`, `somRationale` — one-sentence justifications
- `samValidationTask`, `samSuccessThreshold` — the test to run and the pass condition
- `somValidationTask`, `somSuccessThreshold` — the test to run and the pass condition

ALL arithmetic is computed in code:
```
tam = populationBasis
sam = round(tam × samPct)
som = round(sam × somPct)
```

Never let the model compute numbers. The model supplies percentages and rationale only.

### User-adjustable sliders
The user can drag `samPct` (1–80%) and `somPct` (1–50%) sliders. Numbers recompute instantly in the component (not persisted to DB — local state only).

### Graceful degradation
If the cloud model is unavailable, `runMarketSizing()` returns `null`. The panel does not appear. No error is shown to the user. The interview continues normally.

### Fire-and-forget pattern
`runMarketSizing()` runs as a background promise after the turn response is sent. The client receives `marketSizingPending: true` and polls `GET /api/business/idea?ideaId=` every 3 seconds until `marketSizing` is populated on the idea.

## §4 Assumptions → Validation Tasks → Todo

### Named assumptions
The market sizing produces two named assumptions:
- `SAM assumption` — "Can you actually reach X% of this market?"
- `SOM assumption` — "Can you capture X% of reachable market in year 1?"

Each assumption has:
- `validationTask` — the specific research or experiment to run
- `successThreshold` — a concrete pass condition

### Todo rows (logged-in users)
`createValidationTodos(userId, ideaId, sizing)` writes one `Todo` row per assumption. Fields set:
- `title` = `validationTask`
- `validationLabel` = assumption label (e.g., "SAM assumption")
- `successThreshold` = the pass condition
- `ideaId` = the idea ID

### Guest handling
Guests cannot create Todo rows (session-only auth). The sizing JSON is stored on the idea. `ValidationTasks` component renders assumption tasks read-only from `guestSizing.assumptions` with a "Sign in to save" note.

### Two-view pattern — ONE list, ONE source of truth
| View | Component | Filter | Data source |
|---|---|---|---|
| Self-tab | `components/self/TodoList.tsx` | all todos for user | `GET /api/self/todos` |
| Business idea page | `components/business/ValidationTasks.tsx` | `ideaId` only | `GET /api/self/todos?ideaId=` |

Completing a task in either view calls `PUT /api/self/todos/[id]` — the same row, same state. There is no duplication.

## §5 Component Map

| Component | Location | Purpose |
|---|---|---|
| `MarketSizingPanel` | `components/business/MarketSizingPanel.tsx` | TAM/SAM/SOM display + sliders |
| `ValidationTasks` | `components/business/ValidationTasks.tsx` | Filtered todo view for business page |
| `TodoList` | `components/self/TodoList.tsx` | All todos for Self-tab |

## §6 Data Model

### `BusinessIdea.marketSizing` (JSONB)
```typescript
interface MarketSizing {
  tam: number;
  sam: number;
  som: number;
  populationBasis: number;
  populationDescription: string;
  samPct: number;
  samRationale: string;
  somPct: number;
  somRationale: string;
  assumptions: MarketAssumption[];
}

interface MarketAssumption {
  id: string;   // "sam" | "som"
  label: string;
  pct: number;
  rationale: string;
  validationTask: string;
  successThreshold: string;
}
```

### `Todo` model
Added via Neon MCP migration. Use `(db as any).todo` until `prisma generate` runs.

## §7 Business↔Goal Linking (BIZDOC-5)

Goals and businesses are **separate, independently-created entities**. A goal (e.g. "earn passive income") can have many businesses linked to it. A business does not require a goal. The link is mutable — create or remove it at any time. A business is NOT promoted into a goal and stays a business.

### Link storage
Many-to-many join table `BusinessIdeaGoal (businessIdeaId, goalId)` added via Neon MCP migration. Composite PK. Cascade-delete on both sides.

### API
- `GET  /api/business/idea/goals?ideaId=` — list linked goals (session or guest cookie ownership; guests always get empty)
- `POST /api/business/idea/goals { ideaId, goalId }` — link (session required, goal must belong to session user; idempotent)
- `DELETE /api/business/idea/goals { ideaId, goalId }` — de-link (session required)

### UI
`components/business/GoalLinker.tsx` — rendered below `ResultsReport` on the idea page after evaluation completes. Fetches user's goals + currently linked goals in parallel. Toggle-style checkboxes. Guests see nothing.

### Validation todos stay in Todo list
Validation todos are NOT moved to the execution plan. They remain in `Todo` rows, visible in both the Self-tab all-todos view and the business idea page sidebar via `ValidationTasks.tsx`.

## §8 freq → assumptionKey cleanup (BIZDOC-5)

`Todo.freq` is reserved for schedule frequency ("daily"/"weekly"/"monthly"). The BIZDOC-4 discriminator that was stored in `freq` (`"sam"` / `"som"`) has been migrated to a new dedicated field `Todo.assumptionKey String?`.

- Existing rows migrated: `UPDATE "Todo" SET "assumptionKey" = freq WHERE freq IN ('sam', 'som'); UPDATE "Todo" SET freq = NULL WHERE freq IN ('sam', 'som')`
- `createValidationTodos()` now sets `assumptionKey: assumption.id` (not `freq`)
- `PATCH /api/business/idea/market-sizing` reconciles labels via `{ ideaId, assumptionKey: "sam"/"som" }`
- `GET/POST /api/self/todos` and `PUT /api/self/todos/[id]` accept and return `assumptionKey`
- `validationOnly=true` was REMOVED from `GET /api/self/todos` and from `ValidationTasks` (TODO-LEAK-FIX-2, 2026-06-08) — it powered the cross-business leak described in §9 below; do not re-add it without a real `BusinessIdea → Page` link to scope by.

## §9 Known Tech Debt

| Item | File | Notes |
|---|---|---|
| `Todo.hobbyId` orphaned FK | `prisma/schema.prisma` | References a `Hobby` model that does not exist in schema. No runtime error but the column is vestigial. |
| `/api/self/todos/stats` missing | `components/SelfAnalyticsDashboard.tsx` | Analytics page calls this route which 404s silently. Low priority. |
| ~~Initiative Hub showed all ideas' tasks~~ — FIXED (TODO-LEAK-FIX-2) | `components/earn/InitiativeTabs.tsx` | The `validationOnly=true` card was removed entirely (no `Page→BusinessIdea` link exists to scope it correctly — would need a migration first). |

## §10 Deferred (not in MVP)

- Competitor analysis deepening
- Stakeholder mapping deepening
- Market sizing for non-marketNeed dimensions
- Plan page (`/business/plan/[ideaId]`) validation task tab — currently only on the idea evaluation page sidebar
