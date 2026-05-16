---
module: user
type: api + component
source: app/api/user/, app/api/users/, app/(User)/, components/UserDirectory_and_Profile.tsx, components/UserSearch.tsx, components/UserMenu.tsx, components/ProfileMenu.tsx
depends_on: [database, auth, media, notifications]
used_by: [auth, social, chat, store, navigation-tabs]
stability: stable
status: active
---

# Module: User

## Purpose
Manages user accounts, profiles, and identity from registration through deletion. Owns the public-facing profile (avatar, bio, skills) and the private extended profile (health metrics, drives, goals JSON). Also handles account verification, language preferences, and country selection.

## Responsibilities
- User registration (email/password and guest/temp accounts)
- Profile read and update (basic info, avatar, bio, extended JSON fields)
- Email verification and re-sending verification emails
- Username availability check
- Language and country preference storage
- Account deletion scheduling and cancellation
- User search and directory
- Avatar upload via Cloudinary

## Inputs & Outputs

| Direction | Value |
|---|---|
| In | Registration: email, password (or phone for SMS-based) |
| In | Profile updates: name, bio, title, health metrics, drives, goals JSON |
| In | Avatar image (uploaded to Cloudinary, URL saved) |
| In | Language preference, selected country |
| Out | `User` record (id, email, name, avatarUrl, verified) |
| Out | `Profile` record (extended: health, drives, goals, aiPlan, weekSchedule) |
| Out | Search results (user directory) |
| Out | Account status (active, pending deletion, deleted) |

## Dependencies
- **auth** — registration creates a session; profile updates require authentication
- **database** — User, Profile models
- **media** — avatar upload goes to Cloudinary; URL stored on User
- **notifications** — verification emails sent via `sendEmail()`; OTP SMS for phone auth

## Reverse Dependencies (what breaks if this changes)
- `User.email` is the primary login identifier. Changing the uniqueness constraint or case-sensitivity logic breaks login.
- `User.verified` gates certain actions across the platform. If the verification check is removed, unverified users gain full access.
- `User.deletionScheduledAt` drives the soft-delete workflow. If an account is force-deleted without checking this field, users in the grace period lose accounts unexpectedly.
- `Profile` stores several JSON fields (`drives`, `goals`, `health`, `aiPlan`, `weekSchedule`, `fundsProfile`, `environmentProfile`). These are not typed at the DB level — any consumer that assumes a specific JSON shape will break silently if the shape changes.
- `User.selectedCountry` and `User.preferredLanguage` are used by the geo and i18n systems respectively. Clearing these causes fallback behavior in both systems.

## Runtime Flow

### Registration
1. Client POSTs to `POST /api/user/register` with email + password
2. API hashes password, creates `User` (verified: false)
3. Creates linked `Profile` record
4. Sends verification email via `sendEmail()`
5. Creates session token and sets cookie
6. Returns user object

### Email verification
1. User clicks link in email → `GET /api/user/verify?token=...`
2. API looks up `VerificationToken`, checks expiry
3. Sets `User.verified = true`, `User.emailVerified = now()`
4. Deletes token
5. Redirects to app

### Profile update
1. Client PATCHes `PATCH /api/user/profile` with changed fields
2. API validates session, updates `Profile` fields
3. JSON fields (`drives`, `goals`, etc.) are merged or replaced depending on the field
4. Returns updated profile

### Avatar upload
1. Client calls `hooks/useCloudinaryUpload.ts` to get a signed upload URL from `POST /api/cloudinary/sign`
2. Client uploads image directly to Cloudinary
3. Client POSTs Cloudinary URL to `POST /api/user/avatar`
4. API saves URL to `User.avatarUrl`

### Account deletion
1. User initiates deletion → `POST /api/user/delete`
2. API sets `User.deletionScheduledAt = now() + grace_period` (TODO: confirm grace period length)
3. User can cancel via `POST /api/user/cancel-delete` before grace period expires
4. TODO: Confirm whether a background job actually deletes the account after the grace period

### Guest account
1. Client POSTs to `POST /api/user/guest`
2. API creates a `User` with `status: "guest"` and no email, issues a session cookie
3. Guest can browse stores, add to cart, place orders, follow initiatives, and save products
4. On sign-in or email verification, `mergeGuestToReal(guestId, realId)` (in `lib/mergeGuest.ts`) atomically transfers all guest data to the real account — see [[auth.md]] for the full merge flow
5. Manual recovery: `POST /api/user/claim-guest` with `{ guestId }` and a real-user session

## Key API Routes

| Method | Route | Action |
|---|---|---|
| POST | /api/user/register | Create account (embeds guestId in magic link meta if guest session present) |
| POST | /api/user/guest | Create guest session |
| GET | /api/user/me | Current user (id, email, name, avatarUrl, **status**) |
| POST | /api/user/claim-guest | Merge a guest account into the current real user; body: `{ guestId }` |
| GET | /api/user/profile | Full profile |
| PATCH | /api/user/profile | Update profile |
| POST | /api/user/avatar | Save avatar URL |
| GET | /api/user/verify | Email verification |
| POST | /api/user/resend-verification | Resend verification email |
| POST | /api/user/check-name | Check username availability |
| PATCH | /api/user/country | Update selected country |
| POST | /api/user/language | Update language preference |
| GET | /api/user/status | Account status |
| POST | /api/user/delete | Schedule deletion |
| POST | /api/user/cancel-delete | Cancel deletion |
| GET | /api/users | User directory search |
| GET | /api/users/[id] | Public user profile |

## Key Components

| Component | Role |
|---|---|
| `components/UserDirectory_and_Profile.tsx` | Public user profile and directory view |
| `components/UserSearch.tsx` | Search users by name/email |
| `components/UserMenu.tsx` | Top-bar user dropdown menu |
| `components/ProfileMenu.tsx` | Profile settings access |

## Database Models Used
- `User` — core account: email, phone, passwordHash, verified, emailVerified, avatarUrl, status, preferredLanguage, selectedCountry, shortBio, title, name, deletionScheduledAt
- `Profile` — extended: heightCm, weightKg, stepsToday, sleepHours, waterLitres, displayName, bio, drives, goals (JSON), health (JSON), aiPlan, weekSchedule, fundsProfile, environmentProfile
- `VerificationToken` — email verification
- `AuditLog` — sensitive account actions (deletion, verification)

## Risks & Fragile Areas
- `Profile` JSON fields have no schema enforcement. AI-written fields (`aiPlan`, `weekSchedule`) may produce any shape. Any UI that reads these fields must be defensive.
- Guest accounts (`User` without email) can accumulate indefinitely if there is no TTL or cleanup job.
- The grace period for `deletionScheduledAt` behavior is unclear in source. TODO: Confirm length of grace period and the mechanism that finalizes deletion.
- `User.tokenVersion` exists on the model. If it is used to invalidate sessions on password change, failing to increment it on a security-sensitive update (e.g. email change) leaves stale sessions valid.
- Two registration endpoints exist: `POST /api/user/register` and `POST /api/register`. Confirm they are not divergent implementations.

## Backlinks
- [[auth.md]] — registration triggers auth session creation
- [[database.md]] — User, Profile model definitions
- [[media.md]] — avatar upload via Cloudinary
- [[notifications.md]] — verification email, OTP SMS
- [[social.md]] — user lookup for friend display
