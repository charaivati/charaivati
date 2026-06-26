# Store Initiative System

<!-- Moved from CLAUDE.md (2026-06-26). Workflow, OSP, quotes, delivery dispatch, fleet, notifications. -->


### Data Models

**`Collaboration` (extended)**
Added fields: `scope String @default("partner")` (`"team" | "third_party" | "partner"`), `initiativeId String?`, `teamRole String?` (`"founder" | "co_founder" | "ceo" | "partner" | "employee" | "custom"`), `customRole String?`. Promoting a Collaboration to `scope="team"` via `PATCH /api/initiative/[pageId]/team/[collaborationId]` makes it a team member. Scope `"partner"` is the default for external partners.

**`WorkflowStep`**
Fields: `initiativeId` (Page.id of the linked initiative), `name`, `sequence`, `assigneeType` (`"team_member" | "third_party"`), `quoteRequired Boolean`, `quoteTimeoutHours Int @default(24)`, `assignmentMode String @default("sequential")` (`"sequential" | "first_to_accept"`), `activityType String @default("normal")` (`"normal" | "delivery"`). Steps are ordered by `sequence`; `initiativeId` matches `store.pageId` for stores that have linked initiatives. **`assigneeId String?` and `assigneeIds String[]` are `@deprecated`** — use `WorkflowStepAssignee` rows instead (see below); kept for existing data only.

**`activityType` — normal vs delivery branching:** Controls how a step's *confirmation* behaves. `"normal"` steps advance the workflow to the next OSP without touching `deliveryStatus`; confirming one is lightweight (no sub-orders, no GPS handoff). `"delivery"` steps represent the dispatch point: confirming one sets `Order.deliveryStatus = "out_for_delivery"` and immediately calls `assignNextPartner` (which creates a sub-order and notifies the delivery partner). **Backfill rule:** the last step (highest `sequence`) per initiative is automatically set to `"delivery"`; all others default to `"normal"`. New steps added via the API default to `"normal"` until the owner changes them. `activityType` was added via migration `20260605000000_add_workflow_activity_type` — use `$queryRaw` to read it while the Prisma client is stale.

**`WorkflowStepAssignee`**
Replaces the deprecated `assigneeId`/`assigneeIds` scalar fields on `WorkflowStep`. One row per (step, collaboration) pair. Fields: `stepId`, `collaborationId` (Collaboration.id), `sequence Int` (controls order in sequential cycling), `costPerOrder Float?`, `costPerKg Float?`, `costPerKgPerKm Float?`, `costPerItemPerKm Float?`. `@@unique([stepId, collaborationId])`. Cascade-deletes when the step or collaboration is removed. Cost fields override the same-named fields on `Collaboration` for this assignee's cost calculation.

**`OrderStepProgress` (OSP)**
One row per (Order, WorkflowStep) pair. `status`: `"pending" → "active" → "confirmed" | "failed"`. `@@unique([orderId, stepId])`. Created in bulk by `activateWorkflow`; the active step drives delivery assignment and quote requests. Additional fields for partner cycling: `currentAssigneeId String?` (the `WorkflowStepAssignee.id` currently being tried), `cycleCount Int @default(0)` (how many full rejection cycles have completed), `lastFeeMultiplier Float @default(1.0)` (fee multiplier for the current cycle; increases 5% per cycle).

**`Quote`**
One row per (Order, step, party). `requestedPartyId` is a `Collaboration.id`. `status`: `"pending" → "submitted" → "accepted" | "rejected"`. `expiresAt` is set to `now() + quoteTimeoutHours`. `Order.quoteSummary Json?` stores the owner-preferred ordering `[{ quoteId, partyName, amount, status }]`.

**`Order` (new fields)**
`requiresAttention Boolean @default(false)` — set when a step fails or a quote times out; visible as a red banner in the owner order page. `quoteSummary Json?` — rebuilt sorted by amount on every quote response. `parentOrderId String?` — self-FK; set on sub-orders created per workflow step. `subOrderType String?` — `"delivery" | "service" | "packaging"`. `agreedAmount Float?` — the accepted quote amount or fixed assignment fee for a sub-order.

**`Notification`**
Fields: `id`, `userId` (FK → User, cascade delete), `type` (`"order_assigned" | "quote_requested" | "quote_submitted" | "step_confirmed" | "order_confirmed" | "out_for_delivery" | "delivery_complete" | "order_cancelled" | "escalation" | "workflow_attention" | "collaboration_ended" | "collaboration_request" | "friend_reminder" | "request_broadcast_created" | "request_response_submitted" | "request_accepted" | "request_rejected"`), `title`, `body`, `link String?`, `read Boolean @default(false)`, `createdAt`. Index on `userId` and `createdAt`. (The four `request_*` types are the REQBCAST-1c broadcast-engine notifications — see `### Request Broadcast Engine`.) (`type` is a plain `String` column, not a DB enum — `collaboration_ended` was added by `softDeleteStore` for the partner-notified-on-venture-close flow; see `### Store Soft-Delete`.) `collaboration_request` (COLLAB-INVITE-NOTIFY-1) is fired by `POST /api/collaboration` to the receiver page's owner when a page-to-page partner request is created — links to `/earn/initiative/[receiverPageId]?tab=partners`. Fire-and-forget; failures don't fail collaboration creation. `friend_reminder` (PRIV-ACT-1) is fired by `POST /api/listen/actions/reminder` — the Listener's deterministic reminder action — to an existing friend; `body` is the sender's reminder text, `title` is `"Reminder from {senderName}"`, no `link`. **`POST /api/initiative/[pageId]/team/invite-user` (direct friend → team-member, auto-`accepted`) does NOT notify** — flagged as a follow-up, not fixed here. Feature A's `POST /api/invite` (email friend invite) and `POST /api/admin/users` deliberately do not send this notification type — unrelated flows with their own (generic-response / admin-log) patterns.

### Helper Files

| File | Purpose |
|---|---|
| `lib/workflow/activateWorkflow.ts` | Called when `Order.status → "confirmed"`. Creates all OSP rows as `"pending"`, activates step 1. For **normal** steps: calls `assignNormalStep` (set currentAssigneeId + notify, no sub-order). For **delivery** steps: activates OSP only — confirm route handles dispatch. For quote steps: fires `triggerQuoteRequests`. |
| `lib/workflow/advanceToNextStep.ts` | Called after a **normal** step is confirmed. Finds the next step by sequence, activates its OSP. If the next step is **normal**: calls `assignNormalStep`. If the next step is **delivery**: activates OSP only (confirm route dispatches). If no next step: returns (customer confirm sets `"delivered"`). Never touches `deliveryStatus`. |
| `lib/workflow/assignNormalStep.ts` | Assigns the first `WorkflowStepAssignee` (by sequence) to a normal step: sets `OSP.currentAssigneeId` and fires `order_assigned` notification (link: `/app/orders?tab=tasks`). Does **not** create sub-orders — the active OSP row is itself the confirmable task record, surfaced via `GET /api/orders/tasks` (TASK-SURFACE-1). Called by `activateWorkflow` and `advanceToNextStep` for normal steps. |
| `lib/workflow/assignNextPartner.ts` | Sequential partner cycling for **delivery** steps only. Reads `WorkflowStepAssignee` rows in `sequence` order. If all are rejected: increments `cycleCount`, applies 5% fee hike (`lastFeeMultiplier *= 1.05`), restarts from the top. After 3 full cycles: sets `requiresAttention = true`, fires `escalation` notification. Also calculates delivery cost, creates a sub-order, and notifies the partner. Called exclusively from the confirm route when `activityType === "delivery"`. |
| `lib/workflow/triggerQuoteRequests.ts` | Creates `Quote` rows for all parties in `assigneeId + assigneeIds`, sends a system chat message (`iv="system"`) to each party, fires a `quote_requested` notification, and registers an in-process `setTimeout` to reject un-responded quotes after `quoteTimeoutHours`. |
| `lib/workflow/createSubOrder.ts` | Creates a child `Order` row for a workflow step assignee (copies parent items/address, sets sub-order type and agreed amount), then fires an `order_assigned` notification. Called from `assignNextPartner` (delivery steps) and from `accept/route.ts` (quote steps). Idempotent. |
| `lib/workflow/calculateDeliveryCost.ts` | Computes delivery cost from `{ costPerOrder, costPerKg, costPerKgPerKm, costPerItemPerKm }` pricing fields plus `totalWeightKg`, `totalItems`, `distanceKm`. Returns 0 if all pricing fields are null. Called by `assignNextPartner`. |
| `lib/workflow/ensureOwnerAssignee.ts` | `ensureOwnerAssignee(pageId, stepId)` — idempotent. Finds or creates a self-team `Collaboration` (`scope="team"`, `teamRole="founder"`, `receiverUserId=page.ownerId`) and a `WorkflowStepAssignee` row (sequence=0) for the given step. Called by `activateWorkflow` and `advanceToNextStep` when a normal step has no configured assignees. Backfill existing steps via `scripts/backfill-owner-assignees.ts`. |
| `lib/geo/haversine.ts` | `haversineKm(lat1, lng1, lat2, lng2)` — great-circle distance in km. Used by `assignNextPartner` to measure store-to-delivery-address distance. |

### Key Flows

**Order confirm → workflow activate**
1. `PATCH /api/store/orders/[orderId]` sets `status="confirmed"`
2. `activateWorkflow(orderId)` fires fire-and-forget
3. All OSP rows created as `"pending"`; step 1 set `"active"`
4. If step 1 is `activityType === "normal"` (non-quote): `assignNormalStep` sets first assignee + notifies (no sub-order, no `deliveryStatus` change)
5. If step 1 is `activityType === "delivery"`: OSP activated only — owner confirms when ready to dispatch

**Normal step confirm → auto-advance**
1. `PATCH /api/order/[id]/step/[stepId]/confirm` (owner or step assignee; confirmed by WSA-row check first, deprecated scalar fallback)
2. OSP row set `"confirmed"`; `advanceToNextStep` called
3. Next step OSP set `"active"`. If next step is `"normal"`: `assignNormalStep`. If next step is `"delivery"`: OSP activated only. Never sets `deliveryStatus`.
4. If next step has `quoteRequired=true`: `triggerQuoteRequests` fires immediately

**Delivery step confirm → dispatch**
1. `PATCH /api/order/[id]/step/[stepId]/confirm` — **owner only** (delivery steps have no pre-assigned partner)
2. OSP row set `"confirmed"`; `Order.deliveryStatus = "out_for_delivery"`
3. `assignNextPartner` runs: cycles through `WorkflowStepAssignee` rows, picks first available partner, creates sub-order, notifies partner

**Quote → lowest auto-sort → founder accept**
1. Parties submit via `POST /api/order/[id]/quote/[quoteId]/respond { amount }` — `quoteSummary` rebuilt sorted by amount ascending
2. Owner drags to reorder preference via `PATCH /api/order/[id]/quote-order`
3. Owner accepts via `POST /api/order/[id]/quote/[quoteId]/accept` — all others rejected, step confirmed, `advanceToNextStep` called

**Delivery GPS → customer confirm**
1. Partner's step becomes active → `deliveryStatus = "out_for_delivery"`, `partnerStatus = "assigned"`
2. Partner accepts → `partnerStatus = "accepted"`; opens GPS modal in `/earn/deliveries`
3. Partner starts GPS (`Broadcaster` → `/api/transport/broadcast`), links vehicle via `PATCH /api/order/[id]/delivery { vehicleId }`
4. Customer polls `GET /api/order/[id]/delivery` every 5 s on `/order/[id]/track`; sees live map when `vehicleId` set
5. Partner confirms: `PATCH /api/order/[id]/step/[stepId]/confirm` → `partnerAction: "complete"` → `partnerStatus = "completed"`
6. Customer sees "Confirm you received this order?" prompt; clicks → `POST /api/order/[id]/customer-confirm` → `deliveryStatus = "delivered"`

**Partner rejection → owner retry**
1. Partner rejects: delivery route sets `partnerStatus = "rejected"`, `requiresAttention = true`, marks active OSP `"failed"`
2. Owner sees red rejection panel in WorkflowSection; picks reassignment from partner dropdown
3. Owner clicks "Retry Step" → `PATCH /api/order/[id]/step/[stepId]` → OSP reset to `"active"`, `requiresAttention = false`, `partnerStatus = "assigned"`

**Delivery block flow (internal employee assignment)**
1. Workflow step activates → `assignNextPartner` runs → `createSubOrder` called with `assigneeUserId = partnerUserId`
2. `createSubOrder` finds the partner's store (`Store WHERE ownerId = assigneeUserId`), queries its delivery blocks (`serviceType = "delivery"`)
3. Cost calculated from first block's `price` + `perKgRate × weight` + `perKmRate × distance`; sub-order created in partner's store with `status = "pending"`, `userId = customer`
4. Partner sees the sub-order in `/store/[id]/orders`; selects a delivery block from "Assign Employee" dropdown → `PATCH /api/order/[id]/delivery { partnerAction: "assign_block", blockId }` → `partnerStatus = "accepted"`, `deliveryStatus = "processing"`
5. Employee (`block.assignedUserId`) receives `order_assigned` notification and sees the order in `/earn/deliveries` (LATERAL JOIN on items JSON → Block.assignedUserId)
6. Employee starts GPS → customer tracks → customer confirms receipt → `POST /api/order/[id]/customer-confirm` sets `deliveryStatus = "delivered"`
7. `customer-confirm` detects `parentOrderId`, confirms the parent's active OSP, calls `advanceToNextStep(parentOrderId, stepId)` — parent order workflow continues

### Notifications

`Notification` rows are created by `lib/notifications/createNotification.ts` in these places:
- **`triggerQuoteRequests`** → `type: "quote_requested"` to each party when a quote-step activates
- **`confirm/route.ts`** (step confirm) → `type: "order_assigned"` to the next step's assignee (fire-and-forget)
- **`store/orders/[orderId]/route.ts`** (confirm order) → `type: "order_confirmed"` to the store owner **and** to the buyer; `type: "order_cancelled"` to the buyer on cancellation. Guest buyers are skipped silently (`user.status !== "guest"` check).
- **`order/[id]/delivery/route.ts`** → `type: "out_for_delivery"` to the buyer when `deliveryStatus` becomes `"out_for_delivery"` (fires from both the owner path and the partner path). Guest buyers skipped.
- **`order/[id]/customer-confirm/route.ts`** → `type: "delivery_complete"` to the store owner (existing) **and** to the buyer. Guest buyers skipped.
- **`assignNextPartner`** → `type: "order_assigned"` to newly assigned partner; `type: "escalation"` to store owner when all partners reject after 3 full cycles
- **`order/[id]/step/[stepId]/confirm/route.ts`** → `type: "step_confirmed"` to the store owner **when the confirmer is not the owner** (fire-and-forget; triggers owner's SSE stream so order pages auto-refresh without a manual reload)

UI: `components/notifications/NotificationBell.tsx` — bell icon in `app/app/layout.tsx` top bar (left of avatar, only shown when logged in). Uses SSE stream (`GET /api/notifications/stream`) for real-time updates; falls back to 10 s polling + `visibilitychange` trigger when EventSource is unavailable. Red badge shows `unreadCount`. Click opens a dropdown of 10 most recent; "See all →" links to `/app/notifications`. Full page: `app/app/notifications/page.tsx` — groups by Today / Yesterday / Earlier; "Mark all read" button.

**Auto-refresh surfaces (LIVE-REFRESH-1)** — all reuse the same SSE stream (`GET /api/notifications/stream`); no second refresh system exists:
- **`/app/orders`** (`app/app/orders/page.tsx`) — subscribes; refreshes buyer orders + tasks on any SSE message
- **`/store/[id]/orders`** (page B, `app/store/[id]/orders/page.tsx`) — subscribes; refreshes order list on any SSE message (LIVE-REFRESH-1 fixed a dead type-filter bug; the handler previously parsed `data.type` which the stream never sends)
- **`/store/orders/all`** (page A, `app/store/orders/all/page.tsx`) — subscribes (added LIVE-REFRESH-1); lightweight orders-only re-fetch on any SSE message (pool/team data not reloaded — it doesn't change mid-session)
- **`/order/[id]/track`** (customer tracking, `app/order/[id]/track/page.tsx`) — uses `setInterval` polling on `GET /api/order/[id]/delivery` every 5 s (2 s when out-for-delivery); already auto-refreshes; **deliberately NOT wired to SSE** — customer sees status only, no internal steps, and the existing poll is sufficient
- **SSE trigger for step-confirm**: when a non-owner confirms a normal step, `step_confirmed` notification fires to the store owner → owner's SSE stream detects new notification → pages A and B both re-fetch automatically

### Initiative Hub Tabs (owner-only at `/earn/initiative/[pageId]`)

| Tab | Component | Access |
|---|---|---|
| Overview | inline in `InitiativeTabs` | all |
| Store | inline in `InitiativeTabs` | all |
| Team | `components/earn/TeamTab.tsx` | canEdit = founder / co_founder |
| Partners | `components/earn/PartnersTab.tsx` | all |
| Workflow | `components/earn/WorkflowTab.tsx` | canEdit = founder / co_founder |

`canEdit` is derived in `InitiativeTabs` by fetching `GET /api/initiative/[pageId]/team` and reading `userTeamRole`. `null` (owner without explicit team record) → `canEdit = true`.

**Team tab — two invite paths:**
- **From Partners** (existing): promotes an accepted partner-scope `Collaboration` (page-to-page) to `scope="team"` via `PATCH /api/initiative/[pageId]/team/[collaborationId]`.
- **Invite Friend** (new): directly creates a `scope="team"` `Collaboration` with `receiverUserId` set via `POST /api/initiative/[pageId]/team/invite-user { userId, teamRole, customRole? }`. Only friends of the page owner are eligible. The collaboration is created with `status="accepted"` (no request flow needed). Removing a user-type team member calls `DELETE /api/initiative/[pageId]/team/[collaborationId]` (not PATCH, since there's no partner scope to demote back to).

**Team member card rendering** — cards check `member.receiverUserId`: if set, shows the `receiverUser.name` and `receiverUser.avatarUrl` (user-type); otherwise shows `receiverPage.title` and `receiverPage.avatarUrl` (page-type, existing behaviour).

**`GET /api/initiative/[pageId]/team` response** now includes `friends: FriendUser[]` — the owner's accepted friends not already added as user-type team members. Used to populate the "Invite Friend" tab in the modal.

**Fleet initiative type** — when `pageType === "fleet"`, `InitiativeTabs` renders a dedicated `FleetTabs` branch (Overview / 🚛 Services / Partners / Workflow) instead of the standard Store tab. The "Services" tab renders `components/earn/FleetEditor.tsx`.

### Fleet Initiative Type

A Fleet initiative (`pageType = "fleet"`) represents a delivery service, cab, bike rental, or any vehicle-based fleet business. It is **not a product store** — it contains only service blocks (delivery blocks with `serviceType = "delivery"`).

**Key differences from a Store initiative:**
- No sections, tiles, bulk image upload, or product blocks
- Owner editor is inline in `app/fleet/[pageId]/page.tsx` itself (an "✏️ Edit Fleet" floating toggle on the same page) — `components/earn/FleetEditor.tsx` is **deprecated**, logic moved here
- Public page lives at `/fleet/[pageId]` (client-rendered; owner sees edit controls, visitors see a booking flow — see below)
- Blocks are still `StoreBlock` rows (with `serviceType = "delivery"`) linked to a hidden backing store — reuses all existing block/delivery APIs

**Data model:**
- `Page.pageType = "fleet"` — the discriminator
- A `Store` row is created automatically the first time `GET /api/fleet/[pageId]` is called by the owner
- One hidden `StoreSection` ("Fleet Services") is created automatically as the block container
- All blocks belong to this single section; the section is not exposed in the editor UI

**API:**
- `GET /api/fleet/[pageId]` — owner: returns `{ storeId, sectionId, blocks[], deliveryFee, freeDeliveryAbove, acceptingOrders, page }`. Creates store + section if absent. Public visitor (no auth): same shape minus `storeId/sectionId` — their absence is how the client derives `isOwner`.
- Block CRUD uses the existing `/api/block` (POST/PATCH/DELETE) — same as product blocks, no new routes needed.
- Global delivery fee saved via existing `PATCH /api/store/[id]` — same as store delivery fee.

**DeliveryBlock is shared between STORE and FLEET initiative types.** The `AddDeliveryBlockModal`/`EditDeliveryBlockModal` logic that originally lived in `app/store/[id]/page.tsx` is replicated inside `app/fleet/[pageId]/page.tsx` (`AddBlockModal`/`EditBlockModal`). Do not extract them until there is a third consumer.

**Team tab (FLEET-TEAM-1)** — Fleet initiatives now show a "Team" tab in `InitiativeTabs.tsx`, identical mechanism to Store's Team tab (`<TeamTab pageId={pageId} canEdit={canEdit} />`, same `GET/PATCH /api/initiative/[pageId]/team*` routes). No change was needed in `TeamTab.tsx` or its API — both are keyed purely on `Page.id`/`Collaboration.initiativeId`, never on `pageType` or `Store`. The only gate was the hardcoded `tabs` array in `InitiativeTabs.tsx` excluding `"team"` for `pageType === "fleet"`; adding the tab entry was sufficient.

**"Fleet on Service" toggle (FLEET-ORDER-1)** — same mechanism as Store's "Taking orders": reuses `Store.acceptingOrders` + `PATCH /api/store/[id] { acceptingOrders }` unchanged, just relabeled and rendered in the Fleet tab of `InitiativeTabs.tsx` instead of the Store tab. The store-status fetch effect (`storeOpen`/`storeLocation`/`storeVpa`) now runs for `activeTab === "fleet"` as well as `"store"`.

**Booking flow (FLEET-ORDER-1)** — customers can now book a fleet service directly from `/fleet/[pageId]` instead of hitting a dead "Enquire →" mailto-style link:
- `POST /api/fleet/[pageId]/book` (new route) — `{ blockId, startLat, startLng, startLabel, dropLat, dropLng, dropLabel, weightKg? }`. Rejects with 422 if the fleet isn't "on service" (`acceptingOrders`) or deleted, 404 if the block isn't a public delivery block on that store. Computes price from the block's existing `pricingModel` (`fixed` / `per_km` / `per_kg_km`) using **real distance** between start and drop (`haversineKm`) — never a flat product price. Creates a normal `Order` row (status `"pending"`, same shape as a Store order) and notifies the owner (`order_confirmed`), so everything downstream (owner's orders page, partner/employee assignment, GPS tracking, customer tracking page, invoicing) is the existing Order/workflow machinery, unchanged.
- **No schema migration** — `Order.addressId` is a required FK, so a minimal `Address` row is synthesized from the drop point (`# ponytail: drop point uses a throwaway Address row instead of new Order columns — revisit with a real pickup/drop schema if fleet bookings need richer querying later`). The start point is recorded inside `Order.items` (already documented as a flexible JSON snapshot, not a strict schema).
- **Location picking UI** (`app/fleet/[pageId]/page.tsx` — `BookModal`/`LocationField`) reuses `geocodeSearch()` from `lib/geo/geocode.ts` (the same Photon text-search already used by the Errand request flow) — type a place, pick from up to 5 results. No map, per the standing no-map-by-default preference.
- Visitors see a "Fleet on Service" / "Not taking bookings right now" banner and each service's button reads "Book →" or greys out to "Closed" depending on `acceptingOrders` — mirrors the Store buyer-facing open/closed banner pattern (see `### Store Open/Closed Status`).

**Discovery entry point (FLEET-DISCOVER-1)** — `/app/saved` Browse → Stores now surfaces Fleet ventures (🚛 badge, "Book →" linking to `/fleet/[pageId]`) via `GET /api/store/all?includeFleet=1` — see `### Store Discovery` above. `/app/discover`'s map still has no fleet entry point.

**KNOWN GAP — fleet services are still invisible on the generic customer Store page (`/store/[id]`)**, see the dedicated footgun entry below. Do not assume `/store/[id]` and `/fleet/[pageId]` show the same thing for a fleet initiative — they currently don't. (`/app/saved`'s fleet cards already link to `/fleet/[pageId]` correctly; the residual risk is only a hand-built or shared `/store/{storeId}` URL.)

### Known Production Risks

- **Quote timeouts use in-process `setTimeout`** (`lib/workflow/triggerQuoteRequests.ts`) — does not survive server restarts. Replace with BullMQ before production.
- **Chat system messages stored as plaintext** — `ChatMessage` rows with `iv = "system"` contain the raw text in `ciphertext`. Chat renderers must check `iv === "system"` and skip ECDH decryption. See `### Chat System Messages` above.
- **`ALLOW_TEST_BYPASS=true` must never reach production** — only in `.env.local`. The bypass bypasses JWT auth entirely using a plain user ID header.
- **`WorkflowStepAssignee` and OSP new fields require `(prisma as any)`** — `WorkflowStepAssignee`, `OrderStepProgress.currentAssigneeId`, `cycleCount`, `lastFeeMultiplier` were added after the last successful `prisma generate`. Use `(prisma as any)` casts until generate runs. Run `npx prisma generate` after stopping the dev server.
- **`assignNextPartner` escalation after 3 cycles is silent to the partner** — only the store owner receives the `escalation` notification. The OSP is left as `"active"` with `requiresAttention = true`. Owner must manually reassign or the order stalls.
- **`createSubOrder` uses the first delivery block found for cost calculation** — if a partner has multiple delivery blocks (e.g., bike vs. van), the first one by `createdAt` is used and the partner may need to reassign. Wire block selection to `WorkflowStepAssignee` before production to let the workflow choose the correct block per step.
- **`/earn/deliveries` queries must use `DISTINCT ON (o.id)`** — the `LEFT JOIN "Address" pa ... AND pa."isDefault" = true` can fan-out a single order into multiple rows when more than one address row has `isDefault = true` for the store owner (TOCTOU race in the address POST/PATCH lets two rows both be default simultaneously). All four raw-SQL queries in `app/earn/deliveries/page.tsx` use `SELECT DISTINCT ON (o.id) ... ORDER BY o.id, o."createdAt" DESC` to collapse duplicates. **Root cause (lower-priority follow-up):** the non-atomic updateMany-then-write in the address routes can produce two isDefault rows; fix with a Postgres partial unique index `CREATE UNIQUE INDEX ... ON "Address"("userId") WHERE "isDefault" = true` (not native Prisma — needs raw SQL migration) or wrap both writes in a transaction.
- **Sub-order uniqueness enforced at DB level; `createSubOrder` handles P2002 gracefully** — `Order` has `@@unique([parentOrderId, userId, subOrderType])` (applied via `db push`, no migration file — same precedent as `deletedAt`). Postgres treats NULL as distinct so regular orders (parentOrderId = NULL) are unaffected. A concurrent double-confirm that races past the `findFirst` guard hits the unique index and throws P2002; the inner catch in `createSubOrder` detects `err?.code === "P2002"` and returns 0 (already created) instead of a 500.
- **`/api/user/me` returns `{ ok: true, user: { id, name, ... } }` — user data is nested under `user`, not at the top level. Always access `json.user.id`, not `json.id`.**

### Navigation Map

**Owner flow**
```
/store/account → /store/orders/all?storeId=X → /store/[id]/orders → /store/[id]/orders/delivered
/store/[id] (store page) → "Manage Orders →" → /store/[id]/orders
/store/[id]/orders → "Initiative & Workflow →" → /earn/initiative/[pageId]
```

**Delivery partner flow**
```
/app/orders?tab=my → "Deliver 🚚" → /earn/deliveries
```

**Customer flow**
```
/app/orders?tab=my → "Track 📍" → /order/[id]/track → "← My Orders" → /app/orders?tab=my
```

**Third-party (quote) flow**
```
Notification → /app/orders?tab=requests → submit quote → accepted → /app/orders?tab=my
```

### Deferred Features (do not rebuild)

- **Quote system for delivery steps**: removed. Quotes only apply to third_party non-delivery steps.
- **BullMQ for quote timeouts**: currently in-process `setTimeout`. Replace before production.
- **Uber-like cab booking**: delivery blocks with `per_km` pricing are bookable directly by customers from the store page. Full fleet management (multiple employees, availability, surge pricing) deferred.

### Active (Previously Deferred) Features

- **Delivery cost calculation** — now wired into `lib/workflow/assignNextPartner.ts`. Pricing comes from `WorkflowStepAssignee` cost fields (`costPerOrder`, `costPerKg`, `costPerKgPerKm`, `costPerItemPerKm`). Weight from `Block.weight Float @default(1)`. Distance from `haversineKm(storeOwnerDefaultAddress, orderDeliveryAddress)` using `Address.lat/lng`. If any price field is null the whole calculation returns 0 (free). The per-assignee `WorkflowStepAssignee` cost fields take precedence over Collaboration-level cost fields.
- **Address GPS coordinates** — `Address.lat Float?` / `Address.lng Float?` are now captured by `components/shared/AddressForm.tsx` (pincode → Nominatim geocode or drag-pin map) and persisted via `POST/PATCH /api/store/address`. Both create and update routes accept optional `lat`/`lng` in the request body.

