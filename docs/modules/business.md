---
module: business
type: api + component
source: app/api/business/, components/business/
depends_on: [database, auth]
used_by: [pages]
stability: stable
status: active
---

# Module: Business

## Purpose
Provides tools for evaluating business ideas and generating business plans. The idea evaluator runs users through a scored questionnaire; the plan generator uses AI to produce a structured document. Both support anonymous (token-based) and authenticated access.

## Responsibilities
- Serve and manage the idea question bank (`IdeaQuestion`)
- Accept user answers and score them per dimension
- Real-time live scoring during answer entry
- Generate shareable business idea evaluation reports
- Create, retrieve, and AI-generate business plan documents
- AI analysis of existing business plans

## Inputs & Outputs

| Direction | Value |
|---|---|
| In | Optional user session (anonymous access supported via share token) |
| In | Business idea: title, description |
| In | Answers to idea questions (per `IdeaQuestion.id`) |
| In | Business plan content for analysis |
| Out | `BusinessIdea` record with per-dimension scores |
| Out | Real-time score update during live scoring |
| Out | Shareable report (via `shareToken`) |
| Out | `BusinessPlan` document (AI-generated or user-authored) |
| Out | Retrieval token for plan access without auth |

## Dependencies
- **auth** — optional; idea and plan records support both authenticated (`userId`) and anonymous (`ownerEmail`, `ownerPhone`) ownership
- **database** — BusinessIdea, IdeaQuestion, IdeaResponse, BusinessPlan models

## Reverse Dependencies (what breaks if this changes)
- `IdeaQuestion.scoringDim` maps each question to one of the scoring dimensions (problemClarity, marketNeed, targetAudience, uniqueValue, feasibility, monetization). Changing dimension names breaks the scoring aggregation logic.
- `BusinessIdea.shareToken` and `BusinessPlan.retrievalToken` are the only access mechanism for anonymous users. If token generation logic changes, existing shared links break.
- `IdeaQuestion.dependsOn` implements conditional question logic. Changing its structure breaks the questionnaire flow in the UI.
- `BusinessPlan.expiresAt` controls plan TTL. If expiry logic is removed, plans accumulate indefinitely.

## Runtime Flow

### Idea evaluation
1. Client fetches question bank from `GET /api/business/questions`
2. User answers questions; client calls `POST /api/business/idea/score-live` after each answer for real-time feedback
3. On completion, client POSTs to `POST /api/business/idea/score` for final scoring
4. API computes per-dimension scores from `IdeaResponse` records
5. Saves scores to `BusinessIdea` (6 dimensions as separate fields)
6. Returns scored idea with a `shareToken` for public sharing

### Plan creation
1. Client POSTs to `POST /api/business/plan/create` with plan content
2. API creates `BusinessPlan` with a unique `retrievalToken` and `expiresAt`
3. Client can call `POST /api/business/plan/generate` to have AI fill in the plan
4. Client can call `POST /api/business/plan/analyze` for AI feedback on existing content

### Anonymous retrieval
1. Anyone with a `retrievalToken` can GET `GET /api/business/plan/[token]`
2. No auth required — token is the sole access control mechanism

## Key API Routes

| Method | Route | Action |
|---|---|---|
| GET | /api/business/questions | Fetch question bank |
| POST | /api/business/idea | Create idea |
| GET | /api/business/idea | List user's ideas |
| POST | /api/business/idea/score | Final scoring |
| POST | /api/business/idea/score-live | Real-time per-answer score |
| POST | /api/business/plan/create | Create plan |
| GET | /api/business/plan | List user's plans |
| GET | /api/business/plan/[token] | Retrieve plan by token (no auth) |
| POST | /api/business/plan/generate | AI-generate plan content |
| POST | /api/business/plan/analyze | AI analyze plan |

## Key Components

| Component | Role |
|---|---|
| `components/business/StartScreen.tsx` | Entry point — prompts user to begin idea evaluation |
| `components/business/StartScreenBatch.tsx` | Batch question entry variant |
| `components/business/QuestionCard.tsx` | Single question display with answer input |
| `components/business/CollapsibleQuestionCard.tsx` | Collapsible version for review |
| `components/business/LiveScoreDashboard.tsx` | Real-time score display per dimension |
| `components/business/ResultsReport.tsx` | Final scored report with dimension breakdown |

## Database Models Used
- `BusinessIdea` — idea record: title, description, 6 score fields, shareToken, expiresAt, status
- `IdeaQuestion` — question bank: text, type, category, scoringDim, dependsOn logic, options JSON
- `IdeaResponse` — user answer per question: answer, score, feedback
- `BusinessPlan` — plan document: title, dataJson, pdfPath, retrievalToken, expiresAt, status

## Risks & Fragile Areas
- Anonymous access via `retrievalToken` and `shareToken` has no rate limiting or brute-force protection observed. TODO: Confirm whether tokens are sufficiently long/random to resist enumeration.
- `BusinessPlan.dataJson` is an untyped JSON field. AI-generated content is stored as-is — malformed AI responses can corrupt plan data.
- `BusinessPlan.expiresAt` is set at creation. There is no background job observed to clean up expired plans. TODO: Confirm whether expired plans are cleaned up and how.
- `IdeaQuestion.dependsOn` controls conditional rendering. Its exact JSON shape is unclear. TODO: Confirm the schema of this field.
- AI calls for plan generation and analysis are not clearly rate-limited. Unprotected endpoints can be expensive under load.
- `pdfPath` on `BusinessPlan` suggests PDF export capability. TODO: Confirm whether PDF generation is implemented.

## Backlinks
- [[database.md]] — model definitions
- [[auth.md]] — optional session for idea/plan ownership
- [[pages.md]] — business ideas/plans may be linked to Page records (TODO: confirm)
