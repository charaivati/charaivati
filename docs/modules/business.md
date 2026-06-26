---
module: business
type: api + component
source: app/api/business/, components/business/, app/(business)/business/
depends_on: [database, auth]
used_by: [pages]
stability: stable
status: active
---

# Module: Business

## Purpose
Provides tools for evaluating business ideas and building per-idea business documents (SWOT, Business Model Canvas, 3-Year Financials). The idea evaluator uses an adaptive AI-driven turn-by-turn conversation with a local Interviewer + cloud Assessor cross-check (BIZDOC-3). Both the evaluator and plan page support anonymous (guest-session cookie) and authenticated access.

## Responsibilities
- Adaptive AI conversation: one question per turn, local Interviewer + cloud Assessor cross-check, probe cap
- Serve and manage the idea question bank (`IdeaQuestion`) as the base question menu
- Accept user answers and score them per dimension (AI-driven, not keyword matching)
- Live sidebar updated per turn with provisional scores and provenance badges
- Generate final verdict (cloud Assessor) with per-dimension provenance display
- Create and AI-draft per-idea `BusinessDocument` records (SWOT, BMC, FINANCIALS)
- Claim guest-session ideas on login/verification (re-parent to real userId)

## Adaptive Evaluation Engine (BIZDOC-3)

### Three-role architecture

| Role | Model | When called |
|---|---|---|
| **Interviewer** | Local (Ollama via `chatComplete()`) | Every turn — scores answer, checks confidence |
| **Assessor** | Cloud (OpenRouter → Groq → Vercel via `callAI({ provider:"openrouter" })`) | When local confidence < `CONFIDENCE_THRESHOLD`, once per dimension + final verdict |
| **Cross-check** | Server logic | After both local + assessor score exist: if disagreement > `DISAGREEMENT_THRESHOLD`, queue one probe |

### Tunable thresholds — `lib/business/interviewConfig.ts`

| Constant | Default | Meaning |
|---|---|---|
| `CONFIDENCE_THRESHOLD` | `0.55` | Local confidence below this triggers cloud Assessor for the dimension |
| `DISAGREEMENT_THRESHOLD` | `1.0` | `|local - assessor|` above this triggers one disagreement probe |
| `MAX_PROBES_PER_DIM` | `2` | Max extra follow-up probes per dimension beyond base questions |
| `LOCAL_TIMEOUT_MS` | `12_000` | Timeout for local Interviewer call |
| `ASSESSOR_TIMEOUT_MS` | `20_000` | Timeout for cloud Assessor call |

**To tune:** Adjust these exports in `lib/business/interviewConfig.ts`. Check real interview transcripts to calibrate. A `CONFIDENCE_THRESHOLD` that is too high triggers the cloud too often; too low lets vague answers slip through.

### Probe cap prevents infinite loops

`state.probeCount[dim]` tracks extra probes per dimension. When `probeCount[dim] >= MAX_PROBES_PER_DIM`, no more probes are added regardless of disagreement. The Assessor's score (if available) stands as the final score for that dimension. If the Assessor is also unavailable, the local provisional score is used.

### Sector detection

`detectSector(title, description)` in `interviewConfig.ts` classifies the idea into one of: `food | craft | education | delivery | service | retail | digital | health | general`. Sector is stored in `interviewState.sector` and used to select sector-tuned probe variants (e.g. food → FSSAI/spoilage/footfall; service → repeat clients/capacity).

### Graceful degradation

If Ollama is unavailable, `chatComplete()` falls through to cloud automatically. The interview state records `localUnavailable = true`. When `localUnavailable` is set:
- No cloud Assessor is triggered (cloud was already used for the Interviewer — redundant)
- `dimProvenance` stays `"local_estimate"` for all dimensions
- The tier label in `TurnResponse` becomes `"cloud-degraded"`
- The UI shows: `"Quick evaluation — senior review unavailable"` on each assistant turn
- The `ResultsReport` shows a yellow badge: `"Quick Evaluation — senior review unavailable"`

### Rail-guided questions

The engine does NOT allow the AI to freely invent questions. The 12 seeded `IdeaQuestion` rows are the base menu. The server deterministically advances through them (`interviewState.currentIndex`). The AI only adds to the `probeQueue` by selecting from `PROBE_TEMPLATES` in `interviewConfig.ts` — a static, auditable list.

### Provenance display

- `dimProvenance[dim]`: `"local_estimate"` or `"senior_reviewed"`
- Shown in `LiveScoreDashboard`: `✦` = senior reviewed, `~` = local estimate
- Shown in `ResultsReport`: per-dimension badge + overall tier banner
- Stored on `BusinessIdea.dimProvenance` (JSONB)

### State persistence

Three new JSONB fields on `BusinessIdea` (added via Neon migration):
- `transcript` — `ConversationTurn[]` — the full conversation (user + assistant turns with dim and questionKey)
- `dimProvenance` — `Record<dim, "local_estimate" | "senior_reviewed">` — current provenance per dimension
- `interviewState` — `InterviewState` — engine state (currentIndex, sector, probeQueue, probeCount, provisionalScores, assessorScores, assessorRun, done, localUnavailable)

### Key lib files

| File | Purpose |
|---|---|
| `lib/business/interviewConfig.ts` | All static config: thresholds, PROBE_TEMPLATES (sector-tuned), sector detection, prompt builders, state types |
| `lib/business/runInterviewer.ts` | `runInterviewer(dim, questionText, answer, sector)` → `{ score, confidence, followUpNeeded, source, reaction }` |
| `lib/business/runAssessor.ts` | `runAssessor(dim, ...)` → `AssessorResult | null`; `runFinalVerdict(...)` → `FinalVerdictResult` |

## Market-Sizing Deepening + Validation Tasks (BIZDOC-4)

Full design spec: `docs/BUSINESS_ANALYSIS_FLOW.md`. Summary:

### AI reaction per answer
`runInterviewer()` now returns `reaction: string | null` — one honest sentence reacting to the user's answer, rendered as italic text between the user bubble and next question. Gracefully omitted when null.

### Math-in-code contract
**MATH IN CODE, JUDGMENT IN MODEL** — the cloud model supplies `populationBasis`, `samPct`, `somPct`, and rationale strings. ALL arithmetic (`tam = pop`, `sam = round(tam × samPct)`, `som = round(sam × somPct)`) is computed in `MarketSizingPanel.tsx` and `computeSizing()`. Never let the AI return computed numbers.

### Market-sizing flow
- Triggered once per interview on the first `marketNeed` answer (gated by `interviewState.marketSizingDone`)
- `lib/business/runMarketSizing.ts` — `runMarketSizing(title, desc, sector, answer)`: cloud call → parse → `computeSizing()` → returns `MarketSizing | null`
- `BusinessIdea.marketSizing JSONB` — result stored on the idea record
- Fire-and-forget: runs in background after turn response sent; client polls `GET /api/business/idea?ideaId=` every 3 s
- `components/business/MarketSizingPanel.tsx` — TAM/SAM/SOM display with user-adjustable sliders (samPct 1–80%, somPct 1–50%); all arithmetic in component

### Assumption → validation task → Todo
Two named assumptions (SAM, SOM), each with `validationTask` + `successThreshold`. On sizing completion, `createValidationTodos(userId, ideaId, sizing)` writes one `Todo` row per assumption. Guests: tasks rendered read-only from `guestSizing.assumptions` (no DB write).

### Todo model
Fields: `id`, `userId`, `title`, `completed`, `freq?` (schedule frequency: daily/weekly/monthly), `assumptionKey?` (market assumption key: "sam"/"som" — NOT a schedule), `hobbyId?`, `ideaId?`, `validationLabel?`, `successThreshold?`, `createdAt`. FKs: User (cascade), BusinessIdea (set null). Indexes on `[userId]` and `[ideaId]`.

**`freq` vs `assumptionKey`**: `freq` is for schedule-frequency use only. `assumptionKey` replaced the BIZDOC-4 pattern of storing "sam"/"som" in `freq`. Existing rows migrated via Neon SQL. Do not put assumption keys in `freq`.

### Two-view pattern — ONE list, ONE source of truth
| View | Component | Filter | Used in |
|---|---|---|---|
| Self-tab | `components/self/TodoList.tsx` | All todos | Self → Tasks |
| Business idea sidebar | `components/business/ValidationTasks.tsx` | `?ideaId=` | Idea evaluation page |

`PUT /api/self/todos/[id]` is the single write path — completing in any view updates the same row.

`GET /api/self/todos` accepts `?ideaId=`, `?hobbyId=` filters. `POST /api/self/todos` accepts `ideaId`, `validationLabel`, `successThreshold`, `assumptionKey`.

**There is no Initiative Hub view** — a third "Initiative Hub overview" card (`?validationOnly=true`, all of the user's validation todos with no per-initiative scoping) leaked tasks across unrelated businesses (`BusinessIdea` has no FK to `Page`/`Store`) and was removed entirely (TODO-SCOPE-FIX-1 / TODO-LEAK-FIX-2, 2026-06-08). Do not re-add it without first migrating in a real `BusinessIdea → Page` link.

## Business↔Goal Linking (BIZDOC-5)

Goals (`AiGoal`) and businesses (`BusinessIdea`) are **separate independently-created entities**. The link is many-to-many and mutable. A business does NOT graduate into a goal.

### Link storage
`BusinessIdeaGoal (businessIdeaId, goalId)` — join table, composite PK, cascade-delete on both sides. Added via Neon MCP migration. Use raw SQL until full `prisma generate` runs (new table, not in stale DLL).

### API routes
| Route | Auth | Action |
|---|---|---|
| `GET /api/business/idea/goals?ideaId=` | Session or biz-guest cookie | List linked goals |
| `POST /api/business/idea/goals { ideaId, goalId }` | Session required | Link (idempotent) |
| `DELETE /api/business/idea/goals { ideaId, goalId }` | Session required | De-link |

### UI
`components/business/GoalLinker.tsx` — shown below `ResultsReport` on the idea page after evaluation. Guests see nothing. Fetches all user goals + currently linked goals in parallel; toggle-style selection.

## Known Tech Debt

| Item | File | Impact |
|---|---|---|
| `Todo.hobbyId` orphaned FK | schema.prisma | No `Hobby` model exists; column is always null; vestigial |
| `/api/self/todos/stats` missing | `components/SelfAnalyticsDashboard.tsx` | Analytics page silently 404s on this route |

## Ownership Model

Ideas and their documents have a two-track ownership model:

| User type | How ownership is stored | Auth check |
|---|---|---|
| Logged-in | `BusinessIdea.userId` | session token must match |
| Guest | `BusinessIdea.guestSessionId` | `biz-guest` HTTP-only cookie must match |

**Guest persistence**: when a guest creates an idea (POST /api/business/idea without a session), a random UUID is written to `BusinessIdea.guestSessionId` and set as the `biz-guest` cookie (HttpOnly, 1-year, Secure in prod). The cookie persists across page loads. Clearing cookies orphans the ideas.

**Claim on login/verification**: on successful login (`POST /api/user/login`) and email verification (`GET /api/user/magic`), the `biz-guest` cookie is read and `claimGuestIdeas(guestSessionId, userId)` is called. This atomically sets `userId` on all ideas with that `guestSessionId` where `userId IS NULL`. Idempotent — already-claimed ideas are skipped.

**Manual claim**: `POST /api/business/claim-guest-ideas` (auth required) — for retroactive recovery.

## Document Types

`BusinessDocument.type` is a string with these defined values:

| Value | Panel | Status |
|---|---|---|
| `SWOT` | SWOT Analysis | Active |
| `BMC` | Business Model Canvas | Active |
| `FINANCIALS` | 3-Year Financial Plan | Active |
| `PROPOSAL` | Full Proposal | Reserved (not yet built) |
| `COMPETITOR` | Competitor Study | Coming soon (UI entry point exists, no template) |

`@@unique([ideaId, type])` — one document per type per idea.

## AI Document Assist

`POST /api/business/documents/generate` calls `chatComplete()` from `app/api/aiClient.ts` using the standard provider chain (Ollama → OpenRouter → Groq → Vercel). System context is loaded from `ai-context/BUSINESS_AI_PHILOSOPHY.txt` via `loadRawFile()`. Prompts are intentionally minimal stubs — real sector-aware intelligence and financial prefill come in BIZDOC-3/-4.

**Output shape per type:**
- `SWOT` → `{ strengths, weaknesses, opportunities, threats }` (JSON)
- `BMC` → `{ keyPartners, keyActivities, keyResources, valuePropositions, customerRelationships, channels, customerSegments, costStructure, revenueStreams }` (JSON)
- `FINANCIALS` → `{ year1, year2, year3 }` each `{ revenue, cogs, operatingCosts, marketingCosts, otherCosts }` (JSON, INR string values)

The client merges the AI content into the current form state and schedules a save — the AI never overwrites what the user already typed; it fills only the populated fields.

## Inputs & Outputs

| Direction | Value |
|---|---|
| In | Optional user session OR `biz-guest` cookie |
| In | Business idea: title, description |
| In | Answers to idea questions (per `IdeaQuestion.id`) |
| In | Document content (SWOT / BMC / Financials JSON) |
| Out | `BusinessIdea` record with per-dimension scores |
| Out | Real-time score update during live scoring |
| Out | Shareable report (via `shareToken`) |
| Out | `BusinessDocument` records upserted per type |
| Out | AI-generated draft content for any active document type |

## PDF System (BIZDOC-2)

Reuses the exact `@react-pdf/renderer` + Cloudinary stack from `app/api/orders/[orderId]/invoice/`. No new PDF library.

**Renderer components**: `lib/business/BusinessDocumentPdf.tsx` — exports `SWOTPdf`, `BMCPdf`, `FinancialsPdf`. All use `@react-pdf/renderer` primitives (`Document`, `Page`, `View`, `Text`, `StyleSheet`) matching the invoice component pattern.

**Upload helper**: `lib/business/uploadDocumentPdf.ts` — `uploadDocumentPdf(buffer, docId)`. Mirrors the `upload_stream` pattern from the invoice route. Key differences from invoices:
- `type: "upload"` (not `"authenticated"`) — PDF URLs are publicly readable, consistent with the public share page
- folder: `biz-docs/`, public_id: `{docId}`
- Raw Cloudinary URL is never sent directly to the browser — always proxied via server routes

**pdfUrl invalidation on save**: `PUT /api/business/documents` sets `pdfUrl: null` on every content save. This forces re-generation on the next download. The pdfUrl field acts as a one-use cache — generate-on-download if null, return cached URL if set.

**Generation flow**:
1. Plan page clicks "↓ PDF" → `GET /api/business/documents/pdf/download?ideaId=&type=`
2. Route checks ownership (session-OR-cookie), finds doc by `(ideaId, type)`
3. If `pdfUrl` is set: proxy Cloudinary URL as `attachment`; if null: render + upload + save `pdfUrl`, then proxy
4. Client receives PDF as `application/pdf` with `Content-Disposition: attachment`

**Share page PDF download**: `GET /api/business/share/[token]/pdf` — no auth, token is access. Same render-or-proxy logic.

## Share Link System (BIZDOC-2)

**Minting**: `POST /api/business/share { ideaId, type }` — auth required (ownership guard). Returns `{ shareToken }`. Idempotent — minting twice returns the same token.

**Token**: `randomUUID()` (128-bit random, crypto.randomUUID). Unguessable. Not sequential.

**Public document fetch**: `GET /api/business/share/[token]` — no auth. Returns only the matched document's `type`, `title`, `content`, `status`, `pdfUrl`, `updatedAt`. Deliberately excludes `ideaId`, `shareToken`, and all idea ownership fields.

**Safety**: A token exposes exactly one document. Other documents of the same idea are inaccessible unless they have their own shareToken. Mint/revoke is owner-only. There is currently no revoke endpoint — to remove public access, use the DB directly or delete the shareToken field.

**Share page**: `app/(business)/business/share/[token]/page.tsx` — server component, no auth, renders content read-only. Shows "↓ Download PDF" button pointing to `/api/business/share/[token]/pdf`.

**Plan page UX**: "🔗 Share" button → mints token (if not set) → copies share URL to clipboard. Share URL strip shown below the type dropdown when a token exists for the active type.

## Key API Routes

| Method | Route | Auth | Action |
|---|---|---|---|
| GET | /api/business/questions | None | Fetch question bank |
| POST | /api/business/idea | None | Create idea; sets `biz-guest` cookie for guests |
| GET | /api/business/idea | None | Fetch idea by ID or shareToken |
| PUT | /api/business/idea | Session or cookie | Update responses/status |
| POST | /api/business/idea/score | None | Final scoring |
| POST | /api/business/idea/score-live | None | Real-time per-answer score |
| GET | /api/business/documents?ideaId= | Session or cookie | List all documents |
| PUT | /api/business/documents | Session or cookie | Upsert document (invalidates pdfUrl) |
| POST | /api/business/documents/generate | Session or cookie | AI draft for a document type |
| GET | /api/business/documents/pdf/download | Session or cookie | Download PDF (generates if needed) |
| POST | /api/business/documents/pdf | Session or cookie | Pre-generate + cache pdfUrl |
| POST | /api/business/share | Session or cookie | Mint shareToken for a document |
| GET | /api/business/share/[token] | **None (public)** | Fetch document by shareToken |
| GET | /api/business/share/[token]/pdf | **None (public)** | Stream PDF for share page |
| POST | /api/business/claim-guest-ideas | Session | Claim guest ideas for logged-in user |

## Key Helpers

| File | Purpose |
|---|---|
| `lib/business/claimGuestIdeas.ts` | `claimGuestIdeas(guestSessionId, userId)` — atomic updateMany; idempotent |
| `lib/business/BusinessDocumentPdf.tsx` | `@react-pdf/renderer` components: `SWOTPdf`, `BMCPdf`, `FinancialsPdf` |
| `lib/business/uploadDocumentPdf.ts` | `uploadDocumentPdf(buffer, docId)` — Cloudinary upload_stream helper |
| `lib/business/runMarketSizing.ts` | BIZDOC-4: `runMarketSizing(title, desc, sector, answer)` → `MarketSizing | null`; math in code |

## Key Components

| Component | Role |
|---|---|
| `components/business/StartScreenBatch.tsx` | Entry point — prompts user to begin idea evaluation |
| `components/business/CollapsibleQuestionCard.tsx` | Collapsible question card with answer input |
| `components/business/LiveScoreDashboard.tsx` | Real-time score display per dimension |
| `components/business/ResultsReport.tsx` | Final scored report with dimension breakdown |
| `components/business/MarketSizingPanel.tsx` | BIZDOC-4: TAM/SAM/SOM display + user-adjustable sliders; all arithmetic in component |
| `components/business/ValidationTasks.tsx` | BIZDOC-4: ideaId-filtered todo list for the business page (one list, two views) |
| `components/self/TodoList.tsx` | BIZDOC-4: all-todos list for Self-tab; shows business-tagged todos with badge |
| `app/(business)/business/plan/[ideaId]/page.tsx` | Plan builder — type dropdown, SWOT/BMC/Financials panels, AI draft, PDF download, Share button, DB persistence |
| `app/(business)/business/share/[token]/page.tsx` | Public read-only share page — no auth, renders doc content + PDF download link |

## Database Models Used
- `BusinessIdea` — idea record: title, description, 6 score fields, shareToken, guestSessionId, userId; JSONB: `transcript`, `dimProvenance`, `interviewState`, `marketSizing` (BIZDOC-4)
- `BusinessDocument` — typed document per idea: type, content (Json), status, `@@unique([ideaId, type])`
- `IdeaQuestion` — question bank: text, type, category, scoringDim, dependsOn logic, options JSON
- `IdeaResponse` — user answer per question: answer, score, feedback
- `Todo` — BIZDOC-4: user tasks with optional `ideaId` tag; use `(db as any).todo`
- **`BusinessPlan` — retired** (model removed from schema; table preserved in DB but unused; data access via Prisma client no longer possible)

## BMC Layout

The Business Model Canvas uses a 5-column grid:
- **Row 1** (5 cols): Key Partners | Key Activities | Value Propositions (row-span 2) | Customer Relationships | Customer Segments (row-span 2)
- **Row 2** (cols 1–2, 4): Key Resources | (empty) | — | Channels | —
- **Row 3** (2 cols spanning full width): Cost Structure | Revenue Streams

The `md:row-span-2` spans on Value Propositions and Customer Segments are implemented via separate grid rows (not CSS `grid-row`). The second row only renders 2 explicitly placed cells (Key Resources at col 1, Channels at col 4 of a 5-col grid).

## AI Context Governance

`ai-context/BUSINESS_AI_PHILOSOPHY.txt` governs all AI behaviour in this module. It defines audience (informal workers, first-time founders in Bharat), stance (honest, sector-grounded, local-framed), per-document guidance (SWOT internal/external distinction, financial prefill honesty), and context-slicing rules (send only what the task needs). Do not change AI tone or rating behaviour without updating this file first.

## Risks & Fragile Areas
- `BusinessDocument.content` is untyped JSON. Shape is enforced only by the UI and the AI generate route — no DB-level validation.
- Guest ideas are orphaned if the user clears their cookies before logging in. No recovery path exists without the original `guestSessionId`.
- The `biz-guest` cookie is separate from the main `charaivati.session` cookie. The claim logic reads it from the Cookie header using a regex (login route uses `Request` not `NextRequest`).
- AI generate prompts are intentionally minimal stubs. Do not add full sector-aware intelligence here — that belongs in BIZDOC-3/-4 so context can be tested independently.

## Backlinks
- [[database.md]] — model definitions
- [[auth.md]] — session handling, guest merge pattern

---

<!-- Moved from CLAUDE.md (2026-06-26) -->
## Business Document PDF + Share System (BIZDOC-2)

### PDF generation — reuses invoice stack
`lib/business/BusinessDocumentPdf.tsx` — `@react-pdf/renderer` components: `SWOTPdf` (4-quadrant), `BMCPdf` (landscape 9-block), `FinancialsPdf` (Year 1/2/3 table). Same primitives (`Document`, `Page`, `View`, `Text`, `StyleSheet`) as `lib/invoice/InvoiceDocument.tsx`. No new PDF library.

`lib/business/uploadDocumentPdf.ts` — Cloudinary `upload_stream` helper. `type: "upload"` (public, not authenticated like invoices). folder: `biz-docs/`. Raw Cloudinary URL never sent to browser — always proxied via server routes.

**pdfUrl invalidation**: `PUT /api/business/documents` sets `pdfUrl: null` on every save. Forces re-generation on next download. Generate-on-download (via `GET /api/business/documents/pdf/download`) or pre-generate (via `POST /api/business/documents/pdf`).

### Share token system
`POST /api/business/share { ideaId, type }` — mints a `randomUUID()` shareToken on the BusinessDocument if none exists. Idempotent. Auth: ownership guard.

`GET /api/business/share/[token]` — **public, no auth**. Returns only: `type, title, content, status, pdfUrl, updatedAt`. Excludes ideaId and all ownership fields. One token → one document, never a bundle.

`GET /api/business/share/[token]/pdf` — **public, no auth**. Generates + proxies PDF. Token is the access grant.

Public share page: `app/(business)/business/share/[token]/page.tsx` — server component, no auth, read-only render + "↓ Download PDF" link.

Plan page: "🔗 Share" button mints token + copies URL to clipboard. "↓ PDF" button proxies download. Share URL strip shown below the type tabs.

### No i18n system found
No i18n/translation system exists in this codebase. All UI strings are inline English throughout. Document this if a translation system is added in the future.

## Adaptive Evaluation Engine (BIZDOC-3)

Replaces the old batch 12-question form with a turn-by-turn AI conversation. Three roles handle each evaluation:

| Role | Provider | Trigger |
|---|---|---|
| **Interviewer** | Local Ollama via `chatComplete()` | Every turn — scores answer, returns confidence |
| **Assessor** | Cloud via `callAI({ provider:"openrouter" })` — bypasses Ollama | When local confidence < `CONFIDENCE_THRESHOLD`, once per dimension |
| **Cross-check** | Server logic | After both scores exist: if `|local − assessor| > DISAGREEMENT_THRESHOLD`, queue one probe |

### Tunable constants — `lib/business/interviewConfig.ts`
`CONFIDENCE_THRESHOLD = 0.55`, `DISAGREEMENT_THRESHOLD = 1.0`, `MAX_PROBES_PER_DIM = 2`, `LOCAL_TIMEOUT_MS = 12_000`, `ASSESSOR_TIMEOUT_MS = 20_000`. Also contains `PROBE_TEMPLATES` (sector-tuned static list), `detectSector()`, and all prompt-builder functions.

### Rail-guided questions
The 12 seeded `IdeaQuestion` rows are the base menu. The server deterministically advances `interviewState.currentIndex`. The AI does **not** invent questions — it only adds to `probeQueue` by selecting from `PROBE_TEMPLATES`. This keeps the question set auditable.

### Graceful degradation
When Ollama is unavailable, `chatComplete()` falls through to cloud automatically. `interviewState.localUnavailable = true` is set. Effect: no cloud Assessor is triggered (redundant), all provenance stays `"local_estimate"`, and the UI shows `"Quick evaluation — senior review unavailable"` on each turn + a yellow badge in `ResultsReport`.

### Provenance display
`dimProvenance[dim]` is `"local_estimate"` or `"senior_reviewed"`. Shown in `LiveScoreDashboard` (✦ / ~ badges per dimension) and in `ResultsReport` (per-dim badge + overall tier banner). Stored on `BusinessIdea.dimProvenance` (JSONB).

### New DB fields on `BusinessIdea` (added via Neon migration)
- `transcript JSONB` — `ConversationTurn[]` — full conversation with dim and questionKey per turn
- `dimProvenance JSONB` — `Record<dim, "local_estimate" | "senior_reviewed">`
- `interviewState JSONB` — `InterviewState` (currentIndex, sector, probeQueue, probeCount, provisionalScores, assessorScores, assessorRun, done, localUnavailable)

Use `(db as any).businessIdea` until `prisma generate` has been run with these fields present.

### Key API routes added
- `POST /api/business/idea/interview` — main turn handler; `{ ideaId, userMessage: string | null }`; returns `{ question, dim, done, provisional, tier, turnNum }`
- `POST /api/business/idea/interview/finalize` — runs cloud Assessor on unreviewed dims, calls `runFinalVerdict()`, persists final scores; returns `{ scores, overallScore, report, tier, dimProvenance }`

### Key lib files
- `lib/business/interviewConfig.ts` — all static config, types, sector detection, prompt builders
- `lib/business/runInterviewer.ts` — `runInterviewer(dim, questionText, answer, sector)` → `{ score, confidence, followUpNeeded, source }`
- `lib/business/runAssessor.ts` — `runAssessor(...)` → `AssessorResult | null`; `runFinalVerdict(...)` → `FinalVerdictResult` with local fallback

### UI changes (`app/(business)/business/idea/page.tsx`)
Replaced the batch form with a chat-bubble layout (user right / assistant left). `handleStart()` creates the idea then calls interview with `userMessage: null` to get the first question. `handleAnswer()` submits turns. `handleFinalize()` calls the finalize route and renders `ResultsReport`. `LiveScoreDashboard` sidebar updates provisionally after every turn.

## Market-Sizing Deepening + Validation Tasks (BIZDOC-4)

Extends BIZDOC-3 with three additions: (a) AI reaction per answer, (b) TAM/SAM/SOM market-sizing on first `marketNeed` answer, (c) assumption → validation task → Todo. Full design spec: `docs/BUSINESS_ANALYSIS_FLOW.md`.

### Math-in-code contract
**MATH IN CODE, JUDGMENT IN MODEL** — the cloud model returns only: population basis, SAM%, SOM%, and rationale. ALL arithmetic (`tam = pop`, `sam = round(tam × samPct)`, `som = round(sam × somPct)`) is computed in `components/business/MarketSizingPanel.tsx` and by `computeSizing()` in `lib/business/runMarketSizing.ts`. Never let the AI compute numbers.

### AI reaction per answer
`runInterviewer()` in `lib/business/runInterviewer.ts` now returns `reaction: string | null`. The prompt wrapper `buildInterviewerPromptWithReaction()` appends a `reaction` field to the JSON template — one short honest sentence reacting to the user's answer. The interview route passes `reaction` through in the turn response. On the idea page, reactions render as small italic text between the user bubble and the next question bubble. Graceful degradation: if the model returns no reaction, the field is null and nothing renders.

### Market-sizing deepening (TAM/SAM/SOM)
Fires exactly once per interview — on the first `marketNeed` dimension answer — controlled by `interviewState.marketSizingDone` (added to `InterviewState` in `lib/business/interviewConfig.ts`).

- **`lib/business/runMarketSizing.ts`** — `runMarketSizing(title, desc, sector, answer)`: calls cloud OpenRouter model, parses JSON `{ populationBasis, samPct, samRationale, somPct, somRationale, samValidationTask, samSuccessThreshold, somValidationTask, somSuccessThreshold }`, runs `computeSizing()` to produce `{ tam, sam, som, assumptions[] }`. Returns `MarketSizing | null` (null when cloud unavailable).
- **`BusinessIdea.marketSizing JSONB`** — stored on the idea. Added via Neon migration alongside the `Todo` table.
- **Fire-and-forget** — `runMarketSizing()` runs as a background promise in the interview route. Client gets `marketSizingPending: true` and polls `GET /api/business/idea?ideaId=` every 3 s until `marketSizing` appears.
- **`components/business/MarketSizingPanel.tsx`** — client component. Props: `{ sizing: MarketSizingData, ideaId, isGuest }`. User can adjust `samPct`/`somPct` sliders; numbers recompute instantly in component code. Shows TAM/SAM/SOM grid + sliders + validation task cards. Guest footer says "Sign in to save"; logged-in footer links to todo list.
- **User-adjustable sliders** — `samPct` (1–80%), `somPct` (1–50%). Initialized from model's values, editable client-side only (not persisted).

### Assumption → validation task → Todo
When market sizing completes server-side, `createValidationTodos(userId, ideaId, sizing)` writes one `Todo` row per assumption (SAM + SOM tasks). For guests: sizing is stored on the idea JSON and surfaced read-only by `ValidationTasks` from `guestSizing` prop — no DB write.

### Todo model (added BIZDOC-4, updated BIZDOC-5)
Fields: `id`, `userId`, `title`, `completed`, `freq?` (schedule frequency: "daily"/"weekly"/"monthly" — NOT an assumption key), `assumptionKey?` ("sam"/"som" — which market assumption this validates), `hobbyId?`, `ideaId?`, `validationLabel?`, `successThreshold?`, `createdAt`. Use `db.todo` (typed after full `prisma generate`).

**`freq` vs `assumptionKey`** — `freq` is for schedule frequency only. BIZDOC-4 incorrectly used `freq` to store "sam"/"som"; BIZDOC-5 migrated those rows to `assumptionKey` and cleared `freq`. Do not store assumption keys in `freq`.

### Two-view pattern (ONE list, two views — BIZDOC-5, corrected by TODO-SCOPE-FIX-1)
- **Self-tab** (`components/self/TodoList.tsx`) — all user todos; idea-tagged todos show indigo badge.
- **Business idea sidebar** (`components/business/ValidationTasks.tsx`) — filtered by `?ideaId=`.
- `GET /api/self/todos` accepts `?ideaId=`, `?hobbyId=` filters.
- `POST /api/self/todos` accepts `ideaId`, `validationLabel`, `successThreshold`, `assumptionKey`.
- **The Initiative Hub overview no longer renders a validation-tasks card** (TODO-SCOPE-FIX-1, completed by TODO-LEAK-FIX-2, 2026-06-08) — `BusinessIdea` has NO foreign key to `Page`/`Store`/initiative (it is a fully independent entity, same as `AiGoal` per BIZDOC-5's linking philosophy). The removed `validationOnly=true` mode queried ALL of the user's validation todos (`validationLabel IS NOT NULL`, scoped only by `userId`) and rendered them on every initiative's Overview tab — so a user with two businesses ("Selling toys" store + "Breakfast by Arun" evaluation) saw the other business's tasks bleed onto each initiative's page. There is no schema field to scope by initiative; do not re-add a cross-business validation card to `InitiativeTabs.tsx` without first adding a real `BusinessIdea → Page` link (migration) and filtering on it.
  - **The leak had exactly ONE render site, not two** — TODO-LEAK-FIX-2 ran an exhaustive repo-wide grep (`ValidationTasks`, `validationOnly`, `VALIDATION TASKS`, `business evaluations`, `Self → Tasks`) and confirmed the only place that ever rendered the cross-business card was `<ValidationTasks validationOnly isGuest={false} />` in `components/earn/InitiativeTabs.tsx`'s Overview tab — removing it (and deleting the now-dead `validationOnly` prop + its self-contained-card branch from `components/business/ValidationTasks.tsx`, and the param read from `GET /api/self/todos`) closes every leak. If the card appears to "still" show up after this fix is in the working tree, suspect a **stale dev bundle** first (the component is loaded via `dynamic(() => import(...), { ssr: false })`; removing the import leaves an orphaned chunk in `.next` that a client-side navigation can keep serving from cache) — restart the dev server and hard-refresh before assuming a new render site exists.
  - Validation tasks remain visible (correctly scoped) in exactly two places: the Self tab (`components/self/TodoList.tsx`, all todos, idea-tagged badge) and the specific business idea's page (`app/(business)/business/idea/page.tsx` → `<ValidationTasks ideaId={...} />`, plus the guest-only read-only view in `components/business/MarketSizingPanel.tsx`).

### Guest handling
- Guests cannot create Todo rows (session-only auth on the todos API).
- Market sizing is stored on `BusinessIdea.marketSizing` (accessible via guest cookie ownership).
- `ValidationTasks` receives `guestSizing` prop — renders assumption tasks read-only from the JSON with a "Sign in to save" note.
- `createValidationTodos()` is gated on `sessionUserId` — no-op for guests.

## Business↔Goal Linking (BIZDOC-5)

Goals (`AiGoal`) and businesses (`BusinessIdea`) are **separate independently-created entities**. A goal can have many businesses linked. A business does NOT require a goal and is NOT promoted into a goal. The link is mutable — add or remove at any time.

### Link storage
`BusinessIdeaGoal (businessIdeaId, goalId)` — many-to-many join table, composite PK, cascade-delete on both sides. Added via Neon MCP migration. **Uses raw SQL (`$queryRaw`/`$executeRaw`) until full `prisma generate` is run** — the new model is not in the stale DLL engine.

### API routes (`app/api/business/idea/goals/route.ts`)
| Method | Auth | Action |
|---|---|---|
| GET `?ideaId=` | Session or biz-guest cookie | List linked goals (guests always return `[]`) |
| POST `{ ideaId, goalId }` | Session required | Link idea → goal (idempotent, ownership verified) |
| DELETE `{ ideaId, goalId }` | Session required | De-link |

### UI
`components/business/GoalLinker.tsx` — rendered below `ResultsReport` on the idea page after evaluation completes. Fetches `/api/self/goals` + linked goals in parallel. Toggle-style selection. Guests see nothing.

### freq → assumptionKey migration
`Todo.freq` is now schedule-frequency only. The "sam"/"som" discriminator was migrated to `Todo.assumptionKey String?` via Neon SQL. All three write paths (`createValidationTodos`, market-sizing PATCH, todos POST) now use `assumptionKey`. `market-sizing/route.ts` reconciles labels using `{ ideaId, assumptionKey: "sam"/"som" }`.

## Business Document System (BIZDOC-1b)

Per-idea typed documents replace the old `BusinessPlan` model (retired — table still exists in DB but Prisma client no longer exposes it).

### BusinessDocument model
`@@unique([ideaId, type])` — one document per type per idea. Types: `SWOT | BMC | FINANCIALS | PROPOSAL | COMPETITOR`. `content` is Json, shape is type-specific. `status` is `DRAFT | COMPLETE`.

### Guest ownership
`BusinessIdea` has a `guestSessionId String?` field. When a non-logged-in user creates an idea, a UUID is stored there and set as the `biz-guest` HTTP-only cookie. All document read/write routes check this cookie if no userId is matched. Clearing the cookie orphans the ideas.

### Claim on login
`lib/business/claimGuestIdeas.ts` — `claimGuestIdeas(guestSessionId, userId)`: `updateMany` where `guestSessionId=X AND userId IS NULL`. Called in `POST /api/user/login` (parses Cookie header) and `GET /api/user/magic` (via `NextRequest.cookies`). Idempotent.

### AI document assist
`POST /api/business/documents/generate` — calls `chatComplete()` with a minimal prompt per type. System context from `ai-context/BUSINESS_AI_PHILOSOPHY.txt`. Real sector intelligence deferred to BIZDOC-3/-4. The financials prompt uses `year1/year2/year3` shape matching the page's `FinancialPlan` type — not the old `phase1/phase2` format.

### Plan page (app/(business)/business/plan/[ideaId]/page.tsx)
- Loads all docs on mount via `GET /api/business/documents?ideaId=`
- Saves with 1.5 s debounce via `PUT /api/business/documents`
- Document type dropdown: SWOT / BMC / Financials / Competitor Study (disabled, "Soon" badge)
- "✨ AI Draft" button calls generate route and merges returned content into current state
- Auto-save status shown inline ("Saving…" / "✓ Saved")
- BMC layout: 5-col grid, Value Propositions and Customer Segments span rows; Key Resources col 1, Channels col 4 in row 2; Cost Structure + Revenue Streams in row 3 (2-col)

