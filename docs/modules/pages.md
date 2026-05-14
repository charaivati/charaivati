---
module: pages
type: api + database pattern
source: app/api/pages/, prisma/schema.prisma (Page model)
depends_on: [database, auth, media]
used_by: [store, health, helping-initiative, navigation-tabs]
stability: stable
status: active
---

# Module: Pages

## Purpose
`Page` is the polymorphic profile/content container that backs every public-facing entity in the platform. A store, a course, a health practitioner page, and a helping initiative all share one `Page` row, with a sub-model linked 1:1 per type. This module defines how pages are created, followed, and queried.

## Responsibilities
- Create and manage `Page` records as the root of any published entity
- Route creation to the correct sub-model based on `pageType`
- Handle page follows (one-way subscriptions)
- Handle expert subscriptions (health businesses)
- Serve page metadata for profile display
- Track view counts

## Inputs & Outputs

| Direction | Value |
|---|---|
| In | Authenticated user session (for write operations) |
| In | pageType: `store | course | health-business | helping-initiative` |
| In | Page metadata: title, description, avatarUrl |
| Out | `Page` record with linked sub-model |
| Out | Follow relationship |
| Out | Paginated list of pages |

## Dependencies
- **auth** — ownership and follow operations require a session
- **database** — Page model plus sub-models (Store, Course, HealthBusiness, HelpingInitiative)
- **media** — page avatar images uploaded via Cloudinary

## Reverse Dependencies (what breaks if this changes)
- `Page.pageType` is the discriminator. Any code that switches on `pageType` (rendering, routing, sub-model resolution) breaks if the enum values change.
- Every sub-module (store, health, helping-initiative) assumes a `Page` row exists before the sub-record is created. Deleting a `Page` cascades to its sub-model.
- `Page.viewCount` is incremented on each view. If this becomes a hot field under high traffic, it can cause write contention. TODO: Confirm whether viewCount is incremented synchronously or via a queue.
- Follow relationships are stored as a separate table. Deleting a Page does not automatically notify followers.

## Runtime Flow

### Page creation
1. Client POSTs to the relevant sub-module API (e.g. `POST /api/store` for a store page)
2. Sub-module API first creates a `Page` record with `pageType` and metadata
3. Then creates the sub-model record linked to the new `Page.id`
4. Returns the combined record

### Page lookup
1. Client fetches `GET /api/pages/[id]`
2. API returns Page with the relevant sub-model included based on `pageType`
3. Frontend routes to the correct rendering component

### Following a page
1. Client POSTs to `POST /api/pages/[id]/follow`
2. API creates a follow relationship (TODO: confirm model name — `PageFollow` or similar)
3. `GET /api/user/follows` returns all pages a user follows

### Expert subscription (health-business pages only)
1. Client POSTs to `POST /api/pages/[id]/subscribe` with tier and consent fields
2. API creates `ExpertSubscription` record
3. User gains access to expert content per tier

## Key API Routes

| Method | Route | Action |
|---|---|---|
| GET | /api/pages | List pages (filterable by pageType) |
| GET | /api/pages/[id] | Page with sub-model |
| POST | /api/pages/[id]/follow | Follow a page |
| POST | /api/pages/[id]/subscribe | Expert subscription |
| GET | /api/user/follows | Pages followed by current user |
| GET | /api/user/pages | Pages owned by current user |

## Database Models Used
- `Page` — root record: ownerId, title, description, avatarUrl, status, pageType, viewCount
- `Store` — linked 1:1 when `pageType: 'store'`
- `Course` — linked 1:1 when `pageType: 'course'`
- `HealthBusiness` — linked 1:1 when `pageType: 'health-business'`
- `HelpingInitiative` — linked 1:1 when `pageType: 'helping-initiative'`
- `ExpertSubscription` — user ↔ health business subscription

## Risks & Fragile Areas
- The polymorphic pattern means every query for a page must know its type to include the right sub-model. Fetching a page without knowing its type requires including all four sub-models and picking the non-null one — expensive and fragile.
- There is no enforced DB constraint ensuring exactly one sub-model exists per page. A bug in creation logic could leave a Page with no sub-model or multiple.
- `Page.status` likely controls visibility (published/draft/archived). TODO: Confirm status values and how they affect API responses.
- Page deletion must cascade cleanly through all four sub-model types. If a new sub-model is added in future, the deletion cascade must be explicitly handled.

## Backlinks
- [[START_HERE.md]] — Page polymorphic pattern
- [[database.md]] — Page model definition
- [[store.md]] — Store as a Page sub-model
- [[health.md]] — HealthBusiness as a Page sub-model
- [[helping-initiative.md]] — HelpingInitiative as a Page sub-model
- [[media.md]] — avatar upload for page profiles
