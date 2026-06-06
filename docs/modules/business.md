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
| `lib/business/runInterviewer.ts` | `runInterviewer(dim, questionText, answer, sector)` → `{ score, confidence, followUpNeeded, source }` |
| `lib/business/runAssessor.ts` | `runAssessor(dim, ...)` → `AssessorResult | null`; `runFinalVerdict(...)` → `FinalVerdictResult` |

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

## Key Components

| Component | Role |
|---|---|
| `components/business/StartScreenBatch.tsx` | Entry point — prompts user to begin idea evaluation |
| `components/business/CollapsibleQuestionCard.tsx` | Collapsible question card with answer input |
| `components/business/LiveScoreDashboard.tsx` | Real-time score display per dimension |
| `components/business/ResultsReport.tsx` | Final scored report with dimension breakdown |
| `app/(business)/business/plan/[ideaId]/page.tsx` | Plan builder — type dropdown, SWOT/BMC/Financials panels, AI draft, PDF download, Share button, DB persistence |
| `app/(business)/business/share/[token]/page.tsx` | Public read-only share page — no auth, renders doc content + PDF download link |

## Database Models Used
- `BusinessIdea` — idea record: title, description, 6 score fields, shareToken, guestSessionId, userId
- `BusinessDocument` — typed document per idea: type, content (Json), status, `@@unique([ideaId, type])`
- `IdeaQuestion` — question bank: text, type, category, scoringDim, dependsOn logic, options JSON
- `IdeaResponse` — user answer per question: answer, score, feedback
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
