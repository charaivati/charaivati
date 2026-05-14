---
module: goals-ai
type: api + library
source: app/api/self/goals/, app/api/goal-ai/, app/api/ai/, lib/ai/goalPrompts.ts, lib/ai/goalReflect.ts, lib/site/executionPlanTypes.ts
depends_on: [database, auth]
used_by: [timeline, navigation-tabs]
stability: evolving
status: active
---

# Module: Goals & AI

## Purpose
Allows users to define structured personal goals (AiGoal) through a guided questionnaire, then uses AI to generate execution plans, reflect on progress, and suggest actions. Goals are typed by archetype and link to project timelines.

## Responsibilities
- Goal CRUD with archetype classification
- Guided question-and-answer flow for goal definition (`AiGoalAnswer`)
- AI-driven execution plan generation
- Goal reflection and refinement via AI
- Weekly schedule generation based on goals
- Onboarding goal guidance
- Linking goals to `ProjectTimeline` records

## Inputs & Outputs

| Direction | Value |
|---|---|
| In | Authenticated user session |
| In | Goal metadata: title, archetype, mode, whyNow, commitment, successSignal |
| In | Questionnaire answers (per questionKey) |
| In | Reflection text or progress update |
| Out | `AiGoal` record with execution plan JSON |
| Out | AI-generated plan text (streamed or full response) |
| Out | Reflection feedback from AI |
| Out | Suggested next actions |

## Dependencies
- **auth** — all goal operations are user-scoped
- **database** — AiGoal, AiGoalAnswer models
- **AI provider** — external LLM API for plan generation, reflection, and suggestions (TODO: identify which provider — OpenAI, Anthropic, or other)
- **timeline** — goals can spawn a linked `ProjectTimeline`

## Reverse Dependencies (what breaks if this changes)
- `AiGoal.archetype` enum (`LEARN | BUILD | EXECUTE | CONNECT`) is stored in the DB. Renaming or removing an archetype value without a migration breaks existing goal records.
- `AiGoal.executionPlan` is a JSON field. If the shape of the execution plan changes, the frontend components rendering it will fail until updated.
- `lib/site/executionPlanTypes.ts` defines the TypeScript types for the execution plan JSON. If the AI prompt returns a different shape, the type definitions diverge silently.
- `AiGoal.currentPhaseIndex` tracks progress through the execution plan. If the plan array length changes on regeneration, the index becomes invalid.

## Runtime Flow

### Goal creation
1. Client POSTs to `POST /api/self/goals` with archetype, mode, title, whyNow, commitment, successSignal
2. API creates `AiGoal` with `status: draft`
3. Client submits questionnaire answers to `POST /api/self/goals/[id]/answers` (TODO: verify route)
4. Each answer creates an `AiGoalAnswer` record

### Execution plan generation
1. Client POSTs to `POST /api/goal-ai/execution-plan` with goalId
2. API fetches goal and answers from DB
3. Constructs prompt from `lib/ai/goalPrompts.ts`
4. Calls external AI provider
5. Parses response into execution plan JSON (typed by `lib/site/executionPlanTypes.ts`)
6. Saves to `AiGoal.executionPlan`
7. Updates `AiGoal.status` to `active`

### Reflection
1. Client POSTs to `POST /api/goal-ai/reflect` with goalId and reflection text
2. API calls AI via `lib/ai/goalReflect.ts`
3. Returns feedback text (not persisted to DB — TODO: verify)

### Weekly schedule generation
1. Client POSTs to `POST /api/ai/generate-week-plan`
2. API reads user's active goals
3. Returns a weekly schedule structured around goal commitments
4. TODO: Confirm whether schedule is saved to `Profile.weekSchedule` or returned transiently

## Key API Routes

| Method | Route | Action |
|---|---|---|
| POST | /api/self/goals | Create goal |
| GET | /api/self/goals | List user's goals |
| GET | /api/self/goals/[id] | Goal detail with answers |
| PATCH | /api/self/goals/[id] | Update goal |
| DELETE | /api/self/goals/[id] | Delete goal |
| POST | /api/goal-ai/execution-plan | Generate execution plan |
| POST | /api/goal-ai/refine | Refine goal with AI |
| POST | /api/goal-ai/reflect | Reflect on goal progress |
| POST | /api/goal-ai/summary | Generate goal summary |
| POST | /api/ai/generate-week-plan | Weekly schedule from goals |
| POST | /api/ai/suggest-actions | AI action suggestions |
| POST | /api/self/onboarding-help | Onboarding guidance |
| POST | /api/self/generate-environment-cues | Environment analysis |
| POST | /api/self/generate-funds-plan | Financial plan generation |

## Key Functions

| Function | File | Role |
|---|---|---|
| (prompt builders) | lib/ai/goalPrompts.ts | Constructs LLM prompts for each goal AI action |
| (reflection logic) | lib/ai/goalReflect.ts | Formats reflection prompts and parses responses |
| (plan types) | lib/site/executionPlanTypes.ts | TypeScript types for execution plan JSON shape |

## Database Models Used
- `AiGoal` — goal record: archetype, mode, executionPlan (JSON), currentPhaseIndex, status, riskFlags
- `AiGoalAnswer` — individual questionnaire answers linked to a goal
- `Profile.aiPlan` — AI-generated life plan (separate from individual goals, stored in profile JSON)
- `Profile.weekSchedule` — weekly schedule (JSON in profile)

## Risks & Fragile Areas
- The AI provider integration is not identified clearly in the source. If the provider changes, all prompt templates in `lib/ai/goalPrompts.ts` must be re-evaluated for compatibility.
- `executionPlan` JSON has no DB-level schema. The frontend blindly renders whatever the AI returns. A malformed AI response can break the goal detail UI.
- Reflection responses are not currently persisted (TODO: confirm). Users cannot review past reflections.
- `currentPhaseIndex` can become stale if the execution plan is regenerated with a different number of phases. There is no guard against this.
- `AiGoal.riskFlags` is a JSON array. Its shape and how it is used in the UI is unclear. TODO: Confirm structure and rendering.
- Rate limiting on AI endpoints is not confirmed. Unprotected AI calls can be expensive.

## Backlinks
- [[START_HERE.md]] — goals in the main user journey
- [[database.md]] — AiGoal, AiGoalAnswer model definitions
- [[timeline.md]] — ProjectTimeline linked to AiGoal
- [[auth.md]] — session required for all goal operations
- [[navigation-tabs.md]] — Self layer renders goal UI via tab system
