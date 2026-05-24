# Loading State Conventions

Established during the May 2026 loading-state audit. All new pages and components must follow these patterns.

---

## 1. Skeleton pattern (preferred over spinners)

Use `animate-pulse` placeholder blocks shaped to match the actual content.

**Rules:**
- Match the real layout's dimensions and grid as closely as possible — width, height, border-radius, gap
- Use `#E2E8F0` for primary placeholder lines (title, amount)
- Use `#F1F5F9` for secondary lines (body text, faded badges, buttons)
- Never use a full-screen blank page; always render the shell (nav, header) as real content while only the data area pulses

**Order card skeleton (canonical example):**
```tsx
function OrderCardSkeleton() {
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div className="animate-pulse" style={{ width: 110, height: 14, borderRadius: 6, background: "#E2E8F0" }} />
        <div className="animate-pulse" style={{ width: 72, height: 20, borderRadius: 99, background: "#F1F5F9" }} />
      </div>
      <div className="animate-pulse" style={{ width: "65%", height: 12, borderRadius: 4, background: "#F1F5F9", marginBottom: 10 }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="animate-pulse" style={{ width: 56, height: 14, borderRadius: 4, background: "#E2E8F0" }} />
        <div className="animate-pulse" style={{ width: 76, height: 28, borderRadius: 6, background: "#F1F5F9" }} />
      </div>
    </div>
  );
}
```

**Notification row skeleton (canonical example):**
```tsx
function NotifRowSkeleton() {
  return (
    <div style={{ display: "flex", gap: 12, padding: "14px 16px", borderBottom: "1px solid #F3F4F6" }}>
      <div style={{ paddingTop: 6, flexShrink: 0, width: 8 }}>
        <div className="animate-pulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "#E2E8F0" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
          <div className="animate-pulse" style={{ width: "55%", height: 14, borderRadius: 4, background: "#E2E8F0" }} />
          <div className="animate-pulse" style={{ width: 36, height: 10, borderRadius: 4, background: "#F1F5F9", flexShrink: 0 }} />
        </div>
        <div className="animate-pulse" style={{ width: "80%", height: 12, borderRadius: 4, background: "#F1F5F9" }} />
      </div>
    </div>
  );
}
```

---

## 2. Button guard pattern (double-submit prevention)

Every async button action must:
1. Track loading state **per item** (not a global flag) — use `useState<string | null>(null)` keyed by item ID
2. Guard against double-fire at the top of the handler: `if (loading === itemId) return`
3. Set state before the fetch, clear it in `.finally()` (so errors don't leave the button stuck disabled)
4. `disabled={loading === itemId}` on the button element
5. Show a spinner (for high-visibility actions) or opacity change (for low-visibility actions) while in-flight

**Per-item guard (canonical example — used in `store/orders/all/page.tsx`):**
```tsx
const [advancing, setAdvancing] = useState<string | null>(null);

async function advanceStatus(itemId: string) {
  if (advancing === itemId) return;
  setAdvancing(itemId);
  try {
    await fetch(...);
  } finally {
    setAdvancing(null);
  }
}

<button
  disabled={advancing === item.id}
  style={{ cursor: advancing === item.id ? "not-allowed" : "pointer", opacity: advancing === item.id ? 0.6 : 1 }}
  onClick={() => advanceStatus(item.id)}
>
  ...
</button>
```

**Single-action guard (canonical example — used in `app/order/[id]/track/page.tsx`):**
```tsx
const [confirming, setConfirming] = useState(false);

function handleConfirm() {
  if (confirming) return;
  setConfirming(true);
  fetch(...).catch(() => {}).finally(() => setConfirming(false));
}

<button
  disabled={confirming}
  className="... disabled:opacity-70"
  onClick={handleConfirm}
>
  {confirming && <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
  {confirming ? "Confirming…" : "Confirm"}
</button>
```

**Low-visibility actions** (mark-read, soft toggles) — opacity change only, no spinner:
```tsx
<button disabled={markingAll} style={{ opacity: markingAll ? 0.5 : 1 }}>
  Mark all read
</button>
```

---

## 3. loading.tsx convention

Every route that is NOT a `"use client"` dynamic component must have a `loading.tsx` sibling. This covers Suspense boundaries during navigation.

The `loading.tsx` file should:
- Mirror the page's outer shell (background, max-width container, sticky header placeholder)
- Replace data-driven content with skeletons
- Not import any server-only libraries or session utilities

**Routes with loading.tsx (as of May 2026):**
| Route | File |
|---|---|
| `app/app/saved/` | `app/app/saved/loading.tsx` |
| `app/app/initiatives/` | `app/app/initiatives/loading.tsx` |
| `app/app/orders/` | `app/app/orders/loading.tsx` |
| `app/app/notifications/` | `app/app/notifications/loading.tsx` |

**Routes still missing loading.tsx (known gaps):**
- All `app/store/` routes
- `app/fleet/[pageId]/`
- `app/(with-nav)/self/`

---

## 4. What NOT to do

| Anti-pattern | Replace with |
|---|---|
| `<div>Loading...</div>` text | Skeleton matching content dimensions |
| Full-screen centered spinner | Skeleton of actual page layout |
| `animate-spin` alone for page-level loading | Skeleton (spinner is fine for small inline feedback) |
| No `disabled` on async buttons | `disabled` + guard at top of handler |
| Global `isLoading` boolean for per-item actions | Per-item `useState<string \| null>(null)` keyed by ID |
| `setTimeout` to delay content reveal | Render skeleton while data is loading, swap when ready |
| `opacity-50` without `disabled` | Always add `disabled` alongside opacity change |

---

## 5. Spinner usage (acceptable cases)

Spinners are acceptable — and preferable to skeletons — for:
- **Inline button feedback** while async action is in-flight (small, next to text)
- **Tab or section sub-loading** when dimensions are unknown before data arrives
- **Long-running one-shot operations** (e.g. generating a PDF, running AI setup)

For these, use the project-standard inline spinner:
```tsx
<span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
```

Or in dark-on-light contexts:
```tsx
<span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #6366f1", borderTopColor: "transparent", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
```

(The `@keyframes spin` animation is either from Tailwind's `animate-spin` or defined inline with `<style>{...}</style>` when Tailwind classes are unavailable in an inline-style component.)
