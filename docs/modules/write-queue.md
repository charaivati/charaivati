---
module: write-queue
type: library (client-side only)
source: lib/writeQueue.ts, components/WriteQueueBanner.tsx
depends_on: []
used_by: [app/store/[id]/page.tsx]
stability: stable
status: active
---

# Module: Write Queue

## Purpose
A **client-side only** optimistic write queue for network requests that may fail due to
connectivity loss. When a fetch to the server fails with a network error or 5xx, the request
is serialized to `localStorage` and retried automatically every 30 seconds and on reconnect.
The user sees a toast notification and a banner rather than a silent failure.

This is NOT a server-side queue, database write buffer, or background job system.
It runs entirely in the browser.

---

## What It Does

`resilientFetch(url, init, opts)` is the single entry point. It wraps `fetch`:

1. Attempts the request immediately
2. **If the request succeeds (2xx/3xx/4xx):** returns the result normally. Note: 4xx responses
   are treated as definitive failures — they are NOT queued for retry, because a 400/401/403/404
   means the request was understood but rejected. Only network errors and 5xx trigger queuing.
3. **If the request fails (network error or 5xx):** serializes the request to `localStorage`
   as a `QueuedRequest` and returns `{ ok: false, queued: true }`. Shows a warning toast.
4. The queue is flushed:
   - Every 30 seconds (polling interval)
   - When the browser fires the `online` event (connectivity restored)
   - Once on page load after a 1.5-second delay (to flush items from previous sessions)

Each item is retried up to 3 times (`MAX_ATTEMPTS`). After 3 failures, the item is dropped
and an error toast is shown. There is no exponential backoff — retries happen on the fixed
30-second interval.

---

## Inputs & Outputs

| Direction | Value |
|---|---|
| In | `url: string` — the fetch target |
| In | `init: RequestInit` — method, headers, body |
| In | `opts.label: string` — human-readable name shown in toasts |
| In | `opts.onSuccess: (data) => void` — callback fired on eventual success |
| Out | `{ ok: true, queued: false, data }` — immediate success |
| Out | `{ ok: false, queued: true }` — queued for retry |
| Out | `{ ok: false, queued: false }` — definitive failure (4xx) |

The `QueuedRequest` stored in `localStorage` contains:
`id`, `url`, `method`, `headers`, `body` (serialized string), `label`, `addedAt`, `attempts`.

---

## What Counts as "Non-Critical" (When To Use This)

Use `resilientFetch` instead of plain `fetch` when **all three** of these are true:

1. **The write is user-visible state that the user would notice losing** — e.g. saving a
   product title, reordering sections, updating a banner. If it's lost, the user would need
   to redo work.

2. **The write can safely be replayed later** — the request must be idempotent or
   order-insensitive. `resilientFetch` will retry without knowing what happened in between.
   A non-idempotent write (e.g. `POST /api/store/orders`) could be processed twice.

3. **A temporary network failure is plausible** — store editing on a mobile device or spotty
   connection is the primary use case.

**Do NOT use `resilientFetch` for:**
- Order creation (`POST /api/store/orders`) — non-idempotent; a duplicate retry creates a second order
- Auth operations — a failed login should immediately return an error, not silently queue
- Deletes where the resource may no longer exist on retry
- Any request where the response data is needed before rendering can continue
- Server-side code — this module uses `localStorage` and `window` and will crash on the server

---

## When To Use `db` Directly Instead

`lib/writeQueue.ts` has no server-side counterpart. On the server, all writes are done
directly through Prisma (`db` or `prisma`). There is no server-side batching or deferral
mechanism in this module.

For **server-side writes** that should be deferred or non-blocking, you would need a
different approach (job queue, background process). None exists currently in this codebase.

---

## Failure Semantics

| Scenario | Behavior |
|---|---|
| Network error on first attempt | Queued; warning toast shown |
| 5xx server error | Queued; warning toast shown |
| 4xx (client error) | NOT queued; `{ ok: false, queued: false }` returned immediately |
| Retry succeeds within 3 attempts | `onSuccess` callback called; success toast shown |
| 3 failed attempts | Item dropped; error toast shown; `onSuccess` never called |
| Browser closes before flush | Item persists in `localStorage`; flushed on next page load (1.5s delay) |
| `localStorage` full or unavailable | `saveQueue` silently no-ops; items are lost |

There is **no persistence guarantee**. `localStorage` can be cleared by the browser, the
user, or storage quota exhaustion. Do not use this for anything that must not be lost.

TODO: Confirm whether the 1.5-second startup flush is long enough for the session cookie
to be available before the queued requests fire (requests use `credentials: "include"`).
If the session expires between sessions, queued requests will return 401 on replay — which
is treated as a 4xx definitive failure and the item is dropped silently.

---

## Runtime Flow

```
resilientFetch(url, init, opts)
  │
  ├─ fetch(url, { ...init, credentials: "include" })
  │     │
  │     ├─ 2xx/3xx/4xx → return { ok: res.ok, queued: false, data }
  │     │
  │     └─ throw (network) or 5xx → enqueue
  │           │
  │           ├─ uid() → unique id
  │           ├─ serialize request to QueuedRequest
  │           ├─ saveQueue([...existing, item]) → localStorage
  │           └─ return { ok: false, queued: true }
  │
  └─ [background]
        ├─ setInterval(flushQueue, 30_000)
        ├─ window.on("online") → flushQueue()
        └─ setTimeout(flushQueue, 1500)  ← on page load

flushQueue()
  │  (flushing flag prevents concurrent runs)
  │
  ├─ for each item:
  │     ├─ tryRequest(item) → fetch with credentials: "include"
  │     ├─ ok → callbackRegistry.onSuccess(data), success toast, remove from queue
  │     └─ fail → increment attempts
  │           ├─ attempts < 3 → keep in queue
  │           └─ attempts >= 3 → drop, error toast
  │
  └─ saveQueue(remaining)
```

---

## Key Exports

| Export | Type | Role |
|---|---|---|
| `resilientFetch(url, init, opts)` | async function | Main entry point — wraps fetch with queue fallback |
| `getQueueCount()` | function | Returns current number of queued items |
| `subscribeToQueue(fn)` | function | Subscribe to queue length changes; returns unsubscribe |
| `QueuedRequest` | type | Shape of a queued item in localStorage |
| `ResilientResult` | type | Union return type of `resilientFetch` |

---

## UI Integration

`components/WriteQueueBanner.tsx` subscribes to the queue count via `subscribeToQueue`.
When `count > 0`, shows a fixed banner ("N unsaved changes — syncing…").
Also renders the `<Toaster>` (sonner) for all toast notifications.

This component must be rendered in the layout for queue feedback to be visible.
It is a `"use client"` component and mounts the toast provider.

---

## Current Usage in the Codebase

`resilientFetch` is called in `app/store/[id]/page.tsx` for store editing operations:
saving section/block edits, tile updates, banner saves, and learning content saves.
It is not used elsewhere in the codebase as of the last audit.

---

## Risks & Fragile Areas

- **Non-idempotent requests must never be queued.** The queue replays requests verbatim
  with no deduplication. A queued `POST /api/store/orders` would create a duplicate order.
- **Session expiry between sessions** renders queued 401-requiring requests permanently
  undeliverable. They are dropped silently after 3 failures.
- **localStorage is synchronous and blocking.** Under high-frequency saves, `saveQueue`
  on every call could cause jank. The current usage (manual save events) is fine; polling
  loops would not be.
- **The `flushing` flag is a module-level variable.** In a page with multiple tabs or
  iframes sharing the same origin, multiple flush loops could run. TODO: Confirm whether
  this is a concern in the Capacitor shell (which loads a single web page).
- **Headers are merged naively.** Only `Content-Type: application/json` is set by default;
  any additional headers from the original request's `init.headers` are merged via `new Headers()`.
  Custom auth headers (if any) are preserved, but dynamic headers that change per-request
  (e.g. a fresh CSRF token) will be stale on replay.

## Backlinks
- [[START_HERE.md]] — writeQueue.ts mentioned under Key Modules
- [[store.md]] — only current consumer of resilientFetch
