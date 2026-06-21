---
module: mobile-shell
type: component + config
source: app/app/layout.tsx, capacitor.config.ts
depends_on: [auth]
used_by: []
stability: fragile
status: active
---

# Module: Mobile Shell

## Purpose
Provides the native mobile app experience via Capacitor. The shell is a thin layout wrapper rendered at `/app/*` routes, consisting of a sticky header and a 4-tab bottom navigation bar. The Capacitor binary simply loads `https://charaivati.com/app/home` in a WebView — there is no separate native build beyond the shell wrapper.

## Responsibilities
- Render sticky header with branding and user avatar/sign-in
- Render 4-tab bottom navigation bar with safe-area insets
- Fetch and display current user state on mount
- Handle sign-out from within the mobile shell
- Provide the layout for all `/app/*` pages

## Inputs & Outputs

| Direction | Value |
|---|---|
| In | Current pathname (for active tab highlighting) |
| In | `/api/user/me` response (user identity for header) |
| Out | Rendered layout with header + bottom nav |
| Out | Sign-out action (clears cookie, redirects to login) |

## Dependencies
- **auth** — fetches user via `/api/user/me`; sign-out calls `/api/auth/logout`
- **Capacitor** — `capacitor.config.ts` defines the native app wrapping this web layout

## Reverse Dependencies (what breaks if this changes)
- This layout wraps **all** `/app/*` pages. A render error in this layout breaks the entire mobile app for all users.
- The 4 bottom tabs are hardcoded: Home (`/app/home`), Initiatives (`/app/initiatives`), Explore (`/app/saved`), Account (`/store/account`). Adding or removing tabs requires editing this file.
- `capacitor.config.ts` points to `https://charaivati.com/app/home`. Changing this URL re-targets the entire native app binary — existing installed apps will continue loading the old URL until they are rebuilt and redistributed.
- The header uses inline styles exclusively (no Tailwind). Layout regressions will not be caught by a Tailwind linter or class-name audit.
- The sign-out handler calls `lib/logout.ts`'s `getLogoutRedirect()` to determine where to redirect. If that function changes, mobile sign-out behavior changes.

## Runtime Flow

### Layout mount
1. Layout renders immediately with header and nav (no loading state for structure)
2. `useEffect` fires: `fetch('/api/user/me')` is called
3. If response is ok: user state is set (name, email, avatarUrl)
4. If response is not ok: user state remains null → header shows "Sign in" link
5. Avatar button displays first initial of name or email

### Navigation
1. `usePathname()` is called on each render
2. Each bottom tab compares its `href` against the current pathname via `startsWith`
3. Active tab gets indigo color (`#6366f1`), inactive tabs get muted gray

### Sign-out
1. User opens profile dropdown (avatar button)
2. Clicks "Sign out"
3. `handleSignOut()` calls `getLogoutRedirect(pathname)` for redirect target
4. Clears `sessionStorage['charaivati.redirect']`
5. POSTs to `/api/auth/logout`
6. Redirects to `/login?redirect=<encoded_path>`

## Key Components

| Element | Role |
|---|---|
| Header (`<header>`) | 56px sticky; `Wordmark` branding link + `AccountMenu` dropdown |
| Avatar dropdown | `components/nav/AccountMenu.tsx` — shared with `app/store/[id]/layout.tsx` (see below). First item is always "🏠 Home" → `/app/home`, then "My Account", "Language" (logged-in only), Sign out |
| Content wrapper (`<div>`) | `paddingBottom: 56px` (`pb-14 md:pb-0`) to clear bottom nav |
| Bottom nav (`<nav>`) | 56px fixed; 4 tabs with icon + label |

## Shared with `app/store/[id]` layout (LAYOUT-SYNC-1)
`app/store/[id]/layout.tsx` (store shell, a sibling route — not nested under `app/app/`) was brought into structural parity with this layout: same `Wordmark` logo, same bottom mobile tab nav, same `pb-14 md:pb-0` content wrapper, and the same `components/nav/AccountMenu.tsx` dropdown (rendered at both mobile and desktop breakpoints, since the store header keeps separate `md:hidden`/`hidden md:flex` blocks rather than this layout's single unconditional render). The store layout previously hand-rolled its own lowercase "charaivati" brand button and a separate `MobileProfileMenu` — both were removed in favor of `Wordmark`/`AccountMenu`.

`AccountMenu` takes an optional `storeContext` prop (`{ deliveryLabel, onOpenAddress, isOwner, storeId }`) — only the store layout passes it, adding delivery-address/My Orders/Manage Orders/My Businesses items into the same dropdown. The two layout files remain separate (not merged or re-exported); `app/store/[id]/StoreShellContext.tsx` is unchanged. No i18n in the store layout — `AccountMenu`'s `t` prop is optional and falls back to the English label when omitted.

## Language re-pick (MENU-LANG-1)
The avatar dropdown (logged-in variant only — not shown for guests) has a "🌐 Language" row: `<a href={`/?from=${encodeURIComponent(pathname)}`}>`. The landing page at `/` doubles as the language picker, so this row just round-trips there with a return address. Plain `<a>` (not a router push) is deliberate — a fresh mount makes `LanguageProvider` re-read from cookie/localStorage.

`app/page.tsx`'s logged-in mount-bounce (`router.replace("/self")`) is skipped when a valid `from` is present, so the grid renders instead of bouncing. After a pick, `setLanguage(code)` then `router.replace(validFrom)` returns the user to the page they came from instead of `/self`. `from` is validated by a same-file guard (`getValidFrom`) — accepted only if it starts with `/app`, doesn't start with `//` or `/\`, and contains no `http:`/`https:`/`javascript:` substring; anything else is treated as if no `from` was given (open-redirect protection — reject, don't sanitize).

`components/UserMenu.tsx` and `components/ProfileMenu.tsx` are NOT this dropdown (dead/divergent — see TECH_DEBT.md) and were not touched by this feature.

## Capacitor Configuration (`capacitor.config.ts`)
- `appId`: `com.charaivati.store`
- `appName`: `Charaivati Store`
- `webDir`: `public` (used for local static fallback only — production uses `server.url`)
- `server.url`: `https://charaivati.com/app/home` (live URL loaded in WebView)
- `server.androidScheme`: `https`

## Bottom Navigation Tabs

| Label | Icon | href |
|---|---|---|
| Home | 🏠 | /app/home |
| Initiatives | 🌱 | /app/initiatives |
| Explore | 🔍 | /app/saved |
| Orders | 🛍️ | /app/orders |

## Home Page Intent (`/app/home`)

`app/app/` is the mobile operating layer for the Earn system. The home page (`app/app/home/page.tsx`) has two distinct modes:

The home page has two render states based on auth:
- **Guest/new user** — static marketing content (existing JSX, unchanged): dedication section, network visual, hero text, two feature cards, CTA button, GST modal.
- **Returning user** — live dashboard: topbar with greeting (good morning/afternoon/evening + first name + avatar initials), stats row (orders today + revenue today with yesterday delta), pending orders list (up to 3 non-delivered orders with customer name, store, amount, status pill), initiatives list (all pages owned by the user via `kindLabel()`).

Data sources fetched in parallel on mount:
- `GET /api/user/me` — auth check and user name
- `GET /api/store/orders?all=true` — all seller orders; today/yesterday filtered client-side for stats; non-terminal orders shown in pending list
- `GET /api/user/pages` — user's initiatives for the initiatives section

If any fetch fails, stats show `"—"` rather than crashing. Guest users (`user.status === "guest"`) fall through to the guest/new-user state.

**Per-initiative order count is not yet on the home dashboard** — `Store.pageId` has no reverse relation in Prisma, so there is no efficient way to join pages → stores → orders in a single query. When needed, add `GET /api/store/orders/summary` returning `[{ pageId, pendingCount, totalToday }]`.

The home page is **not a marketing page** and should not contain static promotional copy, feature lists, or landing-page imagery. If it is not showing live data for returning users, something is wrong with the data-fetching layer, not the design.

## Risks & Fragile Areas
- The layout is a `"use client"` component. Any error thrown during render will crash the entire mobile app. No error boundary is wrapping this layout.
- User fetch (`/api/user/me`) on every layout mount adds a network round-trip on every page load within `/app/*`. There is no caching of the user state.
- `sessionStorage.removeItem('charaivati.redirect')` in the sign-out handler assumes `sessionStorage` is available. In some Capacitor WebView configurations, `sessionStorage` may behave unexpectedly.
- All layout styling is done with inline JS objects. There is no responsive breakpoint handling — this layout is designed for mobile screen sizes only.
- The `Account` tab links to `/store/account`, which is outside the `/app/*` route group. This crosses into the store module layout, which may have different headers/footers.

## Backlinks
- [[START_HERE.md]] — mobile shell architecture, Capacitor note
- [[auth.md]] — session fetch on mount, logout flow
- [[store.md]] — Account tab links to /store/account
