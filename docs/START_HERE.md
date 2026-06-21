# START HERE — Charaivati AI Onboarding

This document is the single entry point for any AI agent or LLM working in this repository.
Read it fully before touching any file.

---

> **WARNING — API AUTH IS NOT HANDLED BY MIDDLEWARE**
>
> `middleware.ts` only protects page routes (`/self`, `/nation`, `/earth`, `/society`).
> It does **not** run on any `/api/*` route.
>
> Every API route must enforce auth manually:
> ```ts
> const token = getTokenFromRequest(req);
> const payload = await verifySessionToken(token);
> if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
> ```
> Never assume edge middleware handles API authentication. An API route with no
> manual auth check is completely unprotected.

---

## 1. What This System Is

Charaivati is a Next.js 15 full-stack web platform for personal development, community action, and economic participation — scoped initially to Assam, India. It wraps into a Capacitor native app (Android/iOS) pointing at `https://charaivati.com/app/home`.

The platform is organized around a **6-layer model** of scale:

```
Self → Society → State → Nation → Earth → Universe
```

Each layer has its own page (`/self`, `/society`, etc.) with data-driven tab navigation. Users work through goals, stores, courses, and community initiatives at each layer.

---

## 2. Tech Stack

| Concern | Technology |
|---|---|
| Framework | Next.js 15, App Router, React 19, TypeScript |
| Database | PostgreSQL via Prisma 6 ORM |
| Auth | JWT (jose), HTTP-only cookie |
| Styling | Tailwind CSS v4, inline styles in mobile shell |
| Toasts | sonner |
| Animation | framer-motion |
| Caching | Upstash Redis + ioredis |
| Images/Video | Cloudinary |
| File Storage | AWS S3 |
| Email | SendGrid |
| SMS | Twilio (abstracted behind `lib/sms/`) |
| Maps | Leaflet |
| 3D | Three.js + @react-three/fiber |
| Mobile | Capacitor 8 |
| Build | Vercel (custom script: `npm run vercel-build`) |

ESLint and TypeScript errors are **silenced during builds** (`ignoreDuringBuilds`, `ignoreBuildErrors` both true in `next.config.mjs`). Run `npm run lint` explicitly to catch issues.

---

## 3. Repository Layout

```
app/              Next.js App Router — pages, layouts, API routes
  (with-nav)/     Protected pages: /self /society /nation /earth
  (auth)/         Login, register, onboarding
  (public)/       Privacy, terms, security (no auth required)
  (business)/     Idea evaluator, plan builder
  (User)/         User profiles, avatar, edit
  (locality)/     Country selection, local area
  (state)/        State-level dashboard
  (earth)/        Environmental/global view
  (universe)/     Universe-level view
  app/            Capacitor mobile shell (bottom nav layout)
  earn/           Initiative Hub — owner pages at /earn/initiative/[pageId]
  api/            All REST endpoints (~150+)

components/       Shared UI components (no pages here)
lib/              Server utilities, shared logic, singleton clients
hooks/            Client-side React hooks
prisma/           schema.prisma + migrations
public/           Static assets
scripts/          One-off data scripts (ts-node)
docs/             This documentation tree
agents/           AI agent definitions (future)
```

---

## 4. Key Modules and What They Own

### `lib/db.ts` and `lib/prisma.ts`
Both export the **same** Prisma singleton. `db` (from `lib/db.ts`) is the canonical name used in API routes. `prisma` (from `lib/prisma.ts`) is a legacy alias. Do not create a third instance.

### `lib/session.ts`
Owns the entire auth session lifecycle: `createSessionToken`, `verifySessionToken`, `getTokenFromRequest`, `setSessionCookie`, `clearSessionCookie`, `getCurrentUser`. All API routes that need the current user call `getTokenFromRequest(req)` then `verifySessionToken(token)` from here.

Cookie name:
- Dev: `charaivati.session`
- Prod: `__Host-session` (requires HTTPS, no subdomain leakage)

### `middleware.ts`
Protects `/self`, `/nation`, `/earth`, `/society` at the edge. Redirects unauthenticated requests to `/login` and clears the stale cookie. Does not run on `_next/*`, `favicon.ico`, or `api/*`.

### `lib/featureFlags.ts`
Feature flag system backed by the `FeatureFlag` DB model. Currently all flags return `true` (effectively disabled). Check this before adding new gated features.

### `lib/rateLimit.ts`
Rate limiting for API routes. Apply to any endpoint that could be abused (auth, OTP, AI calls).

### `lib/csrf.ts`
CSRF token generation and validation. Must be used on any state-mutating API endpoint called from the browser.

### `lib/chat-crypto.ts`
ECDH P-256 key exchange + AES-GCM message encryption for direct messages. Ciphertext is stored in `ChatMessage.ciphertext` (base64). The server never sees plaintext. Do not modify this module without understanding the E2E model.

### `lib/writeQueue.ts`
Batched/deferred write queue for non-critical DB writes. Used to avoid blocking the request cycle on analytics or soft-state updates.

### `next.config.mjs`
Owns all HTTP security headers including CSP, HSTS, `X-Frame-Options: DENY`, and `Permissions-Policy`. **Any new external domain** (CDN, font, API) must be added here or it will be blocked in production.

### `app/app/layout.tsx`
The Capacitor mobile shell layout. Renders sticky top bar + 4-tab bottom nav. This is a client component. The four tabs are: Home (`/app/home`), Initiatives (`/app/initiatives`), Explore (`/app/saved`), Orders (`/app/orders`). The Account tab was removed — the M avatar in the top bar opens the account dropdown instead.

### `components/brand/Wordmark.tsx`
The single canonical "Charaivati" logo wordmark (bold, `tracking-tight`, white→gray-400 gradient text; size variants `sm`/`md`/`lg`/`xl`, optional `href` to wrap it in a Link). The logo appears in two layout shells — `app/(with-nav)/WithNavClient.tsx` (desktop header) and `app/app/layout.tsx` (mobile top bar) — and both MUST render it through this component so the font stays identical. Also used on the landing (`app/page.tsx`), login, and `/verified` pages. Do not hand-roll logo text/styling anywhere else.

---

## 5. Database Model Relationships (Critical)

`Page` is a **polymorphic container**. One `Page` row backs a Store, Course, HealthBusiness, or HelpingInitiative. The `pageType` field determines which sub-model exists. `Page` also has `collaborationsIn` and `collaborationsOut` relations to the `Collaboration` model — Page-to-Page and Page-to-User partnership links.

`Collaboration` has two member types: **Page-to-page** (`receiverPageId` set — delivery partners, suppliers, external collaborators) and **Page-to-user** (`receiverUserId` set — employees, personal team members added via friend-invite). `role` is the collaboration kind (`delivery_partner | supplier | employee | marketing | other`); `status` is `pending | accepted | rejected | cancelled`. Unique on `[requesterId, receiverPageId, role]` and `[requesterId, receiverUserId, role]`. Exactly one of `receiverPageId`/`receiverUserId` must be set — enforced at API level. All FK sides cascade-delete. `Page` has `collaborationsIn`/`collaborationsOut`; `User` has `receivedCollaborations`.

`StoreBlock` is **dual-purpose**: it is a product in a store and a lesson in a course. `actionType` determines behavior; `access: free | paid` controls gating. Two additive fields were added for the Menu Parse feature: `imageProvider String?` (`"unsplash"` / `"pexels"` / `"pixabay"` / `"picsum"` / `"user"`) and `imageQuality Int @default(0)` (0–3 scale). The cron upgrade job (`/api/cron/upgrade-images`) uses these to progressively improve low-quality images.

`Tab` rows are canonical navigation entries. `UserTab` stores sparse per-user overrides (visibility, position, custom title). Do not hardcode tab names — always resolve from DB.

`Friendship` enforces **canonical ordering**: `userAId < userBId` lexicographically. Application code, not DB constraints, enforces this. Break the ordering and queries will fail silently.

`AiGoal` has four archetypes: `LEARN`, `BUILD`, `EXECUTE`, `CONNECT`. The execution plan is stored as JSON (`executionPlan`). Do not change the archetype enum values without migrating existing rows.

---

## 6. Critical Flows

### Auth Flow
1. User POSTs credentials to `/api/auth/login`
2. Server verifies password (bcrypt), creates JWT via `createSessionToken()`
3. JWT written to HTTP-only cookie via `setSessionCookie()`
4. Subsequent requests carry cookie automatically
5. `middleware.ts` verifies cookie on protected routes
6. API routes call `getTokenFromRequest(req)` → `verifySessionToken()` → `db.user.findUnique()`

Alternative entry points: magic link (`/api/auth/send-magic-link`) and SMS OTP (`/api/auth/otp/`). Both ultimately set the same session cookie.

**Registration flow** — `POST /api/user/register` sends a verification email and returns 200 without setting a session. The login page enters `verify-pending` state (no redirect). User clicks email link → `GET /api/user/magic` → `/verified` page → "Sign in to continue →" → `/login` (pre-filled) → password → session cookie set → redirect to original destination.

### Friend invite flow (Feature A)
1. Authenticated user POSTs `{ email }` to `POST /api/invite` (max 10/24h)
2. Server **always** returns the same generic success message — no enumeration
3. If email is unregistered: creates shell user (`status: "invited"`), creates `Invite` row, sends join email with `https://charaivati.com/claim/{rawToken}` (token in path, never query string; `Referrer-Policy: no-referrer` set)
4. If email is already registered: sends silent security notice to that address, logs attempt — no invite created
5. Recipient clicks claim link → `app/claim/[token]/page.tsx` (server component validates token)
6. Invalid/expired (or attempts ≥ 5): shows neutral error page (no reason disclosed)
7. Valid: renders "Join" page → user clicks → Server Action `claimInvite()` → atomic transaction: `Invite.status → claimed`, shell `User.status → lite`, `contactVerified → true`, `emailVerified → true` → session issued → redirect `/self`

### Admin direct-create (Feature B)
1. Admin (email in `ADMIN_EMAILS` env var) POSTs `{ email, tempPassword }` to `POST /api/admin/users`
2. Server re-checks admin gate server-side — client flags not trusted
3. Creates user: `status: "lite"`, `mustChangePassword: true`, `contactVerified: false`, `createdByAdminId: <admin.id>`; hashes temp password
4. Every creation logged server-side (adminId + targetEmail + timestamp)
5. On user's first login: `{ mustChangePassword: true, redirect: "/change-password" }` is returned
6. `/change-password` → `POST /api/user/change-password` → clears `mustChangePassword`, user proceeds normally

### User status values
| Status | Meaning |
|---|---|
| `"guest"` | Anonymous user with no email; created automatically for anonymous browsing |
| `"invited"` | Shell user created when an invite email is sent; no password |
| `"lite"` | Account after invite claim or admin-create — limited access until more verification |
| `"active"` | Full account — email verified via standard registration flow |

### `contactVerified` vs `emailVerified`
- `emailVerified`: set when the user clicks any emailed link (verify-email, magic link, invite claim)
- `contactVerified`: set only when inbox ownership is proven via a **clicked emailed link** (invite claim, magic link). NOT set for admin-created accounts. Used to gate Earn-layer money actions via `lib/requireVerifiedContact.ts`.

### Guest-to-real merge (fires automatically on login and email verification)
1. Guest browses as a `User` with `status: "guest"` and no email
2. On **register**, the guest session cookie is read and `guestId` is embedded in `MagicLink.meta`
3. On **email verification** click (`GET /api/user/magic`): `mergeGuestToReal(guestId, realId)` runs — prefers `meta.guestId`, falls back to live cookie; then redirects to `/verified` (not `/login`)
4. On **login** (`POST /api/user/login`): same merge fires after session token is created
5. Merge is a single Prisma transaction: cart (quantities summed), wishlist, pinned stores, page follows (initiatives), addresses, orders, owned Pages, owned Stores → guest user deleted
6. Calling merge twice is safe — duplicates are skipped and a deleted guest is a no-op
7. Manual path: `POST /api/user/claim-guest` with `{ guestId }` for retroactive recovery
8. Guest UI: store nav and app shell detect `user.status === "guest"` from `/api/user/me` and show "Sign in / Sign up" instead of account links

### Main User Journey (Web)
1. Any page request without a `"lang"` cookie and no valid session → **middleware language gate** redirects to `/?redirect=<path>`
2. Land on `/` (`app/page.tsx` — middleware skips this route):
   - Authenticated → redirect to `/self`
   - Unauthenticated + `"lang"` key in localStorage → redirect to `/login` (forwarding `?redirect=` if middleware passed one)
   - Unauthenticated + no saved language → show language picker; on selection `setLanguage()` writes localStorage + cookie then redirects to `/login?redirect=<path>`
3. After login → `/self` (or the preserved `?redirect=` destination)
4. `/self` is the personal dashboard — goals, health, hobbies, analytics
5. Layer nav (top) switches between Self / Society / Nation / Earth / Universe
6. Each layer renders tabs from the `Tab` table (filtered by `levelId`)
7. Tab content is dynamic — `tabToComponentMap.tsx` maps tab slugs to React components

### Main User Journey (Mobile / Capacitor)
1. App opens → loads `https://charaivati.com/app/home`
2. Layout is `app/app/layout.tsx` — bottom nav drives navigation
3. Bottom tabs: Home, Initiatives, Explore, Orders (`/app/orders`)
4. Auth state fetched from `/api/user/me` on layout mount

### Initiative Hub (owner management page)
1. Owner clicks "Open →" on an initiative card in `/app/initiatives` (mobile) or in the desktop EarningTab summary list
2. Navigates to `/earn/initiative/[pageId]` — a server component page
3. Server reads session cookie via `cookies()` + `verifySessionToken()` (not middleware, not `getServerUser`)
4. Fetches Page (with course, helpingInitiative, collaborationsIn/Out), linked Store, and all pages owned by the user
5. Renders page title + type badge + `InitiativeTabs` client component
6. Tabs: **Overview** (links to existing manage/evaluate flows), **Store** (link or set-up CTA), **Partners** (`PartnersTab`)

### Collaboration (Partners tab)
1. `PartnersTab` mounts → 3 parallel fetches: `in+accepted`, `out+accepted`, `in+pending`
2. Active partners (merged in+out, deduplicated) shown with Revoke button (DELETE)
3. Incoming pending requests shown with Accept/Reject buttons (PATCH)
4. Invite form: search stores by name → `GET /api/store/search?q=` (debounced 300ms) → pick from dropdown → select role → send (POST)
5. `POST /api/collaboration` resolves Store IDs and slugs to their linked Page automatically
6. PATCH response must include `requester`/`receiverPage` page fields — frontend reads `.title` for optimistic state update

### Team tab — two invite paths
- **From Partners**: promotes an accepted partner-scope page-to-page Collaboration to `scope="team"` via `PATCH /api/initiative/[pageId]/team/[collaborationId]`
- **Invite Friend**: creates a new `scope="team"` Collaboration with `receiverUserId` (page-to-user) via `POST /api/initiative/[pageId]/team/invite-user { userId, teamRole, customRole? }` — requires the target to be an accepted friend of the page owner. `status="accepted"` on creation (no request flow). Removing calls `DELETE /api/initiative/[pageId]/team/[collaborationId]`.
- Team member cards render both types: `receiverUserId` set → show `receiverUser.name`/`avatarUrl`; otherwise show `receiverPage.title`/`avatarUrl`.

### Workflow Step Types (`activityType`)
Every `WorkflowStep` has an `activityType` field (`"normal"` | `"delivery"`, default `"normal"`). This controls what happens when the step is **confirmed**:

- **`"normal"`** — owner or the step's assigned team member confirms. Calls `advanceToNextStep` which activates the next OSP. Does **not** touch `deliveryStatus`. Uses `assignNormalStep` (simple first-assignee notification, no sub-order). The active `OrderStepProgress` row **is** the confirmable task record (TASK-SURFACE-1 — see `### Process Tasks surface` below); no extra record is created.
- **`"delivery"`** — **owner only** confirms. This is the dispatch point. Sets `Order.deliveryStatus = "out_for_delivery"` and calls `assignNextPartner` (full cycling engine: creates sub-order, costs delivery, notifies partner).

**Backfill rule:** the last step (highest `sequence`) per initiative is auto-set to `"delivery"`; all others default to `"normal"`.

**Key constraint:** `createSubOrder` is called **only** inside `assignNextPartner`, which is called **only** for delivery-step confirmation. Normal step activation uses `assignNormalStep` — no sub-order is created.

**Quote-accept mirrors the confirm route's `activityType` branch (DISPATCH-FIX-1):** quotes apply to `third_party` steps of *either* `activityType`, not just delivery. `POST /api/order/[id]/quote/[quoteId]/accept` reads the accepted quote's step `activityType` (same `$queryRaw` pattern as `confirm/route.ts:32-35`) and only writes `Order.assignedToId` / `partnerStatus: "assigned"` when it is `"delivery"`. For `"normal"`/service steps, accepting a quote creates a `subOrderType: "service"` sub-order (with its `order_assigned` notification) and nothing else — the parent order's delivery-pipeline fields are left untouched, so the assignee is NOT funneled into `/earn/deliveries` GPS dispatch. `/earn/deliveries`'s raw SQL queries fetch each order's active-step `activityType` and exclude rows whose active step is explicitly non-delivery, while leaving rows with no resolvable active step/`activityType` untouched (never hide a real assignment by guessing during the pre-`active`-OSP timing window).

`activityType` was added in migration `20260605000000_add_workflow_activity_type`. Read it via `$queryRaw` while the Prisma client may be stale; fall back to `"normal"`.

**Where each step type's assignment lives — and which UI may read it (CONFIRM-PARITY-FIX-1):**
- **Normal-step assignment** lives on `OrderStepProgress.currentAssigneeId` (set by `assignNormalStep`), surfaced to the frontend as `activeStep.assigneeName` in `GET /api/store/orders?storeId=X`. `Order.assignedToId`/`assignedToUserId` are **never** set for normal steps.
- **Delivery-step assignment** lives on `Order.assignedToId`/`assignedToUserId` (written by `assignNextPartner` or a manual owner PATCH).
- A UI that reads `Order.assignedToId`/`assignedToUserId` to display "who's assigned" for a *normal*-active-step order will always see `null` and incorrectly render "Unassigned" — the engine already auto-assigned someone, just on the OSP layer. `/store/orders/all` was fixed to branch on this: it shows the legacy assignment box only when a genuine legacy delivery assignment exists, and otherwise shows a read-only `activeStep.assigneeName`-sourced card with a link into `/store/[id]/orders`.

**Two order-management surfaces, two distinct roles (CONFIRM-PARITY-FIX-1):**
- **`/store/[id]/orders` (page B)** — the **one true confirm/workflow surface**. Owner confirms steps, dispatches deliveries, manages assignments here. `WorkflowSection` and the per-store assignment controls live only here.
  - **Numbered STEPS list (OWNER-STEPVIEW-1)** — `WorkflowSection`'s active-order view (state C) shows every `WorkflowStep` as a numbered row `N. Name → real assignee  [state]`, derived honestly from `OSP.status` (`Done ✓` / `Active — your turn` / `Waiting on step N` / `Failed — needs attention`). Built entirely from data the page already fetches (`allSteps`/`activeStep` from `GET /api/store/orders?storeId=X`) — no new query or endpoint. Assignee names come from the route's `stepAssigneeName()` resolver: normal steps → `OSP.currentAssigneeId → WorkflowStepAssignee → Collaboration`; delivery steps → real `Order.assignedToId`/`assignedToUserId` (only once dispatched — `OSP.status !== "pending"`). Inline controls reuse existing endpoints only: confirm/fast-track → `PATCH /api/order/[id]/step/[stepId]/confirm`; delivery reassignment → the existing per-order override `PATCH /api/order/[id]/delivery` via `onAssignDelivery`. **Gap surfaced honestly in the UI** (not silently built around): no per-order override exists for *normal*-step reassignment — only the template-level Workflow tab editor, which would change the assignee for all future orders. See `CLAUDE.md` § Store Order Pages for the full breakdown.
  - **Post-dispatch view stays open (OWNER-DELIV-VIEW-1)** — delivery is the FINAL step (MK's decision — nothing comes after it), so once its OSP leaves `"active"` (→ `"confirmed"`/`"failed"`), `activeStep` goes `null` and the section's old gate (`!activeStep && quotes.length === 0 && ...  → return null`) blanked the whole section, hiding the STEPS list and any delivery view right when the owner most needs to watch the order. **Gate before**: `if (!requiresAttention && !activeStep && quotes.length === 0 && !showRejection) return null;`. **Gate after**: same condition `&& !isPostDispatch`, where `isPostDispatch = deliveryStep exists && deliveryStep.ospStatus is "confirmed"|"failed" && order isn't cancelled`. Detection deliberately keys off the delivery step's own OSP status (not `deliveryStatus` alone) — `confirm/route.ts` sets `Order.deliveryStatus = "out_for_delivery"` at the same instant it confirms the OSP, *before* `assignNextPartner` runs, so OSP status is the more honest "has dispatch happened?" signal regardless of whether a partner was ever found. The STEPS list condition gained the same `|| isPostDispatch` so it renders with `activeStep === null`; the delivery row's label is derived honestly from `deliveryStatus` instead of reusing the generic `"Done ✓"` (which would falsely imply the order had arrived): `"Out for delivery 🚚"` while in transit, `"Delivered ✓"` once `deliveryStatus === "delivered"`, `"Dispatched ✓"` as a fallback.
  - **Owner delivery map (OWNER-DELIV-VIEW-1, Part 2)** — while `deliveryStatus === "out_for_delivery"`, `WorkflowSection` renders a "DELIVERY TRACKING" block that reuses the **exact same** `TransportMap` component and `GET /api/transport/vehicles?id=` 5-second poll the customer already uses on `/order/[id]/track` (dynamically imported with `ssr: false`, same as elsewhere) — no second tracking system was built. Three honest states: (1) `assignedToId` set + `vehicleId` set → live map with `deliveryStep.assigneeName` shown as the partner; (2) `assignedToId` set, no `vehicleId` yet → "Delivery partner hasn't started GPS yet."; (3) no `assignedToId` → amber "Awaiting delivery partner assignment — no partner has accepted this dispatch yet." (covers the `assignNextPartner` no-assignee/escalation case from the still-pending dispatch-reliability audit — this view must be correct either way, so it never renders a blank or broken map).
- **`/store/orders/all` (page A)** — a **read-only cross-store monitor**. `deliveryStatus` renders as a plain badge (its old clickable "advance status" stepper directly PATCHed `deliveryStatus` with no `activityType` awareness, force-dispatching normal steps as deliveries — that control was removed). Active-step chips and assignment cards link/funnel into page B rather than offering a second place to act.

**Horizon — QUOTE-BLOCK-1 (deferred):** Quote/negotiation is conceptually a separate, multi-round, two-sided interaction (request → respond → accept/reject/counter) — distinct from the linear single-actor normal/delivery confirm flows above. DISPATCH-FIX-1 already de-coupled quote-accept from delivery dispatch (gated on `activityType`, see paragraph above). A dedicated quote block/UI (QUOTE-BLOCK-1) to formalize this separation is deferred; the existing quote endpoints are sufficient for users to self-handle in the meantime. Any future change to `accept/route.ts` or step assignment must preserve this conceptual separation — do not re-entangle quote logic into the dispatch paths. See `CLAUDE.md` § Known Footguns for the doctrine note.

**UI behaviour:**
- **Process editor** (`WorkflowTab.tsx`) — each step shows a "Normal work" / "Delivery (GPS)" pill selector. Delivery pill is emerald; normal is indigo. Persists via `PATCH /api/initiative/[pageId]/workflow/[stepId] { activityType }`. Help text updates per selection. Seeded "Dispatch & Deliver" step defaults to `"delivery"`.
- **Order page confirm button** (`WorkflowSection` in `app/store/[id]/orders/page.tsx`) — label is `activeStep.activityType === "delivery"` → **"Confirm Dispatch 🚚"** (dark teal) or **"Mark Complete ✓"** (teal). Both hit the same confirm endpoint.
- **⚡ Complete All (N)** — `startFastTrack` excludes delivery steps (`activityType !== "delivery"`). The count N only counts normal non-quote remaining steps. The button is hidden when the active step is delivery or no normal steps remain.
- **Manual assignment is secondary** — the "Reassign / assign manually" section is in a `<details>` element (collapsed by default). It is an override, not the primary dispatch path.

### Process Tasks surface (TASK-SURFACE-1 — confirmable normal-step assignments)
Normal (`activityType: "normal"`) steps create **no sub-order** on assignment — `assignNormalStep` only sets `OSP.currentAssigneeId` and fires an `order_assigned` notification. The assignee needs somewhere to act on it:

1. **Model decision**: the active `OrderStepProgress` row (`status: "active"`, `currentAssigneeId` set) **is** the task record — `pending` confirmation = `status: "active"`, confirmed = `status: "confirmed"`. No new model, no `Order` row, no `deliveryStatus`/GPS coupling. (Reusing `createSubOrder` was rejected — it requires a `Store`, writes `deliveryStatus: "pending"` onto a brand-new `Order` row, and resolves partner delivery blocks/cost — none of which apply to a lightweight "tap to confirm" task and all of which would risk polluting `/store/[id]/orders` and `/earn/deliveries`.)
2. **`GET /api/orders/tasks`** — lists active normal-step OSP rows where the current user resolves as the `WorkflowStepAssignee`'s partner (same resolution as `assignNormalStep`/`confirm/route.ts`). Returns order ref, step name, **correct store name** (joined directly off `Order.store`, not `receiverPage` — Bug-4 fixed inline here), items summary, total.
3. **`/app/orders?tab=tasks`** ("Tasks" tab) — lists `TaskCard`s with a single "Confirm completed ✓" button. Confirm calls the existing `PATCH /api/order/[id]/step/[stepId]/confirm` (same endpoint the owner uses) → OSP marked `confirmed` → `advanceToNextStep` runs → next step activates and its assignee is notified.
4. The `order_assigned` notification fired by `assignNormalStep` now links to `/app/orders?tab=tasks` (was `?tab=my`, which surfaced nothing actionable for process-task assignees).
5. Does not appear in `/earn/deliveries` (that surface queries `Order.assignedToId`/`assignedToUserId`/block-LATERAL-join — none of which normal-step assignment touches) and does not set any delivery field on the parent `Order`.


1. Owner confirms the workflow's **delivery step** (`activityType === "delivery"`) → `deliveryStatus = "out_for_delivery"` + `assignNextPartner` runs → partner selected, sub-order created, partner notified
2. Partner sees the assignment in `/earn/deliveries` — order with `partnerStatus IN ('assigned', 'accepted')`. Accepted cards show a **PICK UP FROM** section and a **"🗺️ Navigate to delivery"** button above GPS controls.
3. Partner clicks "Start GPS" in `DeliveriesClient.tsx` → `useGeolocation()` hook → `POST /api/transport/broadcast` on an interval; `Order.vehicleId` is set to the new `Vehicle` row ID
4. Buyer at `/order/[id]/track` polls `GET /api/transport/vehicles?id={vehicleId}` every 5 s and shows the partner on `TransportMap`. If `vehicleId` is null, shows "Delivery partner hasn't started GPS yet."
5. Partner confirms delivery: OSP confirm + `partnerAction: "complete"` → `partnerStatus = "completed"` → Broadcaster stops → `Vehicle` row deleted.
6. Customer sees "Confirm you received this order?" prompt → `POST /api/order/[id]/customer-confirm` → `deliveryStatus = "delivered"`.

**Owner-manual vs automatic dispatch — both notify (NOTIFY-FAST-1):** the owner can also assign a delivery partner directly via the Partner-Business dropdown (`PATCH /api/order/[id]/delivery { assignedToId }`) instead of letting `assignNextPartner` auto-cycle. This collab-based manual path now fires the same `order_assigned` / "Delivery assigned to you" / `/earn/deliveries` notification that the user-type (`{ userId }`) manual path and the automatic dispatch path already fired — previously it was the one branch of four that silently skipped notification (DELIV-ENGINE-AUDIT-1 found this; the partner received the assignment with no alert). The partner's `userId` is resolved off whichever side of the `Collaboration` (`requester`/`receiverPage`) is NOT the store's own page.

**Reject → cycle → fee-hike → escalation (CYCLE-FIX-1):** when a collab partner rejects a delivery-step assignment, `delivery/route.ts` must locate the OSP row to hand to `assignNextPartner`. By dispatch time the delivery-step OSP is already `status: "confirmed"` (set in `confirm/route.ts` *before* `assignNextPartner` first runs), so a `findFirst({ where: { orderId, status: "active" } })` lookup always returns null on reject — cycling, fee-hikes, and escalation silently never fired (CYCLE-AUDIT-1). The fix derives the step from the just-rejected `order.assignedToId` (captured before it's nulled) via `WorkflowStepAssignee` → `WorkflowStep` joined on `activityType = 'delivery'`, then does an unambiguous `findUnique({ where: { orderId_stepId: { orderId, stepId } } })` (the `@@unique([orderId, stepId])` constraint guarantees one row). **OSP status is intentionally NOT restored to `"active"`** — `assignNextPartner` only reads/writes `currentAssigneeId`/`cycleCount`/`lastFeeMultiplier` and is status-agnostic; it already runs correctly against a `"confirmed"` OSP on first dispatch. From there: `assignNextPartner` cycles to the next `WorkflowStepAssignee` by `sequence`; after a full cycle it increments `cycleCount` and applies a 5% fee hike (`lastFeeMultiplier *= 1.05`) before restarting from the top; after 3 full cycles it sets `requiresAttention = true` and notifies the store owner (`type: "escalation"`) — the OSP is left active for manual reassignment. If the rejected collab has no delivery `WorkflowStepAssignee` row (`stepId` resolves to `undefined`), `activeOSP` stays `null` and the existing "no other partner available — reassign manually" fallback applies unchanged.

**Self-delivery routing via `assignedToUserId` (DELIV-DISPATCH-FIX-1):** when `assignNextPartner` resolves a `WorkflowStepAssignee` whose backing `Collaboration` has `receiverPage: null` (a user-type collab — the self-team collab that `ensureOwnerAssignee` creates for the store owner), it writes `Order.assignedToUserId = partnerUserId` and nulls `assignedToId`. Writing the self-team collab's ID into `assignedToId` (the pre-fix behaviour) made the order invisible on `/earn/deliveries` because `rawCollabOrders` filters by `receiverPageId IN pageIds` — a null `receiverPageId` never matches. After the fix, self-delivery orders surface in `rawPersonalOrders` (which queries `assignedToUserId = userId`). The owner can accept/reject/GPS from `/earn/deliveries` via the `isOwnerAsPartner` path in `delivery/route.ts`; reject cycles the OSP via a direct `OrderStepProgress` lookup (not the collab-based lookup the external-partner reject uses, since `assignedToId` is null). Cycling and escalation work identically to the external-partner path. `activateWorkflow` and `advanceToNextStep` also call `ensureOwnerAssignee` for delivery steps with zero WSA rows (mirrors what they already do for normal steps) so `assignNextPartner` never no-ops silently when only the owner is configured.

**Sub-order ownership rule:** `createSubOrder` writes the sub-order's `userId` as the **assignee** (the delivery partner / service provider), not the parent order's customer. This is what makes the sub-order show up under the partner's own `/app/orders` → Store Orders → Assignments (that view fetches the partner's own buyer-orders via `GET /api/store/orders` and filters to rows with `parentOrderId` set). The customer only ever sees the **parent** order — never the sub-order. (Earlier code wrote `userId: parent.userId`, which hid the assignment from the partner and incorrectly surfaced the sub-order under the customer's own order list.)

### AI Store Setup Wizard (new store onboarding)
1. Owner creates a `Page` via `/app/initiatives` (mobile) and clicks "Open →" → Initiative Hub → Store tab → "Set up store"
2. `InitiativeTabs.handleOpenStore()` → `GET /api/store/for-page/${pageId}` → finds/creates `Store`, counts `StoreSection` rows
3. Response: `{ storeId, storeSlug, isNew: sectionCount === 0 }`
4. If `isNew: true` → `window.location.href = /store/${storeId}/setup` (hard nav — `router.push` drops cross-layout-root navigations)
5. **Fallback**: if user reaches `/store/[id]` any other way and still has 0 sections + `isOwner`, `fetchStore` calls `window.location.replace(/store/${id}/setup)` unless `sessionStorage.setup_skipped_${id}` is set
6. Wizard step 1: owner describes their business in plain English
7. `POST /api/store/ai-setup` → one `chatComplete` call → JSON structure + images batch-fetched via `lib/imageSearch.ts` `fetchImages()` in parallel (Unsplash → Pexels → Pixabay rotating, Picsum guaranteed fallback)
8. Wizard step 2: owner edits titles/prices inline, removes unwanted sections
9. `POST /api/store/ai-setup/apply` → single Prisma transaction (30 s timeout): filters → sections → tiles → per-filter banners → blocks → one global `StoreBanner`
10. On success: wizard redirects to `/store/${storeId}`; `fetchStore` sees `sections.length > 0` so no redirect loop
11. Skip at any step → `skipToStore()` sets `sessionStorage.setup_skipped_${storeId}` then navigates to the store directly

Image env vars (all optional — `lib/imageSearch.ts` skips missing providers): `UNSPLASH_ACCESS_KEY`, `PEXELS_KEY`, `PIXABAY_KEY`. Picsum is the guaranteed no-key fallback so images are never `null`.

### Store Open/Closed (`Store.acceptingOrders`)
Every store has a manual `acceptingOrders Boolean @default(false)` toggle. New stores are **closed by default**. Owner flips it from `StoreHero` (store page) or the Initiative Hub Store tab. Both order routes (`POST /api/store/orders` and `POST /api/store/orders/quick`) return 422 with `"This store isn't taking orders right now."` when the store is closed — this is the authoritative guard. Buyer-facing: green "Taking orders" pill or amber "Not taking orders right now" banner on store page and section pages; Buy buttons are greyed out. `Store.hoursText String?` is a display-only string (set by menu parser or owner); not parsed or enforced.

### Store Purchase Flow — Cart (standard)
1. User browses `/store/[id]` — sections and blocks fetched
2. `POST /api/store/cart/[storeId]` — add block to cart; "Add to Cart" button flashes "✓ Added" for 2 seconds
3. `POST /api/store/orders` — checkout, creates `Order` with JSON snapshot of items, clears cart; **rejected with 422 if store is closed**
4. Order status progresses: `pending → confirmed → shipped → delivered`

### Store Purchase Flow — Buy Now (express)
1. User clicks "Buy Now" on a product card (section page) or on a wishlist item (Saved page)
2. `QuickOrderModal` opens with item pre-loaded and selected qty; cart is never touched
3. Steps: Items review (inline qty stepper) → Delivery address → Invoice profile (optional) → Place order
4. `POST /api/store/orders/quick` with `{ storeId, addressId, items[], billingProfileId? }` — creates `Order` directly
5. On success: confirmation screen with order ID + "View my orders" link

### Store Order Management (owner side)
- `GET /api/store/orders?storeId=X` — orders for one store (owner-only)
- `GET /api/store/orders?storeId=X&status=delivered` — filter by any status value
- `GET /api/store/orders?all=true` — orders across **all** stores owned by the user; each order includes `store { id, name }`
- `/store/[storeId]/orders` — active order list with status-update controls; "Delivered Orders →" button in header
- `/store/[storeId]/orders/delivered` — read-only delivered archive; no status-update buttons; "← Active Orders" back link
- `/store/orders/all` — **read-only cross-store monitor + funnel** (page A): aggregated view across all owned stores; store name shown as a chip on each card; `deliveryStatus` is a display-only badge (no click-to-advance — that control was removed in CONFIRM-PARITY-FIX-1 because it force-dispatched normal workflow steps as deliveries); active-step chip links into `/store/[id]/orders` (page B) where the owner actually confirms/dispatches steps. Cancel is the only mutating control on this page.
- `/store/account?tab=stores` — summary view: "All Orders" pill plus per-store pills; "View all →" routes to the correct full page

### Billing Profiles
- Users save multiple billing profiles (`BillingProfile` model) for GST / invoice use
- Each profile: `legalName` (required), `companyName`, **GST block** (`gstRegistered Boolean`, `gstin`, `gstState`, `annualTurnover`), billing address fields, optional `linkedStoreId`
- Managed in `/store/account?tab=invoice` — Tax & Compliance toggle controls the GST block; GSTIN auto-derives state from first 2 digits; `above_5Cr` turnover shows an e-invoice warning
- Selected during `QuickOrderModal` step 3 and `CheckoutModal` step 2; selected profile is **serialised into `Order.invoiceData` JSON** — no FK on the Order row
- API: `GET/POST /api/store/billing-profiles`, `PATCH/DELETE /api/store/billing-profiles/[profileId]`

### UPI VPA Payment Handle (REQBCAST-1b)
Providers store a UPI VPA (`name@bank`) so a paying party can pay them **directly** — **display/handoff only, the platform never collects or validates payment** (shape-checked at input, never resolution-checked). Two homes: `Store.upiVpa` (set in the Initiative Hub **Store tab**) and `Profile.upiVpa` (set in the user **Earning** section, `/user/edit`), both surfaced via `GET/PATCH /api/store/[id]` and `GET/PATCH /api/user/profile`. Validation lives in `lib/payments/vpa.ts`; the setter is `components/payments/VpaSettingCard.tsx`, the handoff atom is `PayToVpa.tsx`, and the resolver `lib/payments/getVpa.ts` is consumed by the broadcast engine (REQBCAST-1c) at request-accept. See `docs/modules/store.md` § UPI VPA Payment Handle.

### Request Broadcast Engine (REQBCAST-1c — inDrive/noticeboard)
A user posts a **service request**; nearby providers offering that category get a notification card, respond (optionally with a quoted price), the requester accepts ONE, and both settle DIRECTLY via the provider's UPI VPA. **Noticeboard, not dispatcher** — the platform never assigns, prices, or collects. Models `RequestBroadcast` + `RequestResponse` (separate status fields, deliberately not OSP). **Role-split surfaces (REQBCAST-1f)**: the **requester** side is `app/app/requests/page.tsx` ("My requests" only), reached via the **`/app/saved` Browse toggle Services tab** (Stores · Products · Services) and the standalone `/app/requests` deep-link. The **provider** "Incoming" feed was moved to the **Orders → Requests tab** (`/app/orders?tab=requests`) via `components/requests/IncomingRequests.tsx` (single source of truth), shown as a separate section above the workflow Quote-request list. Provider notification deep-links point at Orders → Requests; a stale `?tab=incoming` link redirects there. The old `/app/discover` CTA was removed. Routes: `POST/GET /api/requests`, `GET /api/requests/incoming`, `POST /api/requests/[id]/respond`, `POST /api/requests/[id]/accept`, `PATCH /api/requests/[id]`. Eligibility = bounding-box + Haversine + store-declared `serviceType='service'` (`lib/requests/eligibility.ts`). Expiry is lazy-on-read. **Errand variant (REQBCAST-1e, `kind='errand'`)**: same flow for GOODS/TASKS pick-and-drop (NO passengers — carpool deliberately unbuilt pending legal review); adds a pickup location, a drop location, and a **display-only suggested price** (`lib/requests/suggestErrandPriceHint.ts`, never enforced). Eligibility anchors on the **pickup** point and includes `serviceType='delivery'` runners. Same Services-tab surface with a Service ↔ Errand toggle. **Pickup/drop can be anywhere (REQBCAST-1g/1g2)**: besides saved addresses, `TempPicker` resolves a one-off location via Nominatim text search, **one-shot live GPS** (pickup), or an **on-demand draggable map pin** that reverse-geocodes to a label on drag-end (`reverseGeocode()` in `lib/geo/geocode.ts`, `MapPicker` reused) — coords fill `pickupLat/Lng/pickupLabel` for that broadcast only, never saved to the address book. **Fleet provider presence (FLEET-STATE-1b, P1)**: a fleet/runner provider flips an **Available / Receive-work toggle** in Orders → Requests (`components/requests/AvailableToggle.tsx`, above `IncomingRequests`) → it POSTs `/api/presence { lat, lng, mode }` on a foreground-only, distance-gated adaptive loop. Eligibility then matches them from their **live presence position** (`ProviderPresence`, fresh = `mode='available'` within 5 min) **OR** their static `Store.lat/lng` — `COALESCE(presence, store)`, ADDITIVE (a provider with no presence row is unchanged). Foreground-only, no background location; mode machine (P2) + auto-pool (P3) deferred. Full design: `docs/modules/requests.md`.

### Store Image Pool (upload dedup)
All store image uploads route through `lib/store/uploadImage.ts` — `uploadStoreImage(file, storeId)`. **Never call Cloudinary directly from store UI components.**

The pipeline:
1. Hash file client-side (SHA-256 via `crypto.subtle`)
2. Check DB — if hash exists for this store, return existing record immediately (`alreadyExisted: true`)
3. Upload to Cloudinary (`cloud: dyphnp3oc`, preset `posts_unsigned`, `public_id = fileHash`)
4. Upsert into `StoreImage` — handles any race condition between steps 2 and 4

`StoreImage` fields (post-migration): `id`, `storeId`, `url`, `cloudinaryId`, `fileHash`, `fileName`, `uploadedAt`. Old fields `name`, `imageUrl`, `imageKey`, `createdAt` are gone — do not reference them.

API surface:
- `POST /api/store/images/check` — hash lookup; returns `{ exists: true, image }` or `{ exists: false }`
- `POST /api/store/images/save` — upsert on `[storeId, fileHash]`
- `GET /api/store/images/list?storeId=` — list images for a store (owner only)
- `GET /api/store/[id]/images` — same list, legacy path used by BulkImageUploadModal

Picker UI: `StoreImagePickerModal` (in `components/store/`) — shows grid, search, "Upload new" button. Opened from the product block form ("Choose from library"). "Paste URL instead" toggle is the fallback for external URLs.

### Store Slugs
- Every store has a `slug String? @unique` field generated from its name at creation (`lib/store/generateSlug.ts`)
- `GET /api/store/[id]` resolves both cuid and slug — cuids via `findUnique`, slugs via `SELECT id FROM "Store" WHERE slug = $1` raw SQL
- Store pages redirect `router.replace()` to the slug URL if the current URL uses a cuid — canonical URL is always the slug
- All store-listing APIs inject slug via `getStoreSlugs()` from `lib/store/getStoreSlugs.ts`
- `scripts/migrateStoreSlugs.ts` was used to backfill slugs for stores created before the field was added
- **Stale-client warning**: `Store.slug` may not be in the Prisma generated client if `prisma generate` failed (EPERM on Windows while dev server runs). Always use `$queryRaw` for slug-field operations until `prisma generate` succeeds.

### Store Discovery (`/app/discover`, DISCOVER-1b)
- **Route**: `/app/discover` — customer-facing map+list store discovery. Thin server-component-free wrapper (`app/app/discover/page.tsx`) owns the address gate; all map/list/filter logic lives in the reusable `components/store/DiscoveryView.tsx` (props: `addresses`, `initialAddressId`), with `components/store/DiscoveryMap.tsx` as the Leaflet multi-marker map (`ssr: false`).
- **Gate (DOC-7, locked)**: no saved address → `NoAddressGate` blocks the whole view (map and list); no unsorted fallback exists.
- **`GET /api/store/all`** extended (additive) with `categoryIds`, `tagIds`, `addressLat`, `addressLng` — OR-within-axis/AND-across-axis taxonomy filtering, plus `distanceKm` via `lib/store/getStoreGeo.ts` + `lib/geo/haversine.ts`.
- **`/app/saved` Browse tab reuses the same filter flow (DISCOVER-INLINE-1b)** — `components/store/DiscoveryFilterModal.tsx` is opened from the saved/wishlist page's Browse tab via a "Filter stores" button. `activeFilters: DiscoveryFilters` in `app/app/saved/page.tsx` drives a `GET /api/store/all` call with the selected categories/tags/address coords. `FilterPill` (`components/store/FilterPill.tsx`) is the shared pill atom used in both the modal body and the Browse header. `/api/store/all` is therefore the single endpoint for both map/list discovery and the saved-page browse — the same filter semantics apply.
- **`lib/store/getStoreGeo.ts`** — `getStoreGeo(ids[])` raw-SQL helper returning `{lat, lng, acceptingOrders}` per store, mirroring `getStoreSlugs`.

### Product Search (PRODSEARCH-1b)
- **Route**: `GET /api/store/product-search` — auth-gated; returns item-level results (not store-level) sorted by haversine distance when `addressLat`/`addressLng` are supplied.
- **Params**: `q` (full-text via `websearch_to_tsquery`), `addressLat`/`addressLng` (distance sort + badge), `categoryIds` (comma-separated; category proxy via `StoreCategoryLink`), `limit`, `offset`.
- **Filters**: `serviceType='product'`, `visibility='public'`, `price IS NOT NULL`, `storeId IS NOT NULL`, store not deleted, own stores excluded. Uses `DISTINCT ON (b.id)`.
- **Category proxy**: categories are at the store level, not per-block. Filtering by category narrows to stores that carry it, then returns all matching blocks in those stores. See TECH_DEBT.md §15.
- **tsvector index**: `Block.search_vector` — `GENERATED ALWAYS AS (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))) STORED` with GIN index `Block_search_vector_idx`. Migration `20260622000000_add_block_storeid_search`.
- **`StoreBlock.storeId` denormalization**: `Block.storeId TEXT` FK (nullable) added in the same migration; backfilled from `section → store`; set by all three block-creation paths (block POST, ai-setup/apply, parse-menu/apply). Subsection-only blocks (learning module) remain null — intentionally excluded from product search.
- **UI**: `/app/saved` Browse section gains a "Stores / Products" tab toggle; Products tab has search input + category filter + 2-column result cards (image, title, price, store name, distance badge). Store name taps to `/store/{storeSlug|storeId}` — never a Page ID.

### Store/Venture Lifecycle — Soft-Delete (whole-venture close)
A store doesn't just "exist or not exist" — owners can **close** it from `/store/account`, and later **restore** it. This is a soft delete: `Store.deletedAt` + the linked `Page.deletedAt` are stamped (both `db push` fields, no migration file); nothing is removed from the DB, so order history and invoices survive a venture closing. Full design: `docs/modules/store-deletion.md`; summary in `CLAUDE.md` under "Store Soft-Delete (Whole-Venture Delete)".

- **Blocked while orders are open** — "open" = any order or sub-order whose `status`/`deliveryStatus` isn't `delivered`/`cancelled`. Returns `409 { error: "open_orders", blockingOrders: [...] }`.
- **On close**: both `deletedAt` flags are stamped, every accepted `Collaboration` touching the page is ended (`status → "cancelled"`, the existing terminal state — reused, not new), and the other side of each gets a `collaboration_ended` notification.
- **Action guards (409s)** stop zombie writes on closed ventures: order placement (cart + quick) reject with the existing `acceptingOrders` 422 contract, and five collaborator-action routes (delivery PATCH, step confirm/fail, quote respond/accept) reject with `409 { error: "This store has been deleted — no further actions are possible." }`.
- **Listings filter out closed stores** (`deletedAt: null`) — wishlist, pinned, fleet, course, health-expert/suggestion routes, collaboration receiver resolution. **Owner's `/store/account` deliberately still shows them** (greyed, with a Restore button), and `/store/orders/all` still shows historic orders from closed stores with a "Store closed" badge — these are intentional exceptions, not gaps.
- **Restore** (`PATCH /api/store/[id]/restore`, owner-only) clears both flags and re-mints the slug if another live store claimed it in the meantime. **Collaborations are NOT re-activated on restore** — the owner must manually re-invite partners (documented gap, by design — re-establishing a partnership needs the other party's consent).
- Verification: `scripts/test-store-softdelete.ts` — 21/21 checks across all 7 scenarios.

### Invoice System (auto-generate on delivery, owner signs, buyer downloads)
Routes: `app/api/orders/[orderId]/invoice/` (generate), `.../sign/` (signed upload), `.../download/` (authenticated proxy).

1. Owner marks order **delivered** → client auto-calls `POST /api/orders/[orderId]/invoice`
2. Server renders PDF via `@react-pdf/renderer` (`lib/invoice/InvoiceDocument.tsx`); `invoiceType` is `"tax_invoice"` if seller's `BillingProfile.gstRegistered`, else `"bill_of_supply"`
3. PDF uploaded to Cloudinary as `resource_type: "raw", type: "authenticated"` — access-controlled, not publicly fetchable
4. `invoiceUrl`, `invoiceNumber`, `invoiceType`, `invoiceGenAt` written to Order
5. Owner UI shows 3 states: generating → unsigned ready + sign-upload form → signed done
6. Owner uploads signed PDF → `POST .../sign` → `invoiceSignedUrl` saved via `$executeRaw`
7. Buyer sees **Signed Invoice** download link when `invoiceSignedUrl` exists; "Invoice pending signature" if only `invoiceUrl` exists

Download proxy: `GET .../download` — derives `public_id` deterministically (`invoices/{orderId}` or `invoices/signed/{orderId}_signed`), generates a 60-second `private_download_url` signed token, streams PDF back. Raw Cloudinary URLs are never sent to the browser.

Env: `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (used by both client and server — there is no separate `CLOUDINARY_CLOUD_NAME`); `CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` from `.env.local` and Vercel env vars.

**GST tax invoice and e-invoice cases pending testing.** The `"tax_invoice"` branch and `annualTurnover: "above_5Cr"` (IRN/IRP required) UI exist but have not been verified end-to-end with a real GSTIN.

### Product Ratings
- `ProductRating` model: one rating (1–5) per user per `StoreBlock`; `@@unique([productId, userId])`
- Store owners get a 403 from the rate endpoint
- Section pages batch-fetch all ratings in one `GET /api/store/products/ratings?ids=...` call (uses `groupBy` aggregates — never N+1)
- `StarRating` component handles hover, click-to-rate, "Thanks for rating!" feedback, owner/logged-out display-only modes

**Wishlist toggle:** `POST /api/store/wishlist` is a toggle — if the item exists it deletes it (`{ wishlisted: false }`), otherwise creates it (`{ wishlisted: true }`). Requires both `blockId` and `storeId`. There is no separate DELETE endpoint for wishlist items.

---

## 7. Feature Area Starting Points

Quick reference for jumping into a specific area. Read the linked doc before touching the code.

| Feature area | Primary entry files | Reference |
|---|---|---|
| **Store** (products, sections, banners) | `app/store/[id]/page.tsx`, `app/api/store/` | `docs/modules/store.md` |
| **Store taxonomy** (discovery categories/tags, TAG-STORE-1b) | `prisma/schema.prisma` (`StoreCategory`/`StoreTag`/translations/link tables) | `docs/modules/store.md` § Store Taxonomy; seed: standalone `node prisma/seed-store-taxonomy.js` (seeds vocab + translations for all 16 languages, run separately from `seed.js`) |
| **Store taxonomy picker** (owner Store tab, TAG-STORE-1c-fix) | `GET /api/store/taxonomy`, `components/earn/StoreTaxonomyPicker.tsx`, `components/earn/InitiativeTabs.tsx` | `docs/modules/store.md` § Owner category/tag picker; seed: `node prisma/seed-store-taxonomy-ui.js` (8 UI strings × 16 languages) |
| **Order management** (owner) | `app/store/[id]/orders/page.tsx` (page B — the one true confirm/workflow surface), `app/store/orders/all/page.tsx` (page A — read-only cross-store monitor + funnel into B; CONFIRM-PARITY-FIX-1) | `docs/modules/store.md` § Key Pages |
| **Checkout** (cart + Buy Now) | `components/store/QuickOrderModal.tsx`, `app/api/store/orders/quick/route.ts` | `CLAUDE.md` § Buy Now / Quick Order UX |
| **Guest checkout** | `lib/mergeGuest.ts`, `app/api/user/magic/route.ts` | `CLAUDE.md` § Guest Account Merge |
| **Fleet initiative** | `app/fleet/[pageId]/page.tsx`, `app/api/fleet/[pageId]/route.ts` | `CLAUDE.md` § Fleet Initiative Type |
| **Workflow** (order fulfillment steps) | `lib/workflow/`, `components/earn/WorkflowTab.tsx` | `CLAUDE.md` § Store Initiative System |
| **Delivery** (partner GPS, partner dashboard) | `app/earn/deliveries/page.tsx`, `components/earn/DeliveriesClient.tsx` | `docs/modules/transport.md` |
| **Order tracking** (buyer live map) | `app/order/[id]/track/page.tsx`, `app/api/transport/vehicles/route.ts` | `docs/modules/transport.md` |
| **In-app notifications** (bell + SSE) | `components/notifications/NotificationBell.tsx`, `app/api/notifications/` | `docs/modules/notifications.md` |
| **Initiative Hub** (owner dashboard) | `app/earn/initiative/[pageId]/page.tsx`, `components/earn/InitiativeTabs.tsx` | `CLAUDE.md` § Initiative Hub |
| **Pricing / delivery cost** | `lib/workflow/calculateDeliveryCost.ts`, `lib/workflow/assignNextPartner.ts` | `CLAUDE.md` § Store Initiative System |
| **Partners / Collaboration** | `app/api/collaboration/`, `components/earn/PartnersTab.tsx` | `docs/modules/collaboration.md` |
| **Auth** (login, register, sessions) | `lib/session.ts`, `app/api/auth/`, `app/api/user/` | `docs/modules/auth.md` |
| **Invoice** (PDF, sign, download) | `lib/invoice/`, `app/api/orders/[orderId]/invoice/` | `CLAUDE.md` § Invoice System |
| **Business idea evaluation** (BIZDOC) | `app/(business)/business/idea/page.tsx`, `app/api/business/idea/`, `app/api/business/questions/` | `docs/modules/business.md`; seed: `npm run seed:questions` |
| **Business plan documents** (BIZDOC) | `app/(business)/business/plan/[ideaId]/page.tsx`, `app/api/business/documents/` | `docs/modules/business.md` § Document Types; AI: `ai-context/BUSINESS_AI_PHILOSOPHY.txt` |
| **Listener / Saathi** (guided conversation, CONSULT) | `/listen` page: `app/(listen)/listen/page.tsx`, `components/listen/` (ListenChat, MindMap); API: `app/api/listen/route.ts`, `lib/listener/insights.ts`, `lib/ai/chatPipeline.ts` | `docs/listen.md` — a system **parallel** to `/api/chat` (shares pipeline/guardrails/proposal mechanism/ProposalCard only). HARD RULES: Listener code never writes `UserCompanionProfile`; crisis is a soft override (`scanInputCrisis`), never a BLOCK. Persona: `ai-context/CONSULT_LISTENER.txt` |
| **Admin Bridge** (PERSONA-1: admin recognition, teaching mode, question queue in `/listen`) | `lib/listener/adminBridge.ts`, `lib/ai/teachTrigger.ts`, `lib/ai/capabilityGapTrigger.ts`, `app/api/listen/persona/route.ts`, `components/chat/ActionCardBase.tsx` / `PersonaProposalCard.tsx` | `docs/listen.md` § Admin Bridge. Admin = `ADMIN_EMAIL` only; persona writes are card-confirmed deterministic code, never raw model side effects; `AdminQuestion` has no `userId` (anonymized by design); personas are tone lenses — never characters, never quotes, teacher never named. PERSONA-2 (user-facing injection) deferred. |

**Initiative types** — active: `store`, `service`, `fleet`. Gated but built: `health`, `learning`, `helping`, `community_group`. Toggle: `ACTIVE_INITIATIVE_TYPES` in `app/app/initiatives/page.tsx:54`.

---

## 8. Unprotected Routes

The following routes have **no server-side auth enforcement** of any kind — neither middleware nor manual API checks gate them by default:

| Route | Protection | Notes |
|---|---|---|
| `/state` | None — client-side only | State-level dashboard; unprotected by middleware |
| `/universe` | None — client-side only | Universe-level view; unprotected by middleware |
| `/app/*` | None — client-side only | Entire Capacitor mobile shell; auth state is fetched client-side via `/api/user/me` but there is no server redirect |

**Known risk:** A user who navigates directly to `/state`, `/universe`, or any `/app/*` page without a valid session will hit the page. Whether they see real data depends entirely on whether the page's own data-fetching calls return 401 and the component handles it.

**Do not add new protected features to these routes** without first adding server-side session verification to their layouts or pages, or extending `middleware.ts` to cover them.

---

## 9. Coding Conventions Observed

**API routes**
- All routes are in `app/api/` as `route.ts` files
- Export named functions: `export async function GET(req: Request)`, `POST`, etc.
- Auth pattern: `const token = getTokenFromRequest(req); const payload = await verifySessionToken(token); if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });`
- Return shape: `NextResponse.json({ data })` on success, `NextResponse.json({ error: string })` on failure
- Status codes used: 200, 201, 400, 401, 403, 404, 422, 500

**Database access**
- Always use `db` from `lib/db.ts` in API routes (not `prisma`)
- Prefer `findUnique` with explicit `select` over `findFirst` with `*`
- No raw SQL unless unavoidable

**Components**
- Client components are marked `"use client"` at the top
- Server components have no marker (default in App Router)
- Inline styles are used in the mobile shell (`app/app/`) — Tailwind is used everywhere else
- No component-level CSS modules

**TypeScript**
- `any` is tolerated in existing code (ESLint rule disabled)
- New code should type properly; avoid `any` in new files
- Shared types live in `lib/types.ts`

**No comments by default.** Only add a comment when the reason is non-obvious. The codebase is mostly uncommented — match that style.

**Loading states** — see [`docs/modules/loading-states.md`](modules/loading-states.md) for the full reference. Short rules:
- Skeleton (`animate-pulse` blocks matching content dimensions) over spinners for page/list loading
- `loading.tsx` sibling for every non-dynamic App Router route
- Per-item `useState<string | null>(null)` guard on every async button; always `disabled` + `.finally()` cleanup
- No `setTimeout` to delay content reveal

---

## 10. Forbidden Modifications

**Do not touch without full understanding:**

| File / Area | Why |
|---|---|
| `lib/chat-crypto.ts` | E2E encryption. Breaking this corrupts all chat data. |
| `lib/session.ts` | Changing cookie names or JWT structure logs everyone out. |
| `middleware.ts` | Misconfiguring the matcher can expose protected routes. |
| `next.config.mjs` CSP headers | Removing a directive can break prod; adding a loose one (`unsafe-eval`) is a security regression. |
| `prisma/schema.prisma` enum values | Changing `AiGoal.archetype`, `Order.status`, `Post.visibility`, etc. without a migration breaks existing rows. |
| `Friendship` ordering logic | The `userAId < userBId` invariant is enforced in app code only. Breaking it causes duplicate friendships and broken queries. |
| `app/app/layout.tsx` | This is the Capacitor shell. Breaking it breaks the mobile app for all users. |
| `lib/featureFlags.ts` | Currently always returns `true`. If real flag logic is re-enabled, every feature must be checked. |

**Never:**
- Store secrets or tokens in client-side code or `localStorage`
- Add `unsafe-eval` to the CSP
- Create a second Prisma client instance
- Bypass `middleware.ts` by adding auth logic inline to page components
- Use `git push --force` on `main`

---

## 10a. Known Production Risks

| Risk | Location | Action Required Before Launch |
|---|---|---|
| **Quote timeouts use in-process `setTimeout`** | `lib/workflow/triggerQuoteRequests.ts` | Replace with BullMQ or a durable job queue. A server restart silently drops all pending timeouts — quotes will never be rejected and `requiresAttention` will never be set. |
| **Chat system messages stored as plaintext** | `lib/workflow/triggerQuoteRequests.ts` + any chat renderer | `ChatMessage` rows with `iv = "system"` contain plaintext in `ciphertext`. Renderers must check `iv === "system"` and skip decryption. See `CLAUDE.md` for the full note. |
| **Prisma client stale for new columns** | `Order.parentOrderId/subOrderType/agreedAmount`, `Notification` model, `WorkflowStepAssignee` model, `OrderStepProgress.currentAssigneeId/cycleCount/lastFeeMultiplier` | These were added via Neon MCP migrations but `prisma generate` fails on Windows while the dev server runs (EPERM). All affected code uses `(prisma as any)`. Run `npx prisma generate` after stopping the dev server to restore type safety. |
| **Sub-orders appear alongside parent orders** | `GET /api/store/orders?storeId=X` | The query does not filter by `parentOrderId IS NULL`. Sub-orders (with the same `storeId`) are returned as top-level items. Add the filter if the owner's order list becomes cluttered. |
| **`DATABASE_PRISMA_URL` missing UTC timezone → wrong timestamps** | `.env.local`, Vercel env vars | Neon's session default is IST. All three connection strings (`DATABASE_PRISMA_URL`, `DATABASE_URL`, `DIRECT_URL`) must include `&options=-c%20timezone%3DUTC`. Without it, `createdAt` timestamps are stored 5:30h ahead of UTC and notification "X ago" times appear hours wrong. `.env.local` is fixed; **set `DATABASE_PRISMA_URL` with the parameter in Vercel's env vars dashboard**. |
| **Collaboration re-activation not built into store restore** | `app/api/store/[id]/restore/route.ts` | Restoring a closed venture clears `Store.deletedAt`/`Page.deletedAt` but leaves collaborations ended at delete-time as `status = "cancelled"`. The owner must manually re-invite partners/team members. Documented, intentional gap (re-establishing a partnership needs the other party's consent) — not a bug. See `docs/modules/store-deletion.md`. |

---

## 11. Security

A full static security audit is at [docs/SECURITY_AUDIT.md](SECURITY_AUDIT.md).

**AI Guardrails** — every `POST /api/chat` request runs a three-layer check (input scan → hardened system prompt → output scan). Blocked events are persisted to the `GuardrailEvent` DB table and emailed to `ADMIN_ALERT_EMAIL`. Admin dashboard: `/admin/security` (requires session user email === `ADMIN_EMAIL` env var). Full spec: [docs/AI_SECURITY.md](AI_SECURITY.md).

**Critical issues that must be fixed before further public launch:**

| Priority | File | Issue |
|---|---|---|
| 1 | `app/api/debug-db/route.ts` | **No auth — returns DATABASE_URL.** Delete this file. |
| 2 | `app/api/user/register-temp/route.ts` | **No auth — overwrites any user's password.** Delete this file. |
| 3 | `app/api/users/search/route.ts` | **No auth — returns email + phone for all users.** Add session auth. |
| 4 | `app/api/transport/broadcast/route.ts` | **No auth — GPS spoofing.** Add session auth + partner ownership check. |
| 5 | `app/api/tests/ai`, `goal-ai/refine`, `goal-ai/summary`, `goal-ai/reflect`, `ai/suggest-actions` | **No auth — free AI API abuse + prompt injection.** Add session auth + rate limiting. |

See `docs/SECURITY_AUDIT.md` for the full 28-finding report with file references, exploit descriptions, and recommended fixes.

---

## 12. Glossary

| Term | Meaning |
|---|---|
| **Layer** | One of the 6 scale levels: Self, Society, State, Nation, Earth, Universe |
| **Page** | Polymorphic DB record that backs a Store, Course, HealthBusiness, or HelpingInitiative |
| **Block** | Atomic content unit inside a Section — either a product (store) or lesson (course) |
| **Section** | A group of Blocks within a Store or Course, with layout metadata |
| **Tab** | A navigation entry in a Layer, resolved from the `Tab` DB table |
| **UserTab** | Sparse per-user override of a canonical Tab (visibility, position, title) |
| **Level** | DB record representing one of the 6 layers (has `key`, `name`, `order`) |
| **Archetype** | AiGoal classification: `LEARN`, `BUILD`, `EXECUTE`, `CONNECT` |
| **Circle** | A named group of friends owned by a user (`FriendCircle`) |
| **Helping Initiative** | An NGO/charity-style page with objectives, actions, metrics |
| **Collaboration** | A `Collaboration` DB record linking two `Page` records with a role and status — the Partners system |
| **Initiative Hub** | The owner-only page at `/earn/initiative/[pageId]` with Overview / Store / Partners tabs |
| **Store** | A product/service marketplace page owned by a user |
| **Block access** | `free` or `paid` — controls whether a Block requires purchase |
| **Canonical ordering** | The `userAId < userBId` constraint on `Friendship` and `ChatConversation` |
| **Mobile shell** | `app/app/layout.tsx` — the Capacitor-wrapped layout served at `/app/*` |
| **`db`** | The canonical Prisma client from `lib/db.ts` |
| **`prisma`** | Legacy alias for the same client from `lib/prisma.ts` |
| **Session cookie** | `charaivati.session` (dev) / `__Host-session` (prod) — HTTP-only JWT |
| **Sahayak** | Public help/support section under `(public)/sahayak` |
| **pageType** | Discriminator on `Page`: `store`, `course`, `health-business`, `helping-initiative` |

---

## AI Setup

### Local Ollama (primary provider)
The dev machine runs Ollama locally, exposed via Cloudflare Tunnel at `https://ollama.charaivati.com`.
Both local dev and Vercel production use this URL as the primary AI provider.

**Auto-starts on boot** — no manual action needed:
- `OllamaServe` scheduled task starts `ollama serve` at logon
- `OLLAMA_HOST=0.0.0.0` is a permanent Windows system env var
- Cloudflare tunnel runs as a Windows service (`cloudflared`)

**To verify it's running:**
```
https://ollama.charaivati.com/api/tags
```
Should return JSON with available models (`gemma4:e2b`, `llama3:8b`, `llava:7b`).

**If it's down** — check on the dev machine:
1. Task Manager → check `ollama.exe` is running
2. Services → check `Cloudflared` is running
3. Manually: `ollama serve` in PowerShell

**Ollama version: v0.30.4.** Do not downgrade — v0.21.x crashes on vision requests (llava).

### Models Available
- `llama3:8b` — **primary, text-only chat model**, kept resident via `OLLAMA_KEEP_ALIVE=-1` (LOCAL-AI-FIX-1, 2026-06-14) so cold loads don't happen mid-request
- `gemma4:e2b` — no longer the active chat model; its unified multimodal (vision+audio) weights spilled ~4.4GB to CPU on the 6GB 3050, causing slow/failed loads
- `llava:7b` — local vision fallback only, used by menu-parse / document OCR when no cloud key is configured. Loading it would evict the resident `llama3:8b`; cloud vision is always preferred. Menu-parse now uses NIM `meta/llama-3.2-11b-vision-instruct` as primary (NVIDIA-VISION-WIRE-1, 2.5–5.4 s), with OpenRouter `google/gemini-2.5-flash-lite` as fallback A and `llava:7b` as fallback B (no cloud keys).

### Model Tiers
Models map to tiers (`junior` / `assistant` / `senior` / `council`) that control UI labels in the chatbot widget. See `lib/ai/modelTiers.ts` for the full map and `getTierUI(modelName)` for label strings.

`chatCompleteWithMeta()` in `app/api/aiClient.ts` wraps `chatComplete()` and also returns `{ source, coldStart, model }`. Use it when the calling route needs to know which provider actually responded. `POST /api/chat` uses this and forwards `tier`, `tierUI`, `source`, `coldStart`, and `localExpected` to the widget.

The Ollama caller has two timeout budgets (`OLLAMA_CONNECT_TIMEOUT`=45s, `OLLAMA_GEN_TIMEOUT`=90s as of LOCAL-AI-FIX-1): connection errors or no-response-within-connect-timeout fall through to cloud immediately; a slow-but-responding cold load (19-32s time-to-first-byte measured on the 3050) is allowed up to the generation timeout before falling through. See `FIX-OLLAMA-TIMEOUT-1` in CLAUDE.md's Known Footguns.

### Companion System (Phase 1 — Foundation)
The Companion is a periodic AI-initiated conversation layer that builds a `UserCompanionProfile` for each user over time. It tracks five pillars: Time, Health/Energy, Drive type, Hobbies, and Location. Profile data is injected into every chat system prompt for personalised responses.

Key files:
- `lib/companion/signalParser.ts` — extracts structured signals (health flags, drive signals, time signals) from raw chat text
- `lib/companion/arcStateMachine.ts` — manages arc progression (stages 0–7+) and produces the stage instruction injected into AI system prompts
- `app/api/companion/session/route.ts` — `POST` updates the profile from a message, advances arc stage, recomputes energy state
- `app/api/companion/nudge/route.ts` — `GET` is **read-only**: checks `nudgeDueAt`, returns `{ nudgeDue, message }`, no writes. `POST` is the **acknowledge** action: advances `nudgeDueAt` (energy-state-based delay), idempotent. The ChatBot widget calls GET on mount to show/hide the red dot; calls POST when companion opens or banner is dismissed.
- `app/api/aiClient.ts` — `buildCompanionContext()` builds the profile block injected into all chat system prompts
- `ai-context/COMPANION_PHILOSOPHY.txt` — AI instruction file for companion session behaviour

Arc stages: 0 (invite) → 1 (time) → 2 (health) → 3 (drive) → 4 (hobbies) → 5 (location) → 6 (ideas) → 7+ (ongoing check-ins)

Energy states: `charged` / `grounded` / `stretched` / `depleted` — controls suggestion density and tone.

**Phase 2** (built): red dot on chat bubble; nudge banner on `/app/home`; both entry points open companion mode in place with a seeded greeting already visible in the widget — no navigation, no separate page. Tapping the red-dot bubble calls `openCompanion(true)`; banner "Let's chat" dispatches `charaivati:open-companion`. Both produce identical UX: companion mode + seeded greeting + nudge acknowledged.
**Phase 3**: energy state display in Personal tab, hobbies on public profile.
**Phase 4**: friend matching (`lib/companion/friendMatcher.ts`), location geocoding.

### Council Feature (Phase 1 — Deliberation)
The Council is always user-triggered — no auto-routing. Entry points: (1) "⚖️ Ask the Council" button at the bottom (uses current input OR last user message, with tooltip if neither); (2) inline "Ask the Council" prompt below regular responses when `isCouncilWorthy(userMessage)` is true.

`POST /api/council` streams NDJSON — sends one status + one position chunk per persona, then a final verdict chunk. The client reads the stream progressively: status lines appear one by one, persona cards render as each arrives, verdict+synthesis animate in when streaming completes. A [✕ Cancel] button is shown during streaming; cancels the fetch via AbortController. The route checks `req.signal.aborted` between each AI call.

- **Phase 1** (current): 3 personas + verdict + synthesis. No further user interaction.
- **Phase 2** (planned): user responds to one persona, drilling into a lens.
- **Phase 3** (planned): voting/consensus — personas agree or object to proposed actions.

See `CLAUDE.md` § Council Feature for the full structure, prompt design, and API shape.

### Cloud Fallback Chain
When Ollama is unreachable: **NVIDIA NIM** → OpenRouter → Groq → Vercel AI Gateway
All keys are in Vercel env vars. No action needed — fallback is automatic.

⚠️ NVIDIA NIM has a 40 rpm rate limit on the current account (CHARAIVATI.FORWARD@GMAIL.COM).
NIM is for interactive single-user fallback only — never batch jobs or loops.

### Adding a New AI Route
1. Import `chatComplete` from `@/app/api/aiClient`
2. Use `CHAT_AI_MODEL` or add a new `*_AI_MODEL` env var
3. Build system prompt with user context (drives, goals, energy)
4. Fire single POST on explicit user action — don't auto-fire on load
5. Add the env var to both `.env.local` and Vercel

### Document Reader (PDF/Word ingestion)
`npm install` picks up `pdf-parse` and `mammoth` — both pure-JS / prebuilt-binary, no system dependencies (e.g. no `poppler`) needed. PDF text extraction uses `unpdf`; `pdf-parse` is kept only for `getScreenshot()` (OCR page rendering). DOCX uses `mammoth.extractRawText()`.

Optional env vars (sensible defaults — nothing required to add for a normal `npm install` + dev run):
- `DOC_OCR_FALLBACK_MODEL` — **primary** OCR vision model via OpenRouter (cloud), used whenever `OPENROUTER_API_KEY` is set. Default `anthropic/claude-haiku-4-5`.
- `DOC_OCR_VISION_MODEL` — local Ollama vision model for scanned-page OCR, fallback only (no `OPENROUTER_API_KEY`). Default `llava:7b`.

See `docs/modules/document-reader.md` for the full pipeline and `docs/modules/profile-sync.md` for the related chat→profile proposal flow.
