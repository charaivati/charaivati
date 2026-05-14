---
module: timeline
type: api + component
source: app/api/timelines/, components/timeline/, lib/timeline-templates.ts
depends_on: [database, auth, goals-ai]
used_by: [navigation-tabs]
stability: stable
status: active
---

# Module: Timeline

## Purpose
Provides structured project management for user goals. A timeline is a container of ordered phases, each with milestones. Timelines can be created from predefined templates or linked directly to an `AiGoal`'s execution plan.

## Responsibilities
- Timeline CRUD (create, read, update, delete)
- Phase management within a timeline (status, dates)
- Milestone checkbox tracking within a phase
- Template picker for common domains (product, service, health, relationship)
- Linking timelines to AiGoal records
- Progress visualization

## Inputs & Outputs

| Direction | Value |
|---|---|
| In | Authenticated user session |
| In | Timeline metadata: title, description, domain, templateId, startDate, targetDate |
| In | Phase updates: status, startDate, targetDate |
| In | Milestone toggle: isCompleted |
| Out | Timeline with nested phases and milestones |
| Out | Progress state per phase and per milestone |

## Dependencies
- **auth** — all timeline operations are user-scoped
- **database** — ProjectTimeline, TimelinePhase, PhaseMilestone models
- **goals-ai** — timelines can be linked to an `AiGoal` (via `goalId`)
- **lib/timeline-templates.ts** — predefined phase and milestone structures per domain

## Reverse Dependencies (what breaks if this changes)
- `ProjectTimeline.domain` enum (`product | service | health | relationship`) maps to template sets in `lib/timeline-templates.ts`. Adding a new domain without a corresponding template entry leaves it templateless.
- `TimelinePhase.phaseKey` is a string identifier used to match phases to template definitions. If keys are renamed in templates, existing phase rows lose their template association.
- `ProjectTimeline.goalId` is a nullable FK to `AiGoal`. If `AiGoal` is deleted and cascade is not set, orphaned timelines with a stale `goalId` may cause FK errors.
- `PhaseMilestone.isCompleted` drives progress calculation in the UI. If bulk operations update milestones without updating phase status, progress display becomes inconsistent.

## Runtime Flow

### Creating a timeline from a template
1. Client opens `components/timeline/CreateTimelineModal.tsx`
2. User selects a domain — `components/timeline/TemplatePicker.tsx` shows available templates
3. Client fetches template definition from `lib/timeline-templates.ts` (client-side import)
4. User confirms — client POSTs to `POST /api/timelines` with template phases pre-populated
5. API creates `ProjectTimeline` + `TimelinePhase` records + `PhaseMilestone` records in a transaction

### Updating a phase
1. Client PATCHes `PATCH /api/timelines/[id]/phases/[phaseId]` with new status or dates
2. API updates `TimelinePhase` record
3. TODO: Confirm whether phase status change is reflected in parent timeline status

### Completing a milestone
1. Client POSTs to `POST /api/timelines/[id]/phases/[phaseId]/milestones/[milestoneId]`
2. API toggles `PhaseMilestone.isCompleted`
3. UI recomputes phase and overall progress

### Viewing timelines
1. Client fetches `GET /api/timelines` — list of user's timelines with summary
2. Client fetches `GET /api/timelines/[id]` — full detail with phases and milestones
3. `components/timeline/TimelineDetail.tsx` renders phases as rows with milestone checkboxes

## Key API Routes

| Method | Route | Action |
|---|---|---|
| POST | /api/timelines | Create timeline (with phases) |
| GET | /api/timelines | List user's timelines |
| GET | /api/timelines/[id] | Full timeline detail |
| PATCH | /api/timelines/[id] | Update timeline metadata |
| PATCH | /api/timelines/[id]/phases/[phaseId] | Update phase |
| POST | /api/timelines/[id]/phases/[phaseId]/milestones/[milestoneId] | Toggle milestone |

## Key Components

| Component | Role |
|---|---|
| `components/timeline/CreateTimelineModal.tsx` | Modal for creating a new timeline |
| `components/timeline/TemplatePicker.tsx` | Template domain selector |
| `components/timeline/TimelineList.tsx` | List all user timelines |
| `components/timeline/TimelineCard.tsx` | Summary card with progress bar |
| `components/timeline/TimelineDetail.tsx` | Full timeline view with phase rows |
| `components/timeline/PhaseRow.tsx` | Single phase with milestones |
| `components/timeline/MilestoneCheckbox.tsx` | Individual milestone toggle |
| `components/timeline/TimelineProgressBar.tsx` | Visual progress indicator |

## Key Libraries

| File | Role |
|---|---|
| `lib/timeline-templates.ts` | Predefined timeline structures per domain; arrays of phases with milestone titles |

## Database Models Used
- `ProjectTimeline` — container: title, description, domain, templateId, isLifelong, startDate, targetDate, status, goalId (nullable)
- `TimelinePhase` — phase: title, phaseKey, order, status, startDate, targetDate
- `PhaseMilestone` — milestone: title, isCompleted, dueDate

## Risks & Fragile Areas
- Template definitions live in `lib/timeline-templates.ts` as static TypeScript. There is no admin UI to modify templates without a code deploy. TODO: Confirm whether templates are intended to be editable at runtime.
- `ProjectTimeline.isLifelong` boolean has unclear UI handling. TODO: Confirm how lifelong timelines handle `targetDate` being null or far future.
- Timeline creation likely creates phases and milestones in a single API call. If the creation is not transactional, partial creation (timeline with no phases) can occur on error.
- No deletion route observed for individual phases or milestones. TODO: Confirm whether phases/milestones can be removed after creation.

## Backlinks
- [[database.md]] — ProjectTimeline, TimelinePhase, PhaseMilestone model definitions
- [[goals-ai.md]] — AiGoal links to ProjectTimeline via goalId
- [[auth.md]] — session required for all timeline operations
- [[navigation-tabs.md]] — timeline UI rendered within the Self layer tabs
