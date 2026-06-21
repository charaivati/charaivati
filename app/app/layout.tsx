// app/app/layout.tsx
"use client";
import { getLogoutRedirect } from "@/lib/logout";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import NotificationBell from "@/components/notifications/NotificationBell";
import Wordmark from "@/components/brand/Wordmark";
import AccountMenu from "@/components/nav/AccountMenu";
import { useTranslations } from "@/hooks/useTranslations";

const LAYOUT_SLUGS =
  "app-layout-tab-home,app-layout-tab-initiatives,app-layout-tab-explore," +
  "app-layout-tab-orders,app-layout-my-account,app-layout-sign-out," +
  "app-layout-sign-in-up,app-layout-sign-in,app-layout-get-app," +
  "app-layout-language,app-layout-privacy,app-layout-terms,app-layout-about";

const TAB_DEFS = [
  { slug: "app-layout-tab-home",        fallback: "Home",        icon: "🏠" as string | null, href: "/app/home",        requiresLogin: false },
  { slug: "app-layout-tab-initiatives", fallback: "Initiatives", icon: "🌱" as string | null, href: "/app/initiatives", requiresLogin: false },
  { slug: "app-layout-tab-explore",     fallback: "Explore",     icon: "🔍" as string | null, href: "/app/saved",       requiresLogin: false },
  { slug: "app-layout-tab-orders",      fallback: "Orders",      icon: "🛍️" as string | null, href: "/app/orders",      requiresLogin: false },
];

const A = {
  nav: "#131921",
  border: "#E5E7EB",
  text: "#111827",
  textMuted: "#6B7280",
  accent: "#6366f1",
  surface: "#FFFFFF",
};

type User = {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl?: string | null;
  status?: string | null;
};

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations(LAYOUT_SLUGS);

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const allTabs = TAB_DEFS.map((tab) => ({ ...tab, label: t(tab.slug, tab.fallback) }));
  const tabs = allTabs.filter((tab) => !tab.requiresLogin || !!user);

  const isGuest = user?.status === "guest";

  useEffect(() => {
    fetch("/api/user/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setUser(d.user ?? null))
      .catch(() => {})
      .finally(() => setLoadingUser(false));
  }, []);

  async function handleSignOut() {
  const redirectTo = getLogoutRedirect(window.location.pathname);

  // Remove stale redirect memory
  try {
    sessionStorage.removeItem("charaivati.redirect");
  } catch {}

  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });

  window.location.href =
    "/login?redirect=" + encodeURIComponent(redirectTo);
}

  return (
    <>
      {/* Top bar */}
      <header
        style={{
          background: A.nav,
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <Wordmark size="sm" href="/app/home" />

        {/* Desktop nav links — hidden on mobile */}
        <div className="hidden md:flex gap-8 items-center absolute left-1/2 -translate-x-1/2">
          {tabs.map((tab) => {
            const active = pathname?.startsWith(tab.href) ?? false;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                style={{
                  color: active ? "#A5B4FC" : "rgba(255,255,255,0.65)",
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: active ? 700 : 400,
                  letterSpacing: "0.01em",
                }}
              >
                {tab.icon} {tab.label}
              </Link>
            );
          })}
        </div>

        {/* Right-side controls: bell + avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!loadingUser && user && <NotificationBell />}
          {!loadingUser && (
            <AccountMenu
              user={user}
              isGuest={isGuest}
              pathname={pathname}
              onSignOut={handleSignOut}
              t={t}
            />
          )}
        </div>
      </header>

      {/* Page content */}
      <div className="pb-14 md:pb-0">
        {children}
      </div>

      {/* Bottom navigation — mobile only */}
      <nav
        className="flex md:hidden"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: 56,
          background: "#FFFFFF",
          borderTop: "1px solid #E5E7EB",
          alignItems: "stretch",
          zIndex: 100,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {tabs.map((tab) => {
          const active = pathname?.startsWith(tab.href) ?? false;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                textDecoration: "none",
                color: active ? "#6366f1" : "#6B7280",
                transition: "color 0.15s",
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {tab.icon}
              </span>

              <span
                style={{
                  fontSize: 10,
                  fontWeight: active ? 600 : 400,
                }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}