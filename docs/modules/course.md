---
module: course
type: api + database pattern
source: app/api/course/, prisma/schema.prisma (Course, StoreBlock, CourseProgress)
depends_on: [database, auth, pages, store]
used_by: [navigation-tabs]
stability: evolving
status: active
---

# Module: Course

## Purpose
Delivers structured learning content with per-user progress tracking and mastery scoring.
Courses share the same `Page`, `Store`, `StoreSection`, and `StoreBlock` infrastructure as
the store module — a course IS a store with `pageType: "learning"`. The `Course` DB model
adds only learning-specific metadata. The content, sections, and blocks are stored in and
queried from the `Store` table.

---

## How a Course Differs From a Store

| Dimension | Store (`pageType: "store"`) | Course (`pageType: "learning"`) |
|---|---|---|
| DB records | `Page` + `Store` + sections/blocks | `Page` + `Course` + `Store` + sections/blocks |
| Extra metadata model | None | `Course` (courseType, aspectWeights, courseTags) |
| Content model | `StoreBlock` (product) | `StoreBlock` (lesson) — same table |
| Progress | `CartItem` / `Order` | `CourseProgress` (per-user per-block mastery) |
| Block gating | `access: "free" | "paid"` | `blockStatus: "locked"` + `prereqIds` on sections |
| UI rendering | Store browsing layout | Learning layout (`pageType === "learning"` check) |
| Block `actionType` | `"buy"`, `"view"`, etc. | `"lesson"`, `"watch"`, etc. (TODO: confirm values) |

**The critical thing to understand:** a course page has **two** DB records for the same entity —
a `Course` record (metadata) and a `Store` record (content). Both are linked to the same
`pageId`. The `GET /api/course/[pageId]` route fetches both in parallel and merges them.

---

## Responsibilities
- Create and update the `Course` metadata record
- Serve course detail with sections, blocks, and current user's progress merged
- Track per-user per-block progress and mastery via `CourseProgress`
- Surface locked vs unlocked state for each block
- Section prerequisite enforcement (which sections must be completed before others unlock)

---

## Inputs & Outputs

| Direction | Value |
|---|---|
| In | `pageId` — the Page ID of the learning page |
| In | `courseType`, `dominantAspect`, `aspectWeights`, `aspectBenefits`, `courseTags` |
| In | `blockId`, `status`, `mastery` for progress updates |
| Out | Merged response: `Course` metadata + `Store` with sections/blocks + user progress array |
| Out | `CourseProgress` record (upserted per user per block) |

---

## Dependencies
- **auth** — progress is user-scoped; owner checks on course edits
- **database** — Course, CourseProgress, StoreBlock, StoreSection models
- **pages** — Course requires an existing `Page` with `pageType: "learning"`
- **store** — content lives in Store/StoreSection/StoreBlock; the `POST /api/course` route
  requires that a `Store` record also be linked to the same `pageId` for content to exist

---

## Reverse Dependencies (what breaks if this changes)
- `CourseProgress` is keyed on `{ userId, blockId }` with a `@@unique` constraint. If a block
  is deleted, its `CourseProgress` rows cascade-delete, losing all users' progress for that lesson.
- `StoreBlock.blockStatus` is `"locked"` by default for all blocks. A course page that never
  runs the progress/unlock flow will show all lessons as locked forever.
- `StoreSection.prereqIds` holds section IDs. If a section is deleted, its ID remains in
  other sections' `prereqIds` arrays as a stale pointer — no cascade cleans this up.
- The rendering switch in `app/store/[id]/page.tsx` checks `store.pageType === "learning"`.
  If `pageType` changes on a page, its UI switches between store and course rendering immediately.

---

## Runtime Flow

### Creating a course
1. Client creates a `Page` with `pageType: "learning"` via `POST /api/user/pages`
2. Client creates a `Store` linked to the same `pageId` via `POST /api/store`
   (Store content is required; course metadata alone is not renderable)
3. Client creates the `Course` metadata via `POST /api/course` with `{ pageId, courseType, ... }`
4. Client creates `StoreSection` and `StoreBlock` records via `/api/section` and `/api/block`

TODO: Confirm whether there is a flow that creates both the Store and Course in a single call,
or whether both must always be created as separate steps.

### Fetching a course (with progress)
1. Client fetches `GET /api/course/[pageId]`
2. Route runs three queries in parallel:
   - `prisma.course.findUnique({ where: { pageId }, include: { page } })`
   - `prisma.store.findFirst({ where: { pageId }, include: { sections: { include: { blocks } } } })`
   - `getServerUser(req)` — optional; no auth required to view course
3. If user is authenticated and a store exists, fetches all `CourseProgress` rows for the
   user for all block IDs in the store
4. Returns merged: `{ ...course, store, progress }`

### Completing a lesson
1. Client PATCHes `PATCH /api/course/progress` with `{ blockId, status, mastery }`
2. Route upserts `CourseProgress` on `{ userId, blockId }` unique key
3. Sets `status` (default `"done"`) and `mastery` (0–100 integer, default 100)
4. Returns the upserted `CourseProgress` record

### Progress query (by page)
1. Client fetches `GET /api/course/progress?pageId=...`
2. Route looks up the `Store` for that `pageId`, collects all block IDs
3. Returns all `CourseProgress` rows for the user matching those block IDs

---

## Key API Routes

| Method | Route | Action |
|---|---|---|
| POST | /api/course | Create Course metadata (Page must exist) |
| GET | /api/course/[pageId] | Full course: metadata + store content + user progress |
| PATCH | /api/course/[pageId] | Update Course metadata (owner only) |
| GET | /api/course/progress?pageId= | Progress rows for all blocks in a course |
| PATCH | /api/course/progress | Upsert progress for one block |

---

## Block Locking and Gating

`StoreBlock` has two independent gating mechanisms:

**1. `blockStatus` field** — stored on the block itself, not per-user:
- `"locked"` — default value; block is not accessible
- Other values (e.g. `"unlocked"`, `"done"`) — TODO: confirm the full set of valid values
- This is a **global** status on the block, not per-user. If a block is `"locked"` in the DB,
  it is locked for all users.

TODO: Determine how blocks get unlocked. Is `blockStatus` updated by the course owner
(i.e. manual unlock by the creator), or is it updated automatically based on user progress?
The progress API only writes to `CourseProgress`, not to `StoreBlock.blockStatus`.

**2. `access` field** — `"free"` or `"paid"`:
- Controls whether content is gated behind payment
- Applies to both course lessons and store products
- `"paid"` blocks require purchase (TODO: confirm whether payment is implemented)

**3. `StoreSection.prereqIds`** — section-level prerequisites:
- An array of section IDs that must be "completed" before this section unlocks
- Stored as a `String[]` with no DB-level FK constraint
- TODO: Confirm how prerequisite completion is evaluated — is it all blocks in the
  prereq section reaching `status: "done"`, or a mastery threshold, or something else?
  The API routes do not contain explicit prerequisite evaluation logic.

---

## CourseProgress Schema

```
CourseProgress {
  id        String   @id
  userId    String
  blockId   String
  status    String   @default("unlocked")
  mastery   Int      @default(0)     // 0–100
  updatedAt DateTime @updatedAt
  @@unique([userId, blockId])
}
```

Progress is upserted, not appended. Each user has at most one row per block.
`mastery` is an integer 0–100. There is no history of progress changes.

The `PATCH /api/course/progress` route defaults `status` to `"done"` and `mastery` to `100`
if not provided. The full set of valid `status` values is not constrained by the schema
(it is a plain `String`).

TODO: Confirm what `status: "unlocked"` means in `CourseProgress`. A row with
`status: "unlocked"` and `mastery: 0` is the default created state — does this mean
the block has been opened but not completed?

---

## Database Models Used
- `Course` — metadata: pageId, courseType, dominantAspect, aspectWeights (JSON), aspectBenefits (JSON), courseTags (String[])
- `StoreBlock` — lesson content: title, description, mediaType, mediaUrl, actionType, blockStatus, mastery, lessonType, lessonTags, access, linkedPostId
- `StoreSection` — lesson grouping: prereqIds (String[]), order, type
- `CourseProgress` — per-user per-block: status, mastery (0–100)

Note: `StoreBlock` has its own `mastery` field (an `Int` at the block level) distinct from
`CourseProgress.mastery` (per-user). The block-level `mastery` appears to be a target or
default mastery level. TODO: Confirm the distinction and whether block-level mastery is used
in any rendering logic.

---

## Mobile Layout — LearningPageView

`app/store/[id]/LearningPageView.tsx` renders all course pages. On desktop it uses a fixed two-column split (chapters sidebar left, content area right). On mobile it collapses to a single-column flow controlled by a `mobileShowLesson` boolean state (default `false`).

| State | Mobile: chapters panel | Mobile: content panel |
|---|---|---|
| `false` (default) | `block` (full width) | `hidden` |
| `true` (lesson/section open) | `hidden` | `block` (full width) |

**Key behaviours:**
- Clicking a chapter (section) sets `mobileShowLesson = true` → content area slides into view showing the block list
- Clicking a lesson (block) also sets `mobileShowLesson = true` → content area shows the lesson detail
- "← Back to Chapters" button at the top of the content area (`className="md:hidden"`) sets `mobileShowLesson = false` and clears `activeBlockId`
- The existing "← Back" button inside `BlockDetailPanel` only clears `activeBlockId` (goes from lesson detail back to block list within the content area); it does **not** set `mobileShowLesson = false`
- Desktop layout (`md:` breakpoint and above) is entirely unaffected — the Tailwind `md:block` class overrides any `hidden` or `block` applied for mobile

**Pattern rule:** Never remove the `md:block` class from either panel. It is what keeps the desktop layout intact when `mobileShowLesson` is toggled.

## Risks & Fragile Areas
- A course page requires BOTH a `Course` record AND a `Store` record linked to the same `pageId`.
  If one is created without the other, `GET /api/course/[pageId]` returns a partial response:
  it returns `null` for `course` if the Course record is missing, or an empty section list
  if no Store is linked.
- The prerequisite system (`prereqIds`) has no server-side enforcement in the observed API
  routes. Prerequisites appear to be enforced by client-side rendering only. A client that
  bypasses the UI can complete any block regardless of prerequisites.
- `CourseProgress` rows cascade-delete when the associated `StoreBlock` is deleted. Owners
  who reorganize a course by deleting and recreating blocks permanently erase all learner
  progress for those blocks.
- The `hooks/useSectionTimeTracker.tsx` hook likely tracks time spent on sections for
  analytics or mastery purposes. TODO: Confirm whether its output is written to CourseProgress
  or to the `Event` analytics table.

## Backlinks
- [[START_HERE.md]] — StoreBlock dual-purpose note
- [[database.md]] — Course, StoreBlock, CourseProgress models
- [[store.md]] — shared infrastructure (Store, StoreSection, StoreBlock)
- [[pages.md]] — Page with pageType "learning"
- [[flows/add-new-page-type.md]] — how Course is wired as a Page sub-model
