---
module: helping-initiative
type: api + component
source: app/api/helping-initiative/, components/initiative/
depends_on: [database, auth, pages]
used_by: [mobile-shell, navigation-tabs]
stability: evolving
status: active
---

# Module: Helping Initiative

## Purpose
Enables users and organizations to publish cause-driven pages (NGO/charity-style) with structured objectives, actions, and metrics. Initiatives can optionally accept donations. They are surfaced in the mobile app's "Initiatives" tab.

## Responsibilities
- Create and manage `HelpingInitiative` pages (linked to `Page`)
- Define and track objectives with associated actions
- Log impact metrics
- Support optional donation enablement flag
- Surface initiatives in the mobile app feed

## Inputs & Outputs

| Direction | Value |
|---|---|
| In | Authenticated user session |
| In | Initiative metadata: cause, targetGroup, location, awarenessText, acceptDonations |
| In | Objective definitions |
| In | Action records linked to objectives |
| In | Metric data points |
| Out | `HelpingInitiative` page record |
| Out | Objective and action lists |
| Out | Metric aggregates |

## Dependencies
- **auth** — creation and management require authentication
- **database** — HelpingInitiative model
- **pages** — HelpingInitiative is always a sub-model of a `Page` (`pageType: 'helping-initiative'`)

## Reverse Dependencies (what breaks if this changes)
- The mobile app's "Initiatives" tab (`/app/initiatives`) queries this module's data. Changes to the API response shape break the mobile feed.
- `HelpingInitiative.acceptDonations` is a boolean flag. If payment/donation logic is ever implemented on top of this flag, changing its default value will inadvertently enable or disable donation collection for existing initiatives.
- Objectives and actions are child records. Deleting an initiative without cascading to its objectives and actions leaves orphaned rows.

## Runtime Flow

### Creating an initiative
1. User creates a `Page` with `pageType: 'helping-initiative'`
2. API creates linked `HelpingInitiative` record with cause, targetGroup, location, awarenessText
3. User adds objectives via `POST /api/helping-initiative/[id]/objectives`
4. User adds actions under objectives via `POST /api/helping-initiative/[id]/actions`
5. User logs metrics via `POST /api/helping-initiative/[id]/metrics`

### Viewing the initiatives feed (mobile)
1. Client fetches `GET /api/helping-initiative` (list)
2. API returns initiatives with summary metadata
3. `app/app/initiatives` page renders the feed
4. `components/initiative/InitiativePostsBlock.tsx` renders posts linked to an initiative

## Key API Routes

| Method | Route | Action |
|---|---|---|
| POST | /api/helping-initiative | Create initiative |
| GET | /api/helping-initiative | List all initiatives |
| GET | /api/helping-initiative/[id] | Initiative detail |
| PATCH | /api/helping-initiative/[id] | Update initiative |
| GET | /api/helping-initiative/by-page/[pageId] | Initiative for a page |
| POST | /api/helping-initiative/[id]/objectives | Add objective |
| POST | /api/helping-initiative/[id]/actions | Add action |
| POST | /api/helping-initiative/[id]/metrics | Log metric |

## Key Components

| Component | Role |
|---|---|
| `components/initiative/InitiativePostsBlock.tsx` | Renders posts associated with an initiative |

## Database Models Used
- `HelpingInitiative` — cause, targetGroup, location, awarenessText, acceptDonations, objectives (relation), metrics (relation)
- Sub-models: Objective, Action, Metric — exact model names TODO: confirm in schema

## Risks & Fragile Areas
- `acceptDonations` is a boolean but no payment gateway integration is observed. Enabling this flag creates a user expectation of payment capability that does not exist. TODO: Confirm whether any donation flow is implemented.
- Metric logging has no schema enforcement — any key/value pair can be submitted. There is no aggregation or visualization logic observed beyond raw log storage. TODO: Confirm whether metrics are displayed anywhere.
- The mobile "Initiatives" tab is a key discovery surface. Performance of `GET /api/helping-initiative` is important — confirm it is paginated and not returning the full table.
- TODO: Confirm whether initiatives have a published/draft status and whether unpublished initiatives are excluded from the feed.

## Owner Entry Point
Initiative pages are managed through the **Initiative Hub** at `/earn/initiative/[pageId]`. The "Open →" button on each card in `app/app/initiatives/page.tsx` and `EarningTab.tsx` navigates there. Inside the Hub, the **Overview tab** links to `/business/helping/[pageId]` (the existing HelpingInitiativeStudio for objectives/metrics/awareness) and `/helping/[pageId]` (public view).

## Backlinks
- [[pages.md]] — HelpingInitiative as a Page sub-model
- [[database.md]] — model definitions
- [[auth.md]] — session required for creation
- [[mobile-shell.md]] — Initiatives tab in bottom nav
- [[collaboration.md]] — Partners tab available on all initiative pages via the Initiative Hub
