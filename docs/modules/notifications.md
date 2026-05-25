---
module: notifications
type: library + api + component
source: lib/sendEmail.ts, lib/sendSms.ts, lib/notifications/createNotification.ts, app/api/notifications/, components/notifications/
depends_on: [database, auth]
used_by: [auth, user, workflow, store]
stability: stable
status: active
---

# Module: Notifications

This module covers two distinct systems:

1. **Transactional delivery** — email (Nodemailer/Gmail) and SMS (Twilio) for auth flows
2. **In-app notification system** — `Notification` DB rows, bell UI, SSE stream, notifications page

---

## Part 1: Email & SMS Delivery

### Purpose
Abstracts email and SMS delivery behind simple functions. Provides a provider pattern for SMS so Twilio can be swapped for a local/mock provider in development.

### Responsibilities
- Send transactional emails via Nodemailer/Gmail (verification, magic links, alerts)
- Send SMS messages via Twilio (OTP codes, alerts)
- Abstract SMS provider selection so dev environments avoid real SMS costs

### Key Functions

| Function | File | Role |
|---|---|---|
| `sendEmail()` | lib/sendEmail.ts | Send transactional email via Nodemailer/Gmail |
| `sendSms()` | lib/sendSms.ts | Send SMS via active provider |
| `TwilioProvider.send()` | lib/sms/providers/twilioProvider.ts | Twilio delivery implementation |
| `LocalProvider.send()` | lib/sms/providers/localProvider.ts | Dev no-op / console logger |

### Runtime Flow

**Email delivery**
1. Caller imports `sendEmail()` from `lib/sendEmail.ts`
2. Passes `{ to, subject, html?, text? }`
3. Function sends via Nodemailer SMTP (Gmail)
4. **Throws** if `EMAIL_USER`/`EMAIL_PASS`/`EMAIL_FROM` are not set — callers must wrap in try/catch
5. In dev with missing env vars, the register route logs the verification link to console before attempting the send

**SMS delivery**
1. Caller imports `sendSms()` from `lib/sendSms.ts`
2. Function selects `TwilioProvider` when `TWILIO_ACCOUNT_SID` is present, else `LocalProvider` (console log)
3. Provider selection happens at module load time — no runtime switching

### Dependencies
- `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` — Gmail SMTP credentials
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` — Twilio credentials

### Risks & Fragile Areas
- `sendEmail` throws on missing env vars — callers in `app/api/user/register/route.ts` and magic link routes must catch
- SendGrid API failures are not retried; transient failures require manual resend
- The local SMS provider logs to console only — OTP SMS cannot be tested without Twilio credentials

---

## Part 2: In-App Notification System

### Purpose
Push structured `Notification` rows to users when significant events occur (order placed, step assigned, quote submitted, delivery complete, workflow attention). Surface them via a bell icon in the mobile shell with real-time updates via SSE.

### Responsibilities
- Write `Notification` rows via `lib/notifications/createNotification.ts`
- Serve the latest 30 notifications per user (`GET /api/notifications`)
- Mark notifications read (`PATCH /api/notifications/read`)
- Push real-time count changes via Server-Sent Events (`GET /api/notifications/stream`)
- Render a bell icon with red badge in the mobile shell top bar
- Full notifications page grouped by Today / Yesterday / Earlier

### Notification Model

```
Notification {
  id         String   @id
  userId     String   (FK → User, cascade delete)
  type       String   (see types below)
  title      String
  body       String
  link       String?  (deep link — navigation target on tap)
  read       Boolean  @default(false)
  createdAt  DateTime
}
```

**Type values**: `order_confirmed`, `order_assigned`, `quote_requested`, `quote_submitted`, `step_confirmed`, `delivery_complete`, `escalation`, `workflow_attention`

### `createNotification()`

`lib/notifications/createNotification.ts` — `createNotification({ userId, type, title, body, link? })`

- Never throws — wraps DB write in try/catch and logs on failure
- Uses `(prisma as any).notification` because the Prisma client may be stale (model added via migration)
- Called fire-and-forget from workflow helpers; a failure does not abort the workflow

**Called from:**

| Caller | Event |
|---|---|
| `lib/workflow/triggerQuoteRequests.ts` | `quote_requested` — when a quote-step activates |
| `app/api/order/[id]/step/[stepId]/confirm/route.ts` | `order_assigned` — notifies next step's assignee |
| `app/api/store/orders/[orderId]/route.ts` | `order_confirmed` — notifies store owner on order confirm |
| `lib/workflow/assignNextPartner.ts` | `order_assigned` to partner; `escalation` to owner after 3 full rejection cycles; `workflow_attention` when a step has zero `WorkflowStepAssignee` rows |

### API Routes

| Method | Route | Action |
|---|---|---|
| GET | /api/notifications | Returns `{ notifications[], unreadCount }` — latest 30, newest first; auth required |
| PATCH | /api/notifications/read | `{ ids }` or `{ all: true }` — marks as read |
| GET | /api/notifications/stream | SSE stream — sends `data:` events on unread count change; heartbeat ping every 30 s |

### SSE Stream (`/api/notifications/stream`)

- Polls DB every 5 s for unread count changes
- Sends a `data: { unreadCount }` event when the count differs from last poll
- Sends a `data: ping` heartbeat every 30 s to keep the connection alive
- Connection drops handled by the client (EventSource auto-reconnects)
- **Client fallback**: `NotificationBell` also runs 10 s polling + a `visibilitychange` listener for environments where EventSource is unavailable

### UI Components

**`components/notifications/NotificationBell.tsx`**
- Bell icon rendered in `app/app/layout.tsx` top bar, left of avatar; hidden for logged-out users
- Subscribes to SSE stream on mount; on SSE event, refetches `GET /api/notifications` to get fresh list
- Red badge shows `unreadCount`; click opens dropdown of 10 most recent
- "See all →" navigates to `/app/notifications`

**`app/app/notifications/page.tsx`**
- Full notifications page; groups entries as Today / Yesterday / Earlier
- "Mark all read" button calls `PATCH /api/notifications/read { all: true }`
- Each row taps to `notification.link` (deep link) and marks the notification read

**`lib/utils/timeAgo.ts`**
- `timeAgo(iso)` — converts ISO timestamp to human-readable relative string ("5m ago", "3h ago", "2d ago")
- Imported by `NotificationBell` and the notifications page — do not copy inline

### SSE and the Orders Page

`app/store/orders/all/page.tsx` also subscribes to the SSE stream and auto-refreshes the order list when the backend fires any notification. This ensures the owner sees partner acceptance and step confirmations without manual refresh. A manual refresh button is also present in the sticky header.

### Timezone Note

`Notification.createdAt` timestamps are only accurate if `DATABASE_PRISMA_URL` includes `&options=-c%20timezone%3DUTC`. Without it, Neon's IST default shifts all timestamps 5:30 h forward and `timeAgo()` output appears hours wrong. See `CLAUDE.md` § Known Production Risks.

### Database Models Used
- `Notification` — uses `(prisma as any).notification`; requires `npx prisma generate` after the last migration to restore type safety

### Risks & Fragile Areas
- `createNotification` failures are silent (logged, not re-thrown). A failed write means the user never sees the notification but the workflow continues normally.
- The SSE stream holds an open HTTP connection per user — watch Vercel function concurrency limits under load.
- `(prisma as any).notification` cast is required until `npx prisma generate` runs successfully after the model was added via migration.

## Backlinks
- [[auth.md]] — OTP delivery and magic link email
- [[user.md]] — email verification delivery
- [[START_HERE.md]] — feature area starting points
