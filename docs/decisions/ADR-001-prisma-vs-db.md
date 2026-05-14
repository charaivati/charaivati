---
id: ADR-001
title: Two Prisma client exports — prisma and db
status: accepted
date: 2026-05-14
---

# ADR-001: Two Prisma Client Exports (`prisma` and `db`)

## Status
Accepted — do not consolidate without a full codebase migration.

## Context

The codebase has two files that each export a Prisma singleton:

| Export | File | Pattern |
|---|---|---|
| `db` | `lib/db.ts` | `globalThis.prisma ?? new PrismaClient()` |
| `prisma` | `lib/prisma.ts` | `globalForPrisma.prisma \|\| new PrismaClient()` |

Both use the same `globalThis` HMR-survival pattern. Both log only `"error"` level.
At runtime they resolve to the same `PrismaClient` instance — there is no functional
difference between them.

`lib/db.ts` was written first and is documented as canonical in CLAUDE.md.
`lib/prisma.ts` was introduced later (likely when integrating sub-modules or
third-party patterns) and became the dominant import in the page-facing API routes.

## The Split That Actually Exists in Code

Neither export is used exclusively. The split follows file origin, not a deliberate rule:

**Routes that use `prisma` (from `lib/prisma.ts`):**
- `app/api/store/` — store, sections, blocks, filters, banners, cart, orders
- `app/api/course/` — course creation and progress
- `app/api/health-business/` — health business creation and advice
- `app/api/helping-initiative/` — initiative CRUD
- `app/api/user/profile/` — profile read/write
- `lib/serverAuth.ts` — the recommended `getServerUser` wrapper

**Routes that use `db` (from `lib/db.ts`):**
- `lib/session.ts` — `getCurrentUser`
- `app/api/friends/` — friend requests and relationships
- `app/api/chat/` — conversations and messages
- `app/api/admin/` — tab and question management
- `app/api/users/` — user directory
- `app/api/circles/` — friend circles
- `app/api/help-links/` — help resources

## Decision

**Do not consolidate.** The cost of a global search-and-replace migration across 150+
routes with no test suite is higher than the confusion of having two exports.

**Rule for new code: match the import already used in the directory you are editing.**

- Adding a route to `app/api/store/`? Use `prisma`.
- Adding a route to `app/api/friends/`? Use `db`.
- Starting a new top-level directory with no established pattern? Use `db` — it is the
  documented canonical export.

## What NOT to Do

- Do not create a third Prisma client instance anywhere.
- Do not mix `db` and `prisma` within a single file.
- Do not run a "cleanup" pass to unify all imports unless every changed route is
  manually verified — the risk of touching untested code paths outweighs the benefit
  of consistency.

## Consequences

- New contributors will see two exports and may be confused. This ADR is the explanation.
- The CLAUDE.md note that `db` is "canonical" is technically correct as original intent
  but inaccurate as a description of current usage. Both are equally valid.
- If a future test suite is introduced, this split becomes irrelevant — both can be
  mocked at the `@prisma/client` level regardless of which export is used.

## Backlinks
- [[database.md]] — db vs prisma export summary
- [[add-new-api-route.md]] — "match the pattern in the directory" rule
- [[START_HERE.md]] — forbidden: do not create a third Prisma instance
