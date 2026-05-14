---
module: database
type: library
source: lib/db.ts, lib/prisma.ts, prisma/schema.prisma
depends_on: []
used_by: [auth, user, store, social, chat, goals-ai, business, timeline, pages, navigation-tabs, health, helping-initiative, feature-flags, transport]
stability: stable
status: active
---

# Module: Database

## Purpose
Provides a single shared Prisma client instance to all server-side code, and defines the full data schema for the platform. Every model, relation, and constraint lives in `prisma/schema.prisma`.

## Responsibilities
- Export a singleton `PrismaClient` (prevents connection pool exhaustion in dev with HMR)
- Define all database models and their relations
- Own all migrations under `prisma/migrations/`
- Provide the source of truth for data shapes used throughout `lib/` and `app/api/`

## Inputs & Outputs

| Direction | Value |
|---|---|
| In | Schema changes to `prisma/schema.prisma` |
| Out | `db` export (canonical client) from `lib/db.ts` |
| Out | `prisma` export (legacy alias) from `lib/prisma.ts` |
| Out | Generated `@prisma/client` types used across the codebase |

## Dependencies
- **PostgreSQL** — external; connection via `DATABASE_URL` (pooled) and `DIRECT_URL` (direct, for migrations)
- **prisma generate** — must be run after any schema change; runs automatically on `postinstall`

## Reverse Dependencies (what breaks if this changes)
- Adding a field without a default breaks existing rows unless a migration supplies one.
- Renaming a model or field invalidates all TypeScript references and query calls across the codebase.
- Changing enum values (e.g. `Order.status`, `AiGoal.archetype`, `Post.visibility`) breaks existing DB rows not covered by a migration.
- Dropping or renaming a relation cascades to all API routes that `include` that relation.
- Changing `prisma/schema.prisma` without running `npx prisma generate` causes type errors at compile time and runtime mismatches.

## Runtime Flow
1. On first import, `lib/db.ts` checks `globalThis.prisma`
2. If not set, creates `new PrismaClient({ log: ['error'] })`
3. In dev, stores instance on `globalThis` to survive HMR reloads
4. In production, each serverless function invocation gets a fresh instance (no global)
5. All queries are run via the `db` export: `db.user.findUnique(...)`, etc.

## Key Exports

| Export | File | Notes |
|---|---|---|
| `db` | lib/db.ts | **Canonical** — use this everywhere |
| `prisma` | lib/prisma.ts | Legacy alias; same instance; avoid in new code |

## Database Models (grouped by domain)

### Identity
- **User** — core account: email, phone, passwordHash, verified, avatarUrl, status, preferredLanguage, selectedCountry, deletionScheduledAt
- **Profile** — extended user data: health metrics, drives, goals JSON, aiPlan, fundsProfile, environmentProfile
- **VerificationToken** — email verification
- **MagicLink** — passwordless login tokens
- **Otp** — SMS one-time passwords

### Social
- **Friendship** — mutual connection; `userAId < userBId` (canonical ordering enforced in app code)
- **FriendRequest** — pending/accepted/rejected invitations
- **FriendCircle** — named groups of friends
- **FriendCircleMember** — M2M: circle ↔ user
- **Post** — user content with visibility: `public | friends | private`

### Chat
- **ChatConversation** — DM thread; `userAId < userBId` canonical ordering
- **ChatMessage** — encrypted message; stores ciphertext + IV only
- **ChatMessageBackup** — server-side backup of decrypted content (opt-in)
- **UserPublicKey** — ECDH P-256 public keys

### Content (Pages)
- **Page** — polymorphic container; `pageType`: `store | course | health-business | helping-initiative`
- **Store**, **Course**, **HealthBusiness**, **HelpingInitiative** — sub-models linked 1:1 to Page

### E-commerce
- **StoreSection**, **StoreSubsection**, **StoreBlock**, **SectionTile**
- **StoreFilter**, **StoreSectionFilter** (M2M)
- **StoreBanner**, **StoreImage**
- **CartItem**, **Order**, **WishlistItem**, **Address**, **PinnedStore**

### Learning
- **CourseProgress** — per-user per-block mastery state
- **SavedTagSet** — user-saved tag collections

### Goals & Projects
- **AiGoal** — smart goal with archetype: `LEARN | BUILD | EXECUTE | CONNECT`
- **AiGoalAnswer** — questionnaire answers per goal
- **ProjectTimeline** — project container linked to a goal
- **TimelinePhase** — phase within a timeline
- **PhaseMilestone** — checkpoint within a phase

### Business Tools
- **BusinessIdea** — idea evaluation record
- **IdeaQuestion** — question bank for idea scoring
- **IdeaResponse** — user answers
- **BusinessPlan** — generated plan document with retrieval token

### Health
- **HealthBusiness** — expert practitioner page
- **ExpertSubscription** — user → expert subscription with consent
- **ExpertAdviceLog** — consultation records

### Governance & Navigation
- **Level** — one of 6 scale layers (Self, Society, State, Nation, Earth, Universe)
- **Tab** — canonical navigation entry per level
- **TabTranslation** — multilingual tab content
- **UserTab** — sparse per-user override of a Tab
- **Proposal**, **Vote**, **Review** — community tab proposal workflow

### Infrastructure
- **FeatureFlag** — key/enabled toggles
- **AuditLog** — compliance-grade action log
- **Event** — product analytics events
- **Embedding** — semantic search vectors
- **Language** — supported locales
- **Country**, **AdminLevel**, **Region**, **LocalArea**, **Asset**, **Representative** — geo hierarchy
- **Vehicle** — real-time transport location

## Risks & Fragile Areas
- Two exports (`db` and `prisma`) exist for the same instance. New code must use `db`; mixing them is not dangerous but is confusing.
- The `globalThis` singleton pattern breaks if two separate Node processes import the module (e.g. test runner + dev server). Use a single process per environment.
- `prisma/schema.prisma` has 50+ models — a full `npx prisma migrate dev` on a large dataset can be slow. Use `--create-only` to review migrations before applying.
- JSON fields (`executionPlan`, `drives`, `goals`, `health`) are untyped at the DB level. Shape changes require application-level migration logic, not Prisma migrations.
- Cascade deletes on `User` are set on several relations. Deleting a user permanently removes associated stores, posts, goals, and chat messages. This is intentional but irreversible.

## Backlinks
- [[START_HERE.md]] — database model overview
- [[auth.md]] — User, MagicLink, Otp models
- [[store.md]] — e-commerce models
- [[chat.md]] — ChatConversation, ChatMessage, UserPublicKey
- [[goals-ai.md]] — AiGoal, ProjectTimeline
- [[navigation-tabs.md]] — Tab, Level, UserTab
- [[pages.md]] — Page polymorphic model
