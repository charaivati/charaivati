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
| Header (`<header>`) | 56px sticky; branding link + avatar dropdown |
| Avatar dropdown | Shows user name/email, "My Account" link, "Sign out" button |
| Content wrapper (`<div>`) | `paddingBottom: 56px` to clear bottom nav |
| Bottom nav (`<nav>`) | 56px fixed; 4 tabs with icon + label |

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
| Explore | ❤️ | /app/saved |
| Account | 👤 | /store/account |

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
