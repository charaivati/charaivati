# Flow: Add a New Protected Page

Self-contained checklist. No other file required.

---

## Decide: which route group?

| You need… | Route group | Path prefix |
|---|---|---|
| Full nav shell (layer switcher + tabs + profile menu) | `app/(with-nav)/` | any path |
| Auth but no nav (login, register, onboarding) | `app/(auth)/` | `/login`, `/register`, etc. |
| Public page, no auth | `app/(public)/` | any path |
| Mobile Capacitor shell (bottom nav) | `app/app/` | `/app/...` |

**For a standard new feature page, use `app/(with-nav)/`.**

---

## Checklist

### 1. Create the page file

```
app/(with-nav)/<your-route>/page.tsx
```

Example: a "Projects" page at `/projects`:
```
app/(with-nav)/projects/page.tsx
```

Server components are the default. Add `"use client"` only if you need browser APIs,
hooks, or event handlers.

---

### 2. Understand what `(with-nav)` gives you automatically

The `(with-nav)/layout.tsx` runs on every page under this group. It:

- Reads the session cookie server-side and fetches the user's `Profile`
- Wraps children in `<ProfileProvider>` — profile data is available to all child components
- Renders `<ResponsiveWorldNav>` (the layer switcher: Self / Society / Nation / Earth / Universe)
- Renders `<HeaderTabs>` (the tab bar for the active layer)
- Renders `<ProfileMenu>` (top-right avatar dropdown)
- Initializes E2E chat key pair (`ensureKeyPair()`)

You do not need to add any of this yourself.

---

### 3. Does middleware protect this route?

**Middleware only covers these four path prefixes:**
```
/self
/society
/nation
/earth
```

If your new page URL starts with one of those, it is automatically protected — an
unauthenticated user is redirected to `/login`.

**If your path does NOT start with one of those four**, middleware will NOT protect it.
A user without a session can reach the page. You must add server-side protection yourself.

---

### 4. Add server-side auth protection (required for any path not covered by middleware)

In your `page.tsx` (server component):

```ts
import { cookies } from "next/headers";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function YourPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const payload = await verifySessionToken(token);

  if (!payload?.userId) {
    redirect("/login");
  }

  // page content
}
```

If you only need to check auth without fetching user data, this is sufficient. If you
need the user record, add a `db.user.findUnique` call after verifying the payload.

**Do not** rely on the `(with-nav)` layout's profile fetch as an auth check — it returns
`null` for unauthenticated users but does not redirect them.

---

### 5. Wire the page into the layer navigation (optional)

The nav layer switcher in `WithNavClient.tsx` determines which layer is "active" by
checking `pathname.startsWith(...)`. The active layer controls which tabs are highlighted.

```ts
// app/(with-nav)/WithNavClient.tsx — useMemo block
const activeId = React.useMemo(() => {
  if (pathname.startsWith("/user") || pathname.startsWith("/self")) return "layer-self";
  if (pathname.startsWith("/society") || pathname.startsWith("/local")) return "layer-society-home";
  if (pathname.startsWith("/nation") || pathname.startsWith("/your_country")) return "layer-nation-birth";
  if (pathname.startsWith("/earth")) return "layer-earth";
  if (pathname.startsWith("/universe")) return "layer-universe";
  return "layer-self";  // fallback
}, [pathname]);
```

If your page has a path that should activate a specific layer, add a `startsWith` check
here. If you skip this, your page will appear with the Self layer active (fallback).

---

### 6. Wire the page into tab navigation (optional)

If your page should appear as a **tab** within a layer (e.g. a new tab under `/self`),
you need two additional steps:

**a. Add a `Tab` row to the database:**
```sql
-- Via Prisma Studio or a migration seed
INSERT INTO "Tab" (id, slug, title, levelId, is_default, position)
VALUES (cuid(), 'your-slug', 'Your Tab', '<levelId>', true, <position>);
```
Or use the admin API: `POST /api/admin/tabs`.

**b. Register the component in `tabToComponentMap.tsx`:**
```ts
// components/tabToComponentMap.tsx
const YourTab = dynamic(() => import("../app/(with-nav)/self/tabs/YourTab"), { ssr: false });

case "your-slug":
  return YourTab;
```

The slug in `tabToComponentMap` must exactly match `Tab.slug` in the database.
A slug in the DB with no matching entry in the map renders as blank with no error.

---

### 7. Add metadata (optional but recommended)

```ts
// app/(with-nav)/projects/page.tsx
export const metadata = {
  title: "Projects — Charaivati",
};
```

---

### 8. Access the profile in your page

The `(with-nav)` layout pre-fetches the profile. In a **client component** under this
layout, read it from context:

```ts
import { useProfile } from "@/lib/ProfileContext";

const profile = useProfile();
```

In a **server component**, re-fetch directly (the layout's fetch is for the client-side
context, not accessible in server component children):

```ts
import { db } from "@/lib/db";

const profile = await db.profile.findUnique({ where: { userId: payload.userId } });
```

---

## Full minimal example (new page at `/projects`)

```ts
// app/(with-nav)/projects/page.tsx
import { cookies } from "next/headers";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export const metadata = { title: "Projects — Charaivati" };

export default async function ProjectsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const payload = await verifySessionToken(token);
  if (!payload?.userId) redirect("/login");

  const projects = await db.projectTimeline.findMany({
    where: { userId: payload.userId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main>
      {projects.map(p => <div key={p.id}>{p.title}</div>)}
    </main>
  );
}
```

---

## Route group summary

```
app/
  (with-nav)/          ← your new page goes here for full nav
    layout.tsx         ← fetches profile, renders nav — do not edit unless wiring a new layer
    WithNavClient.tsx  ← edit activeId useMemo if your path needs a layer highlighted
    self/
    society/
    nation/
    earth/
    your-new-page/     ← create page.tsx here

  (auth)/              ← login, register, onboarding (no nav)
  (public)/            ← public pages (no auth)
  app/                 ← Capacitor mobile shell
  api/                 ← API routes only
```

---

## Backlinks
- [[START_HERE.md]] — unprotected routes warning, middleware coverage
- [[auth.md]] — middleware covers only 4 path prefixes
- [[navigation-tabs.md]] — Tab DB records and tabToComponentMap
- [[mobile-shell.md]] — if adding a page to the mobile shell instead
